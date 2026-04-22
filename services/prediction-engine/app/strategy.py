from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from itertools import combinations
from typing import Any, Dict, List, Optional

import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.data.scraper as racing_scraper
import app.storage as storage
from app.time_utils import is_melbourne_premium_day


CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}
MOCK_EVENT_ID_PATTERNS = (
    re.compile(r"^r_\d+_\d+$"),
    re.compile(r"^afl_game_\d+$"),
    re.compile(r"^nba_game_\d+$"),
)


@dataclass
class StrategyService:
    racing_predictor: Any
    afl_predictor: Any
    nba_predictor: Any

    def get_or_create_card(self, profile_key: str, run_date: str, candidates: Optional[List[Dict[str, Any]]] = None):
        existing = storage.get_strategy_card(profile_key, run_date)
        if existing and not card_requires_refresh(existing):
            return existing

        profile = storage.get_strategy_profile(profile_key)
        if not profile:
            raise ValueError("strategy profile not found")

        candidate_pool = candidates if candidates is not None else self.collect_candidates_for_date(run_date)
        card = build_strategy_card(profile, candidate_pool, run_date)
        return storage.save_strategy_card(card, replace=existing is not None)

    def get_or_create_cards(self, run_date: str):
        profiles = storage.list_strategy_profiles()
        existing = {card["profile_key"]: card for card in storage.get_strategy_cards(run_date)}
        profiles_needing_refresh = {
            profile_key
            for profile_key, card in existing.items()
            if card_requires_refresh(card)
        }
        if len(existing) == len(profiles) and not profiles_needing_refresh:
            return [existing[profile["profile_key"]] for profile in profiles]

        candidates = self.collect_candidates_for_date(run_date)
        cards = []
        for profile in profiles:
            profile_key = profile["profile_key"]
            if profile_key in existing and profile_key not in profiles_needing_refresh:
                cards.append(existing[profile_key])
                continue
            cards.append(self.get_or_create_card(profile_key, run_date, candidates))
        return cards

    def collect_candidates_for_date(self, run_date: str) -> List[Dict[str, Any]]:
        candidates: List[Dict[str, Any]] = []
        candidates.extend(self._racing_candidates(run_date))
        candidates.extend(self._afl_candidates(run_date))
        candidates.extend(self._nba_candidates(run_date))
        return candidates

    def _racing_candidates(self, run_date: str) -> List[Dict[str, Any]]:
        races = racing_scraper.fetch_today_races(run_date=run_date)
        candidates: List[Dict[str, Any]] = []
        for race in races:
            horses = race.get("horses", [])
            if not horses:
                continue
            feature_rows = [
                {
                    "barrier": horse["barrier"],
                    "weight": horse["weight"],
                    "past_win_rate": horse["past_win_rate"],
                    "jockey_win_rate": horse["jockey_win_rate"],
                    "track_condition": horse["track_condition"],
                    "days_since_last_race": horse["days_since_last_race"],
                }
                for horse in horses
            ]
            probabilities, importances = self.racing_predictor.predict(feature_rows)
            feature_impact = {
                name: round(float(value), 4)
                for name, value in zip(getattr(self.racing_predictor, "feature_columns", []), importances)
            }
            ranked = []
            for index, horse in enumerate(horses):
                probability = float(probabilities[index])
                live_odds = float(horse.get("betfair_back_price") or 0.0) or None
                fair_odds = round(1 / probability, 2) if probability > 0 else None
                odds_source = "live_market" if live_odds and live_odds > 1 else "model_implied"
                effective_odds = live_odds if live_odds and live_odds > 1 else fair_odds
                edge = probability - (1 / effective_odds if effective_odds and effective_odds > 1 else probability)
                ranked.append({
                    "sport": "racing",
                    "event_id": race["race_id"],
                    "event_name": f"{race['venue']} R{race['race_number']}",
                    "market_type": "win",
                    "selection": horse["name"],
                    "model_probability": round(probability, 4),
                    "market_odds": live_odds,
                    "derived_odds": fair_odds if odds_source != "live_market" else None,
                    "odds_source": odds_source,
                    "edge": round(edge, 4),
                    "confidence": confidence_bucket(probability, edge),
                })

            ranked.sort(key=lambda item: item["model_probability"], reverse=True)
            storage.log_prediction_batch(
                sport="racing",
                event_id=race["race_id"],
                event_name=f"{race['venue']} R{race['race_number']}",
                predictions=[
                    {
                        "selection": item["selection"],
                        "probability": round(item["model_probability"] * 100, 2),
                        "fair_odds": item["derived_odds"] or item["market_odds"],
                        "payload": {
                            "selection": item["selection"],
                            "venue": race["venue"],
                            "canonical_venue": race.get("canonical_venue") or race["venue"],
                            "race_number": race["race_number"],
                            "meeting_date": race.get("meeting_date"),
                            "state": race.get("state"),
                            "meeting_region": race.get("meeting_region"),
                            "market_name": race.get("market_name"),
                            "start_time": race.get("start_time"),
                            "distance": race.get("distance"),
                            "data_source": race.get("data_source"),
                        },
                    }
                    for item in ranked
                ],
                feature_impact=feature_impact,
            )
            candidates.extend(ranked)
            candidates.extend(build_place_candidates(race, ranked))
        return candidates

    def _afl_candidates(self, run_date: str) -> List[Dict[str, Any]]:
        games = afl_scraper.fetch_this_week_afl(run_date=run_date)
        candidates: List[Dict[str, Any]] = []
        for game in games:
            result = self.afl_predictor.predict(game["features"])
            home_probability = float(result["home_win_prob"])
            away_probability = float(result["away_win_prob"])
            baseline_home = _clamp_probability(game.get("features", {}).get("squiggle_home_signal", 0.5))
            baseline_away = _clamp_probability(1 - baseline_home)
            storage.log_prediction_batch(
                sport="afl",
                event_id=game["game_id"],
                event_name=f"{game['home_team']} vs {game['away_team']}",
                predictions=[
                    {"selection": game["home_team"], "probability": round(home_probability * 100, 2), "fair_odds": round(1 / home_probability, 2)},
                    {"selection": game["away_team"], "probability": round(away_probability * 100, 2), "fair_odds": round(1 / away_probability, 2)},
                ],
                feature_impact={},
            )
            candidates.extend([
                build_head_to_head_candidate("afl", game, game["home_team"], home_probability, baseline_home),
                build_head_to_head_candidate("afl", game, game["away_team"], away_probability, baseline_away),
            ])
        return candidates

    def _nba_candidates(self, run_date: str) -> List[Dict[str, Any]]:
        games = nba_scraper.fetch_today_nba(run_date=run_date)
        candidates: List[Dict[str, Any]] = []
        for game in games:
            result = self.nba_predictor.predict(game["features"])
            home_probability = float(result["home_win_prob"])
            away_probability = float(result["away_win_prob"])
            home_baseline = nba_baseline_probability(game["features"])
            away_baseline = _clamp_probability(1 - home_baseline)
            storage.log_prediction_batch(
                sport="nba",
                event_id=game["game_id"],
                event_name=f"{game['home_team']} vs {game['away_team']}",
                predictions=[
                    {"selection": game["home_team"], "probability": round(home_probability * 100, 2), "fair_odds": round(1 / home_probability, 2)},
                    {"selection": game["away_team"], "probability": round(away_probability * 100, 2), "fair_odds": round(1 / away_probability, 2)},
                ],
                feature_impact={},
            )
            candidates.extend([
                build_head_to_head_candidate("nba", game, game["home_team"], home_probability, home_baseline),
                build_head_to_head_candidate("nba", game, game["away_team"], away_probability, away_baseline),
            ])
        return candidates


def build_head_to_head_candidate(sport: str, game: Dict[str, Any], selection: str, probability: float, baseline_probability: float) -> Dict[str, Any]:
    effective_odds = round(1 / baseline_probability, 2) if baseline_probability > 0 else None
    return {
        "sport": sport,
        "event_id": game["game_id"],
        "event_name": f"{game['home_team']} vs {game['away_team']}",
        "market_type": "head_to_head",
        "selection": selection,
        "model_probability": round(probability, 4),
        "market_odds": None,
        "derived_odds": effective_odds,
        "odds_source": "model_implied",
        "edge": round(probability - baseline_probability, 4),
        "confidence": confidence_bucket(probability, probability - baseline_probability),
    }


def card_requires_refresh(card: Dict[str, Any]) -> bool:
    for bet in card.get("selected_bets", []):
        event_id = str(bet.get("event_id", "")).strip()
        if any(pattern.match(event_id) for pattern in MOCK_EVENT_ID_PATTERNS):
            return True
    return False


def build_place_candidates(race: Dict[str, Any], ranked: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    probabilities = {candidate["selection"]: candidate["model_probability"] for candidate in ranked}
    candidates = []
    for candidate in ranked[:3]:
        place_probability = harville_place_probability(candidate["selection"], probabilities)
        if place_probability <= 0:
            continue
        effective_odds = round(1 / place_probability, 2)
        candidates.append({
            "sport": "racing",
            "event_id": race["race_id"],
            "event_name": f"{race['venue']} R{race['race_number']}",
            "market_type": "place",
            "selection": candidate["selection"],
            "model_probability": round(place_probability, 4),
            "market_odds": None,
            "derived_odds": effective_odds,
            "odds_source": "harville_derived",
            "edge": round(place_probability - (1 / effective_odds), 4),
            "confidence": confidence_bucket(place_probability, 0.0),
        })
    return candidates


def build_quinella_candidates(race: Dict[str, Any], ranked: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    probabilities = {candidate["selection"]: candidate["model_probability"] for candidate in ranked[:3]}
    names = list(probabilities.keys())
    candidates = []
    for index, first in enumerate(names):
        for second in names[index + 1:]:
            quinella_probability = harville_quinella_probability(first, second, probabilities)
            if quinella_probability <= 0:
                continue
            effective_odds = round(1 / quinella_probability, 2)
            candidates.append({
                "sport": "racing",
                "event_id": race["race_id"],
                "event_name": f"{race['venue']} R{race['race_number']}",
                "market_type": "quinella",
                "selection": f"{first} / {second}",
                "model_probability": round(quinella_probability, 4),
                "market_odds": None,
                "derived_odds": effective_odds,
                "odds_source": "harville_derived",
                "edge": round(quinella_probability - (1 / effective_odds), 4),
                "confidence": confidence_bucket(quinella_probability, 0.0),
            })
    return candidates


def build_strategy_card(profile: Dict[str, Any], candidates: List[Dict[str, Any]], run_date: str) -> Dict[str, Any]:
    rule_set = profile["rule_set"]
    bankroll_available = storage.DEFAULT_PREMIUM_BANKROLL if is_melbourne_premium_day(run_date) else storage.DEFAULT_STANDARD_BANKROLL
    qualified, skipped = qualify_candidates(candidates, rule_set)
    selected = allocate_candidates(qualified, rule_set, bankroll_available)
    total_allocated = round(sum(bet["stake"] for bet in selected), 2)
    sport_mix = summarize_sport_mix(selected, total_allocated)
    expected_edge = round(sum(bet["edge"] * bet["stake"] for bet in selected) / total_allocated, 4) if total_allocated > 0 else 0.0
    return {
        "profile_key": profile["profile_key"],
        "display_name": profile["display_name"],
        "card_date": run_date,
        "bankroll_available": bankroll_available,
        "bankroll_standard": storage.DEFAULT_STANDARD_BANKROLL,
        "bankroll_premium": storage.DEFAULT_PREMIUM_BANKROLL,
        "total_allocated": total_allocated,
        "candidate_count": len(candidates),
        "selected_bets": selected,
        "skipped_opportunities": skipped[:10],
        "sport_mix": sport_mix,
        "expected_edge": expected_edge,
        "performance": None,
    }


def qualify_candidates(candidates: List[Dict[str, Any]], rule_set: Dict[str, Any]):
    qualified = []
    skipped = []
    min_confidence = CONFIDENCE_ORDER[rule_set["min_confidence"]]
    allowed_markets = set(rule_set["allowed_markets"])
    for candidate in candidates:
        reason = None
        if candidate["market_type"] not in allowed_markets:
            reason = "market not allowed"
        elif candidate["edge"] < float(rule_set["min_edge"]):
            reason = "edge below threshold"
        elif CONFIDENCE_ORDER[candidate["confidence"]] < min_confidence:
            reason = "confidence below threshold"
        elif not effective_odds(candidate):
            reason = "missing effective odds"

        if reason:
            skipped.append({
                "sport": candidate["sport"],
                "event_id": candidate["event_id"],
                "event_name": candidate["event_name"],
                "market_type": candidate["market_type"],
                "selection": candidate["selection"],
                "edge": round(candidate["edge"], 4),
                "odds_source": candidate["odds_source"],
                "reason": reason,
            })
        else:
            qualified.append(candidate)

    qualified.sort(key=lambda candidate: (candidate["edge"], candidate["model_probability"]), reverse=True)
    return qualified, skipped


def allocate_candidates(candidates: List[Dict[str, Any]], rule_set: Dict[str, Any], bankroll_available: float):
    selected = []
    per_sport_cap = {
        sport: bankroll_available * float(rule_set["sport_weights"].get(sport, 0.0))
        for sport in ("racing", "afl", "nba")
    }
    per_sport_used = {sport: 0.0 for sport in ("racing", "afl", "nba")}
    selection_pool = list(candidates)
    selection_pool.extend(build_multi_candidates(candidates, rule_set))
    selection_pool.sort(key=lambda candidate: (candidate["edge"], candidate["model_probability"]), reverse=True)
    remaining_bankroll = bankroll_available
    selected_head_to_head_events = set()
    selected_multi_events = set()
    selected_single_events = set()

    for candidate in selection_pool:
        if len(selected) >= int(rule_set["max_bets_per_day"]):
            break
        candidate_event_ids = _candidate_event_ids(candidate)
        if candidate.get("legs") and candidate_event_ids & (selected_head_to_head_events | selected_multi_events | selected_single_events):
            continue
        if candidate["market_type"] == "head_to_head" and candidate["event_id"] in (selected_head_to_head_events | selected_multi_events):
            continue
        if candidate["market_type"] != "head_to_head" and candidate["event_id"] in selected_multi_events:
            continue

        remaining_sport = _remaining_sport_capacity(candidate, per_sport_cap, per_sport_used)
        if remaining_sport <= 0 or remaining_bankroll <= 0:
            continue

        stake = suggested_stake(candidate, bankroll_available, rule_set)
        if stake <= 0:
            continue
        stake = round(min(stake, float(rule_set["max_stake_per_bet"]), remaining_sport, remaining_bankroll), 2)
        if stake < 1:
            continue

        selected.append({
            "sport": candidate["sport"],
            "event_id": candidate["event_id"],
            "event_name": candidate["event_name"],
            "market_type": candidate["market_type"],
            "selection": candidate["selection"],
            "model_probability": candidate["model_probability"],
            "odds_used": effective_odds(candidate),
            "odds_source": candidate["odds_source"],
            "edge": candidate["edge"],
            "stake": stake,
            "status": "pending",
            "payout": None,
            "profit": None,
            "settled_at": None,
        })
        if candidate.get("legs"):
            selected[-1]["legs"] = candidate["legs"]
        if candidate.get("odds_sources"):
            selected[-1]["odds_sources"] = candidate["odds_sources"]
        if candidate.get("sport_allocation"):
            selected[-1]["sport_allocation"] = candidate["sport_allocation"]
        _consume_sport_capacity(candidate, per_sport_used, stake)
        remaining_bankroll -= stake
        if candidate.get("legs"):
            selected_multi_events.update(candidate_event_ids)
        else:
            selected_single_events.add(candidate["event_id"])
            if candidate["market_type"] == "head_to_head":
                selected_head_to_head_events.add(candidate["event_id"])

    return selected


def summarize_sport_mix(selected: List[Dict[str, Any]], total_allocated: float):
    if total_allocated <= 0:
        return {}
    mix: Dict[str, float] = {}
    for bet in selected:
        sport_allocation = bet.get("sport_allocation") or {bet["sport"]: 1.0}
        for sport, weight in sport_allocation.items():
            if float(weight) <= 0:
                continue
            mix[sport] = mix.get(sport, 0.0) + (bet["stake"] * float(weight))
    return {sport: round(amount / total_allocated, 4) for sport, amount in mix.items()}


def suggested_stake(candidate: Dict[str, Any], bankroll_available: float, rule_set: Dict[str, Any]) -> float:
    odds = effective_odds(candidate)
    if not odds or odds <= 1:
        return 0.0
    probability = _clamp_probability(candidate["model_probability"])
    b = odds - 1
    q = 1 - probability
    kelly_fraction = ((b * probability) - q) / b if b > 0 else 0.0
    kelly_fraction = max(0.0, kelly_fraction)
    if kelly_fraction <= 0 and candidate["edge"] > 0:
        kelly_fraction = min(candidate["edge"], 0.02)
    return bankroll_available * float(rule_set["kelly_fraction"]) * kelly_fraction


def effective_odds(candidate: Dict[str, Any]) -> Optional[float]:
    odds = candidate.get("market_odds") or candidate.get("derived_odds")
    if odds is None:
        return None
    return round(float(odds), 2)


def confidence_bucket(probability: float, edge: float) -> str:
    if probability >= 0.5 or edge >= 0.1:
        return "high"
    if probability >= 0.3 or edge >= 0.04:
        return "medium"
    return "low"


def harville_place_probability(selection: str, win_probabilities: Dict[str, float]) -> float:
    pi = _clamp_probability(win_probabilities.get(selection, 0.0))
    if pi <= 0:
        return 0.0

    runners = list(win_probabilities.items())
    second = 0.0
    third = 0.0
    for first_name, first_prob in runners:
        if first_name == selection:
            continue
        first_prob = _clamp_probability(first_prob)
        remaining_after_first = 1 - first_prob
        if remaining_after_first <= 0:
            continue
        second += first_prob * (pi / remaining_after_first)
        for second_name, second_prob in runners:
            if second_name in {selection, first_name}:
                continue
            second_prob = _clamp_probability(second_prob)
            remaining_after_second = remaining_after_first - second_prob
            if remaining_after_second <= 0:
                continue
            third += first_prob * (second_prob / remaining_after_first) * (pi / remaining_after_second)
    return round(min(0.999, pi + second + third), 4)


def harville_quinella_probability(first: str, second: str, win_probabilities: Dict[str, float]) -> float:
    p1 = _clamp_probability(win_probabilities.get(first, 0.0))
    p2 = _clamp_probability(win_probabilities.get(second, 0.0))
    if p1 <= 0 or p2 <= 0 or p1 >= 1 or p2 >= 1:
        return 0.0
    forward = p1 * (p2 / max(1e-6, 1 - p1))
    reverse = p2 * (p1 / max(1e-6, 1 - p2))
    return round(min(0.999, forward + reverse), 4)


def build_multi_candidate(legs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not legs:
        return None
    odds = 1.0
    combined_probability = 1.0
    implied_probability = 1.0
    sport_counts: Dict[str, int] = {}
    normalized_legs = []
    for index, leg in enumerate(legs, start=1):
        leg_odds = effective_odds(leg)
        if not leg_odds:
            return None
        odds *= leg_odds
        leg_probability = _clamp_probability(leg.get("model_probability", 1 / leg_odds))
        combined_probability *= leg_probability
        implied_probability *= (1 / leg_odds)
        sport = str(leg.get("sport", "")).strip().lower()
        if sport in {"racing", "afl", "nba"}:
            sport_counts[sport] = sport_counts.get(sport, 0) + 1
        normalized_legs.append(
            {
                "sport": sport or "multi",
                "event_id": str(leg.get("event_id", f"leg-{index}")),
                "event_name": str(leg.get("event_name", leg.get("selection", f"Leg {index}"))),
                "market_type": str(leg.get("market_type", "head_to_head")),
                "selection": str(leg.get("selection", f"Leg {index}")),
                "odds_used": leg_odds,
                "odds_source": leg["odds_source"],
            }
        )
    odds_sources = [leg["odds_source"] for leg in normalized_legs]
    leg_count = len(normalized_legs)
    combined_edge = round(combined_probability - implied_probability, 4)
    return {
        "sport": "multi",
        "event_id": f"multi:{'|'.join(leg['event_id'] for leg in normalized_legs)}",
        "event_name": " + ".join(leg["event_name"] for leg in normalized_legs),
        "market_type": "multi",
        "selection": " + ".join(leg["selection"] for leg in normalized_legs),
        "model_probability": round(combined_probability, 4),
        "market_odds": None,
        "derived_odds": round(odds, 2),
        "odds_source": odds_sources[0] if len(set(odds_sources)) == 1 else "composite",
        "edge": combined_edge,
        "confidence": confidence_bucket(combined_probability, combined_edge),
        "legs": normalized_legs,
        "sport_allocation": {
            sport: round(count / leg_count, 4)
            for sport, count in sport_counts.items()
        },
        "odds_used": round(odds, 2),
        "odds_sources": odds_sources,
    }


def build_multi_candidates(candidates: List[Dict[str, Any]], rule_set: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not rule_set.get("allow_multis"):
        return []

    max_multi_legs = max(2, int(rule_set.get("max_multi_legs", 1)))
    eligible = [candidate for candidate in candidates if not candidate.get("legs") and _candidate_supports_multi_settlement(candidate)]
    if len(eligible) < 2:
        return []

    top_candidates = eligible[: max(4, min(len(eligible), int(rule_set["max_bets_per_day"]) * 2))]
    multis = []
    for leg_count in range(2, min(max_multi_legs, len(top_candidates)) + 1):
        for legs in combinations(top_candidates, leg_count):
            if len({leg["event_id"] for leg in legs}) != leg_count:
                continue
            multi = build_multi_candidate(list(legs))
            if multi and multi["edge"] > 0:
                multis.append(multi)

    multis.sort(key=lambda candidate: (candidate["edge"], candidate["model_probability"]), reverse=True)
    return multis[: max(1, int(rule_set["max_bets_per_day"]))]


def _candidate_event_ids(candidate: Dict[str, Any]) -> set[str]:
    legs = candidate.get("legs") or []
    if legs:
        return {str(leg.get("event_id", "")).strip() for leg in legs if str(leg.get("event_id", "")).strip()}
    event_id = str(candidate.get("event_id", "")).strip()
    return {event_id} if event_id else set()


def _candidate_sport_allocation(candidate: Dict[str, Any]) -> Dict[str, float]:
    allocation = candidate.get("sport_allocation")
    if isinstance(allocation, dict) and allocation:
        return {
            sport: float(weight)
            for sport, weight in allocation.items()
            if sport in {"racing", "afl", "nba"} and float(weight) > 0
        }
    sport = candidate.get("sport")
    if sport in {"racing", "afl", "nba"}:
        return {sport: 1.0}
    return {}


def _candidate_supports_multi_settlement(candidate: Dict[str, Any]) -> bool:
    sport = str(candidate.get("sport", "")).strip().lower()
    market_type = str(candidate.get("market_type", "")).strip().lower()
    return (sport == "racing" and market_type == "win") or (market_type == "head_to_head" and sport in {"afl", "nba"})


def _remaining_sport_capacity(candidate: Dict[str, Any], per_sport_cap: Dict[str, float], per_sport_used: Dict[str, float]) -> float:
    allocation = _candidate_sport_allocation(candidate)
    if not allocation:
        return 0.0
    limits = []
    for sport, weight in allocation.items():
        remaining = per_sport_cap[sport] - per_sport_used[sport]
        limits.append(remaining / weight if weight > 0 else 0.0)
    return min(limits) if limits else 0.0


def _consume_sport_capacity(candidate: Dict[str, Any], per_sport_used: Dict[str, float], stake: float) -> None:
    for sport, weight in _candidate_sport_allocation(candidate).items():
        per_sport_used[sport] += stake * weight


def nba_baseline_probability(features: Dict[str, Any]) -> float:
    home_win_pct = _clamp_probability(features.get("home_win_pct", 0.5))
    away_win_pct = _clamp_probability(features.get("away_win_pct", 0.5))
    numerator = home_win_pct + 0.03
    denominator = home_win_pct + away_win_pct + 0.06
    if denominator <= 0:
        return 0.5
    return _clamp_probability(numerator / denominator)


def _clamp_probability(value: Any) -> float:
    try:
        probability = float(value)
    except (TypeError, ValueError):
        return 0.0
    if probability > 1:
        probability = probability / 100
    return max(0.001, min(probability, 0.999))
