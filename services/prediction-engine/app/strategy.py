from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
import concurrent.futures
from itertools import combinations
from typing import Any, Dict, List, Optional

import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.data.nfl_scraper as nfl_scraper
import app.data.scraper as racing_scraper
import app.storage as storage
from app.time_utils import (
    is_melbourne_premium_day,
    now_melbourne,
    today_melbourne,
    to_melbourne_datetime,
)


CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}
LEGACY_SYNTHETIC_EVENT_ID_PATTERNS = (
    re.compile(r"^r_\d+_\d+$"),
    re.compile(r"^afl_game_\d+$"),
    re.compile(r"^nba_game_\d+$"),
)

PERSONA_RESTING_RATIONALES = {
    "bob": "Betmate Bob passed today: Market edges below 5% threshold across today's board. Preserving bankroll for higher conviction setups.",
    "conservative": "Conservative passed today: No opportunities met our strict 10% edge and low-variance criteria. Capital preserved.",
    "favourites_only": "Favourites Only passed today: No qualifying short-odds selections with verified model edge on today's slate.",
    "roughies_only": "Roughies Only passed today: No high-odds value plays found exceeding our 15% edge threshold.",
    "neutral": "Neutral passed today: Standing aside as no straight bets cleared our disciplined risk-adjusted threshold.",
    "sgm_exclusive": "SGM Exclusive passed today: No game environments offered sufficiently positive correlated pricing today.",
    "racing_multi": "Racing Multi passed today: Insufficient multi-leg overlays identified across today's race cards.",
    "sports_multi": "Sports Multi passed today: Standing aside as cross-game market lines offered inadequate edge.",
}


def _clamp_probability(value: Any) -> float:
    try:
        probability = float(value)
    except (TypeError, ValueError):
        return 0.0
    if probability > 1:
        probability = probability / 100
    return max(0.001, min(probability, 0.999))


def calculate_benter_blended_probability(
    model_prob: float,
    market_odds: Optional[float],
    sport: str = "sports",
    market_type: str = "head_to_head",
) -> tuple[float, float]:
    """
    Computes de-vigged market prob and Benter blended probability:
    p_blend proportional to (p_model^alpha) * (p_market^beta)
    Weights:
    - Racing: alpha=0.35, beta=0.65
    - Sports lines: alpha=0.40, beta=0.60
    - Props: alpha=0.50, beta=0.50
    Returns (blended_prob, edge). If market_odds is None or <= 1.0, edge MUST strictly be 0.0.
    """
    if not market_odds or float(market_odds) <= 1.0:
        return _clamp_probability(model_prob), 0.0

    p_market = 1.0 / float(market_odds)
    p_model = _clamp_probability(model_prob)
    p_market = _clamp_probability(p_market)

    sport_lower = str(sport).lower()
    if sport_lower == "racing":
        alpha, beta = 0.35, 0.65
    elif "prop" in str(market_type).lower():
        alpha, beta = 0.50, 0.50
    else:
        alpha, beta = 0.40, 0.60

    u = (p_model ** alpha) * (p_market ** beta)
    v = ((1.0 - p_model) ** alpha) * ((1.0 - p_market) ** beta)
    if u + v <= 0:
        blended = p_model
    else:
        blended = u / (u + v)

    edge = round(blended - p_market, 4)
    return round(blended, 4), edge


def generate_bet_writeup(candidate: Dict[str, Any], profile_key: str) -> str:
    selection = candidate.get("selection", "Selection")
    event_name = candidate.get("event_name", "the event")
    prob_pct = round(float(candidate.get("model_probability", 0.0)) * 100, 1)
    odds = effective_odds(candidate) or 2.0
    edge_pct = round(float(candidate.get("edge", 0.0)) * 100, 1)

    disciplined = profile_key in ("bob", "conservative", "favourites_only", "neutral")
    if disciplined:
        if candidate.get("legs"):
            return (
                f"Quantitative correlation model projects {prob_pct}% combined probability across {len(candidate['legs'])} legs in {event_name}. "
                f"Offers verified +{edge_pct}% edge over market compound pricing."
            )
        return (
            f"Model rates {selection} at {prob_pct}% win probability versus market implied {round(100/odds, 1)}% in {event_name}. "
            f"Presents a disciplined +{edge_pct}% edge at ${odds:.2f}."
        )
    else:
        if candidate.get("legs"):
            return (
                f"High-upside {len(candidate['legs'])}-leg multi locked in {event_name} at ${odds:.2f}. "
                f"Model detects significant correlation edge ({edge_pct}%) for maximum leverage."
            )
        return (
            f"Aggressive value play on {selection} at ${odds:.2f} in {event_name}. "
            f"Model flags a +{edge_pct}% edge, capitalizing on high-variance market mispricing."
        )


@dataclass
class StrategyService:
    racing_predictor: Any
    afl_predictor: Any
    nba_predictor: Any
    nfl_predictor: Any = None

    def get_or_create_card(self, profile_key: str, run_date: str, candidates: Optional[List[Dict[str, Any]]] = None, selection_usage: Optional[Dict[str, int]] = None):
        existing = storage.get_strategy_card(profile_key, run_date)
        if existing and not card_requires_refresh(existing):
            return existing

        profile = storage.get_strategy_profile(profile_key)
        if not profile:
            raise ValueError("strategy profile not found")

        candidate_pool = candidates if candidates is not None else self.collect_candidates_for_date(run_date)
        card = build_strategy_card(profile, candidate_pool, run_date, selection_usage=selection_usage)
        return storage.save_strategy_card(card, replace=existing is not None)

    def get_or_create_cards(self, run_date: str):
        profiles = storage.list_strategy_profiles()
        existing = {card["profile_key"]: card for card in storage.get_strategy_cards(run_date)}
        profiles_needing_refresh = {
            profile_key
            for profile_key, card in existing.items()
            if card_requires_refresh(card)
        }
        if all(profile["profile_key"] in existing and profile["profile_key"] not in profiles_needing_refresh for profile in profiles):
            return [existing[profile["profile_key"]] for profile in profiles]

        candidates = self.collect_candidates_for_date(run_date)

        # Priority order: bob -> conservative -> favourites_only -> roughies_only -> sgm_exclusive -> neutral -> aggressive -> james
        priority_order = {
            "bob": 0,
            "conservative": 1,
            "favourites_only": 2,
            "roughies_only": 3,
            "sgm_exclusive": 4,
            "nba_sgm": 4,
            "nfl_sgm": 4,
            "racing_multi": 4,
            "sports_multi": 4,
            "neutral": 5,
            "aggressive": 6,
            "james": 7,
        }
        sorted_profiles = sorted(profiles, key=lambda p: priority_order.get(p["profile_key"], 99))
        selection_usage: Dict[str, int] = {}
        cards = []
        for profile in sorted_profiles:
            profile_key = profile["profile_key"]
            if profile_key in existing and profile_key not in profiles_needing_refresh:
                cards.append(existing[profile_key])
                continue
            cards.append(self.get_or_create_card(profile_key, run_date, candidates, selection_usage=selection_usage))
        return cards

    def build_daily_cards(self, run_date: str) -> List[Dict[str, Any]]:
        return self.get_or_create_cards(run_date)

    def collect_candidates_for_date(self, run_date: str) -> List[Dict[str, Any]]:
        print(f"[Strategy] Starting collect_candidates_for_date for {run_date}")
        candidates: List[Dict[str, Any]] = []
        import time
        t0 = time.time()
        print("[Strategy] Fetching racing candidates...")
        candidates.extend(self._racing_candidates(run_date))
        print(f"[Strategy] Fetching racing candidates done in {time.time() - t0:.2f}s")
        t0 = time.time()
        print("[Strategy] Fetching afl candidates...")
        candidates.extend(self._afl_candidates(run_date))
        print(f"[Strategy] Fetching afl candidates done in {time.time() - t0:.2f}s")
        t0 = time.time()
        print("[Strategy] Fetching nba candidates...")
        candidates.extend(self._nba_candidates(run_date))
        print(f"[Strategy] Fetching nba candidates done in {time.time() - t0:.2f}s")
        t0 = time.time()
        print("[Strategy] Fetching nfl candidates...")
        candidates.extend(self._nfl_candidates(run_date))
        print(f"[Strategy] Fetching nfl candidates done in {time.time() - t0:.2f}s")

        if hasattr(self, "_racing_logs") and self._racing_logs:
            storage.log_prediction_batch("racing", "BATCH", "BATCH", self._racing_logs, None)
            self._racing_logs = []


        # Rank single legs by Edge % = (model_probability * odds_used) - 1.0 and upsert Top 10 EV Feed
        ev_legs = []
        for c in candidates:
            prob = float(c.get("model_probability") or 0.0)
            odds = float(c.get("market_odds") or c.get("odds_used") or c.get("derived_odds") or 0.0)
            if prob > 0.02 and 1.10 <= odds <= 51.0:
                edge_pct = round(((prob * odds) - 1.0) * 100.0, 2)
                if 0.0 < edge_pct <= 200.0:
                    ev_legs.append({
                        "id": f"{c.get('sport')}_{c.get('event_id')}_{c.get('selection')}".replace(" ", "_").replace("@", "at"),
                        "sport": c.get("sport", "nba"),
                        "game_context": c.get("event_name", ""),
                        "leg_description": f"{c.get('selection')} to Win" if c.get("market_type") in ("win", "head_to_head") and "win" not in str(c.get("selection")).lower() else str(c.get("selection")),
                        "true_prob": round(prob, 4),
                        "best_odds": round(odds, 2),
                        "edge_pct": edge_pct,
                        "back_price": round(odds, 2),
                        "lay_price": round(odds * 1.05, 2) if c.get("sport") == "racing" else None,
                        "correlation_group": c.get("event_id"),
                    })
        ev_legs.sort(key=lambda x: x["edge_pct"], reverse=True)
        if ev_legs:
            try:
                # Top 10 overall + top 10 per sport
                legs_to_save = []
                seen_ids = set()
                for leg in ev_legs[:10]:
                    if leg["id"] not in seen_ids:
                        legs_to_save.append(leg)
                        seen_ids.add(leg["id"])
                by_sport: Dict[str, List[Dict[str, Any]]] = {}
                for leg in ev_legs:
                    by_sport.setdefault(leg.get("sport", "other"), []).append(leg)
                for sp, s_legs in by_sport.items():
                    for leg in s_legs[:10]:
                        if leg["id"] not in seen_ids:
                            legs_to_save.append(leg)
                            seen_ids.add(leg["id"])
                storage.upsert_daily_ev_feed(legs_to_save)
            except Exception as e:
                print(f"[Strategy] Failed to upsert daily_ev_feed: {e}")

        return candidates

    def _nfl_candidates(self, run_date: str) -> List[Dict[str, Any]]:
        if not self.nfl_predictor:
            return []
        candidates: List[Dict[str, Any]] = []
        try:
            games = nfl_scraper.fetch_upcoming_nfl(run_date=run_date)
            pass
            pass
            pass
            pass
            pass
            for g in games:
                home = str(g["home_team"])
                away = str(g["away_team"])
                features = {
                    "epa_diff": float((g.get("features") or {}).get("epa_diff", 0.0)),
                    "rest_diff": float((g.get("features") or {}).get("rest_diff", 0.0)),
                    "is_dome": float((g.get("features") or {}).get("is_dome", 0.0)),
                    "spread_line": float((g.get("features") or {}).get("spread_line", -3.5)),
                }
                pred = self.nfl_predictor.predict(features)
                home_p = pred["home_win_prob"]
                away_p = pred["away_win_prob"]
                game_obj = {
                    "game_id": str(g.get("game_id", f"nfl_{home}_{away}")),
                    "home_team": home,
                    "away_team": away,
                    "features": features,
                }
                spread_val = float(g.get("spread_line", -3.5)) or -3.5
                spread_sel = f"{home} {spread_val:+.1f}"
                spread_prob = _clamp_probability(home_p * 0.94)
                total_line = float(g.get("total_line", 44.5)) or 44.5
                total_prob = 0.53

                start_time = g.get("date")
                game_obj["date"] = start_time
                candidates.extend([
                    build_head_to_head_candidate("nfl", game_obj, home, home_p, 0.5),
                    build_head_to_head_candidate("nfl", game_obj, away, away_p, 0.5),
                    {
                        "sport": "nfl",
                        "event_id": game_obj["game_id"],
                        "event_name": f"{home} vs {away}",
                        "market_type": "spread",
                        "selection": spread_sel,
                        "model_probability": round(spread_prob, 4),
                        "market_odds": None,
                        "derived_odds": 1.91,
                        "odds_source": "model_implied",
                        "edge": round(spread_prob - 0.50, 4),
                        "confidence": confidence_bucket(spread_prob, spread_prob - 0.50),
                        "start_time": start_time,
                    },
                    {
                        "sport": "nfl",
                        "event_id": game_obj["game_id"],
                        "event_name": f"{home} vs {away}",
                        "market_type": "total_points",
                        "selection": f"Over {total_line:.1f} Total Points",
                        "model_probability": round(total_prob, 4),
                        "market_odds": None,
                        "derived_odds": 1.91,
                        "odds_source": "model_implied",
                        "edge": round(total_prob - 0.50, 4),
                        "confidence": confidence_bucket(total_prob, total_prob - 0.50),
                        "start_time": start_time,
                    },
                ])
        except Exception as exc:
            print(f"[NFL] Candidates note: {exc}")
        return candidates


    def _racing_candidates(self, run_date: str) -> List[Dict[str, Any]]:
        races = racing_scraper.fetch_today_races(run_date=run_date)
        candidates: List[Dict[str, Any]] = []
        batch_logs: List[Dict[str, Any]] = []
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
                if live_odds and live_odds > 1.0:
                    blended_prob, edge = calculate_benter_blended_probability(
                        probability, live_odds, sport="racing", market_type="win"
                    )
                else:
                    blended_prob = probability
                    edge = 0.0
                ranked.append({
                    "sport": "racing",
                    "event_id": race["race_id"],
                    "event_name": f"{race['venue']} R{race['race_number']}",
                    "market_type": "win",
                    "selection": horse["name"],
                    "model_probability": round(blended_prob, 4),
                    "market_odds": live_odds,
                    "derived_odds": fair_odds if odds_source != "live_market" else None,
                    "odds_source": odds_source,
                    "edge": round(edge, 4),
                    "confidence": confidence_bucket(blended_prob, edge),
                    "start_time": race.get("start_time"),
                    "barrier": horse["barrier"],
                    "weight": horse["weight"],
                    "past_win_rate": horse["past_win_rate"],
                    "jockey_win_rate": horse["jockey_win_rate"],
                    "track_condition": horse["track_condition"],
                    "days_since_last_race": horse["days_since_last_race"],
                })

            ranked.sort(key=lambda item: item["model_probability"], reverse=True)
            batch_logs.append({
                "sport": "racing",
                "event_id": race["race_id"],
                "event_name": f"{race['venue']} R{race['race_number']}",
                "predictions": [
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
                            "barrier": item["barrier"],
                            "weight": item["weight"],
                            "past_win_rate": item["past_win_rate"],
                            "jockey_win_rate": item["jockey_win_rate"],
                            "track_condition": item["track_condition"],
                            "days_since_last_race": item["days_since_last_race"],
                        },
                    }
                    for item in ranked
                ],
                "feature_impact": feature_impact,
            })
            candidates.extend(ranked)
            candidates.extend(build_place_candidates(race, ranked))

        if batch_logs:
            storage.log_prediction_batches_bulk(batch_logs)
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
                    {
                        "selection": game["home_team"],
                        "probability": round(home_probability * 100, 2),
                        "fair_odds": round(1 / home_probability, 2),
                        "payload": {
                            **game["features"],
                            "home_team": game["home_team"],
                            "away_team": game["away_team"],
                        }
                    },
                    {
                        "selection": game["away_team"],
                        "probability": round(away_probability * 100, 2),
                        "fair_odds": round(1 / away_probability, 2),
                        "payload": {
                            **game["features"],
                            "home_team": game["home_team"],
                            "away_team": game["away_team"],
                        }
                    },
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
        try:
            from app.data.betfair_sports_odds import get_cached_sport_odds, match_event_odds
            betfair_cache = get_cached_sport_odds("nba")
        except Exception:
            betfair_cache = {}

        for game in games:
            home_team = game.get("home_team", "")
            away_team = game.get("away_team", "")
            home_market_odds, away_market_odds = None, None
            if betfair_cache and home_team and away_team:
                try:
                    home_market_odds, away_market_odds = match_event_odds(
                        "nba", home_team, away_team, betfair_cache
                    )
                except Exception:
                    pass

            result = self.nba_predictor.predict(game["features"])
            home_probability = float(result["home_win_prob"])
            away_probability = float(result["away_win_prob"])
            home_baseline = nba_baseline_probability(game["features"])
            away_baseline = _clamp_probability(1 - home_baseline)
            storage.log_prediction_batch(
                sport="nba",
                event_id=game["game_id"],
                event_name=f"{home_team} vs {away_team}",
                predictions=[
                    {
                        "selection": home_team,
                        "probability": round(home_probability * 100, 2),
                        "fair_odds": round(1 / home_probability, 2),
                        "payload": {
                            **game["features"],
                            "home_team": home_team,
                            "away_team": away_team,
                        }
                    },
                    {
                        "selection": away_team,
                        "probability": round(away_probability * 100, 2),
                        "fair_odds": round(1 / away_probability, 2),
                        "payload": {
                            **game["features"],
                            "home_team": home_team,
                            "away_team": away_team,
                        }
                    },
                ],
                feature_impact={},
            )
            home_spread = f"{home_team} -3.5" if home_probability >= 0.5 else f"{home_team} +3.5"
            spread_prob = _clamp_probability(home_probability * 0.94 if home_probability >= 0.5 else away_probability * 0.94)
            total_prob = 0.54

            spread_market_odds = game.get("spread_market_odds")
            if spread_market_odds and float(spread_market_odds) > 1.0:
                _, spread_edge = calculate_benter_blended_probability(spread_prob, float(spread_market_odds), sport="nba", market_type="spread")
            else:
                spread_edge = round(spread_prob - 0.50, 4)

            total_market_odds = game.get("total_market_odds")
            if total_market_odds and float(total_market_odds) > 1.0:
                _, total_edge = calculate_benter_blended_probability(total_prob, float(total_market_odds), sport="nba", market_type="total_points")
            else:
                total_edge = round(total_prob - 0.50, 4)

            home_game = {**game, "market_odds": home_market_odds}
            away_game = {**game, "market_odds": away_market_odds}

            candidates.extend([
                build_head_to_head_candidate("nba", home_game, home_team, home_probability, home_baseline),
                build_head_to_head_candidate("nba", away_game, away_team, away_probability, away_baseline),
                {
                    "sport": "nba",
                    "event_id": game["game_id"],
                    "event_name": f"{home_team} vs {away_team}",
                    "market_type": "spread",
                    "selection": home_spread,
                    "model_probability": round(spread_prob, 4),
                    "market_odds": float(spread_market_odds) if spread_market_odds and float(spread_market_odds) > 1.0 else None,
                    "derived_odds": 1.91,
                    "odds_source": "live_market" if spread_market_odds and float(spread_market_odds) > 1.0 else "model_implied",
                    "edge": round(spread_edge, 4),
                    "confidence": confidence_bucket(spread_prob, spread_edge),
                    "start_time": game.get("date"),
                },
                {
                    "sport": "nba",
                    "event_id": game["game_id"],
                    "event_name": f"{home_team} vs {away_team}",
                    "market_type": "total_points",
                    "selection": "Over 218.5 Total Points",
                    "model_probability": round(total_prob, 4),
                    "market_odds": float(total_market_odds) if total_market_odds and float(total_market_odds) > 1.0 else None,
                    "derived_odds": 1.91,
                    "odds_source": "live_market" if total_market_odds and float(total_market_odds) > 1.0 else "model_implied",
                    "edge": round(total_edge, 4),
                    "confidence": confidence_bucket(total_prob, total_edge),
                    "start_time": game.get("date"),
                },
            ])
        if hasattr(self, "_racing_logs") and self._racing_logs:
            storage.log_prediction_batch("racing", "BATCH", "BATCH", self._racing_logs, None)
            self._racing_logs = []
        return candidates

    def recommend_custom_multi(
        self,
        run_date: Optional[str] = None,
        win_legs: int = 1,
        place_legs: int = 2,
        sport_mode: str = "combined",
        min_odds: float = 2.0,
        max_odds: float = 50.0,
        after_time: Optional[str] = None,
        current_legs: Optional[List[Dict[str, Any]]] = None,
        candidates: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        if candidates is None:
            target_date = run_date or today_melbourne().isoformat()
            candidates = self.collect_candidates(target_date)
        return recommend_custom_multi(
            candidates=candidates,
            win_legs=win_legs,
            place_legs=place_legs,
            sport_mode=sport_mode,
            min_odds=min_odds,
            max_odds=max_odds,
            after_time=after_time,
            current_legs=current_legs,
        )


def build_head_to_head_candidate(sport: str, game: Dict[str, Any], selection: str, probability: float, baseline_probability: float) -> Dict[str, Any]:
    market_odds = game.get("market_odds") or game.get("features", {}).get("market_odds")
    if market_odds and float(market_odds) > 1.0:
        odds_val = float(market_odds)
        blended_prob, edge = calculate_benter_blended_probability(probability, odds_val, sport=sport, market_type="head_to_head")
        odds_source = "live_market"
        derived_odds = None
    else:
        odds_val = None
        derived_odds = round(1 / baseline_probability, 2) if baseline_probability > 0 else 1.91
        odds_source = "model_implied"
        blended_prob = probability
        edge = round(probability - baseline_probability, 4)

    return {
        "sport": sport,
        "event_id": game["game_id"],
        "event_name": f"{game['home_team']} vs {game['away_team']}",
        "market_type": "head_to_head",
        "selection": selection,
        "model_probability": round(blended_prob, 4),
        "market_odds": odds_val,
        "derived_odds": derived_odds,
        "odds_source": odds_source,
        "edge": round(edge, 4),
        "confidence": confidence_bucket(blended_prob, edge),
        "start_time": game.get("start_time") or game.get("date"),
    }


def card_requires_refresh(card: Dict[str, Any]) -> bool:
    if card.get("candidate_count", 0) == 0 and not card.get("resting_rationale"):
        return True
    for bet in card.get("selected_bets", []):
        event_id = str(bet.get("event_id", "")).strip()
        if any(pattern.match(event_id) for pattern in LEGACY_SYNTHETIC_EVENT_ID_PATTERNS):
            return True
    return False


def build_place_candidates(race: Dict[str, Any], ranked: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not ranked:
        return []

    # Apply Henery power discount (theta = 0.85) to win probabilities before Harville place probability calculation
    theta = 0.85
    powers = {
        candidate["selection"]: (float(candidate.get("model_probability", 0.0)) ** theta)
        for candidate in ranked
        if float(candidate.get("model_probability", 0.0)) > 0
    }
    total_power = sum(powers.values())
    if total_power > 0:
        calibrated_probs = {k: v / total_power for k, v in powers.items()}
    else:
        calibrated_probs = {c["selection"]: float(c.get("model_probability", 0.0)) for c in ranked}

    runners_count = len(race.get("horses", [])) or len(ranked)
    horses_map = {
        h["name"]: h
        for h in race.get("horses", [])
        if isinstance(h, dict) and "name" in h
    }

    candidates = []
    for index, candidate in enumerate(ranked):
        selection = candidate["selection"]
        place_probability = harville_place_probability(selection, calibrated_probs)
        if place_probability <= 0:
            continue

        horse = horses_map.get(selection) or {}

        # 1. Live Betfair place odds if available
        live_place_odds = (
            candidate.get("place_odds")
            or candidate.get("market_place_odds")
            or candidate.get("betfair_place_price")
            or horse.get("betfair_place_price")
            or horse.get("place_odds")
        )

        # 2. Win odds fallback for Tote / Fixed conversion
        win_odds = (
            candidate.get("market_odds")
            or candidate.get("win_odds")
            or candidate.get("betfair_back_price")
            or horse.get("betfair_back_price")
        )

        if live_place_odds and float(live_place_odds) > 1.0:
            place_odds = round(float(live_place_odds), 2)
            odds_source = "live_market"
            market_odds = place_odds
            derived_odds = None
        elif win_odds and float(win_odds) > 1.0:
            fraction = 0.20 if runners_count >= 8 else 0.25
            place_odds = round(1.0 + (float(win_odds) - 1.0) * fraction, 2)
            odds_source = "tote_converted"
            market_odds = place_odds
            derived_odds = None
        else:
            place_odds = round(1 / place_probability, 2) if place_probability > 0 else 2.0
            odds_source = "harville_derived"
            market_odds = None
            derived_odds = place_odds

        edge = round(place_probability - (1 / place_odds), 4) if place_odds > 0 else 0.0

        # Evaluate runners across the entire field (4th through 10th):
        # Top 3 anchors are included, plus longshot roughies across the field with positive place EV
        if index < 3 or edge > 0:
            candidates.append({
                "sport": "racing",
                "event_id": race["race_id"],
                "event_name": f"{race['venue']} R{race['race_number']}",
                "market_type": "place",
                "selection": selection,
                "model_probability": round(place_probability, 4),
                "market_odds": market_odds,
                "derived_odds": derived_odds,
                "odds_source": odds_source,
                "edge": edge,
                "confidence": confidence_bucket(place_probability, edge),
                "start_time": race.get("start_time"),
                "barrier": candidate.get("barrier") or horse.get("barrier"),
                "weight": candidate.get("weight") or horse.get("weight"),
                "past_win_rate": candidate.get("past_win_rate") or horse.get("past_win_rate"),
                "jockey_win_rate": candidate.get("jockey_win_rate") or horse.get("jockey_win_rate"),
                "track_condition": candidate.get("track_condition") or horse.get("track_condition"),
                "days_since_last_race": candidate.get("days_since_last_race") or horse.get("days_since_last_race"),
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


def build_strategy_card(profile: Dict[str, Any], candidates: List[Dict[str, Any]], run_date: str, selection_usage: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
    rule_set = dict(profile["rule_set"])
    bankroll_available = storage.DEFAULT_PREMIUM_BANKROLL if is_melbourne_premium_day(run_date) else storage.DEFAULT_STANDARD_BANKROLL
    profile_key = profile["profile_key"]

    # Pre-generate multis for multi-oriented profiles so that multis participate in qualification
    candidate_pool = list(candidates)
    if rule_set.get("allow_multis"):
        candidate_pool.extend(build_multi_candidates(candidates, rule_set))

    qualified, skipped = qualify_candidates(candidate_pool, rule_set)
    selected = allocate_candidates(qualified, rule_set, bankroll_available, selection_usage=selection_usage)

    # Empty-card waterfall strictly for aggressive and james profiles
    if len(selected) == 0 and profile_key in ("aggressive", "james"):
        # Tier 2: 2% edge threshold
        relaxed_2pct = dict(rule_set)
        relaxed_2pct["min_edge"] = 0.02
        q2, _ = qualify_candidates(candidates, relaxed_2pct)
        selected = allocate_candidates(q2, relaxed_2pct, bankroll_available, selection_usage=selection_usage)

        # Tier 3: Action Play (best-of-board) guaranteeing >= 1 bet per card
        if len(selected) == 0 and candidates:
            sorted_candidates = sorted(
                candidates,
                key=lambda c: (c.get("edge", 0.0), c.get("model_probability", 0.0)),
                reverse=True,
            )
            action_candidate = sorted_candidates[0]
            action_stake = min(25.0, float(rule_set.get("max_stake_per_bet", 50.0)))
            sel_key = f"{action_candidate['sport']}:{action_candidate['event_id']}:{action_candidate['selection']}"
            if selection_usage is not None:
                selection_usage[sel_key] = selection_usage.get(sel_key, 0) + 1
            selected = [{
                "sport": action_candidate["sport"],
                "event_id": action_candidate["event_id"],
                "event_name": action_candidate["event_name"],
                "market_type": action_candidate["market_type"],
                "selection": action_candidate["selection"],
                "model_probability": action_candidate["model_probability"],
                "odds_used": effective_odds(action_candidate) or 2.0,
                "odds_source": action_candidate["odds_source"],
                "edge": action_candidate.get("edge", 0.0),
                "stake": action_stake,
                "status": "pending",
                "payout": None,
                "profit": None,
                "settled_at": None,
                "writeup": f"Action Play: High-conviction slate pick on {action_candidate['selection']} to ensure active board action.",
            }]

    # Multi profile waterfall to ensure daily betting when games are scheduled
    is_multi_profile = "multi" in profile_key or "sgm" in profile_key
    if len(selected) == 0 and is_multi_profile and rule_set.get("allow_multis"):
        # Tier 2: 1% edge threshold
        relaxed_multi = dict(rule_set)
        relaxed_multi["min_edge"] = 0.01
        q_rel, _ = qualify_candidates(candidate_pool, relaxed_multi)
        selected = allocate_candidates(q_rel, relaxed_multi, bankroll_available, selection_usage=selection_usage)

        # Tier 3: Action Multi (best-of-slate) guaranteeing active board action
        if len(selected) == 0:
            available_multis = [c for c in candidate_pool if c.get("legs") and c.get("market_type") in ("multi", "sgm")]
            if not available_multis:
                available_multis = build_multi_candidates(candidates, rule_set)

            if available_multis:
                available_multis.sort(
                    key=lambda c: (c.get("edge", 0.0), c.get("model_probability", 0.0)),
                    reverse=True,
                )
                action_multi = available_multis[0]
                action_stake = min(25.0, float(rule_set.get("max_stake_per_bet", 50.0)))
                sel_key = f"{action_multi['sport']}:{action_multi['event_id']}:{action_multi['selection']}"
                if selection_usage is not None:
                    selection_usage[sel_key] = selection_usage.get(sel_key, 0) + 1
                selected = [{
                    "sport": action_multi["sport"],
                    "event_id": action_multi["event_id"],
                    "event_name": action_multi["event_name"],
                    "market_type": action_multi["market_type"],
                    "selection": action_multi["selection"],
                    "model_probability": action_multi["model_probability"],
                    "odds_used": effective_odds(action_multi) or 2.0,
                    "odds_source": action_multi["odds_source"],
                    "edge": action_multi.get("edge", 0.0),
                    "stake": action_stake,
                    "status": "pending",
                    "payout": None,
                    "profit": None,
                    "settled_at": None,
                    "writeup": f"Action Multi: Top slate multiple combining {len(action_multi.get('legs', []))} high-conviction legs.",
                    "legs": action_multi.get("legs", []),
                    "odds_sources": action_multi.get("odds_sources", []),
                    "sport_allocation": action_multi.get("sport_allocation", {}),
                }]

    total_allocated = round(sum(bet["stake"] for bet in selected), 2)
    sport_mix = summarize_sport_mix(selected, total_allocated)
    expected_edge = round(sum(bet["edge"] * bet["stake"] for bet in selected) / total_allocated, 4) if total_allocated > 0 else 0.0

    resting_rationale = None
    if len(selected) == 0:
        resting_rationale = PERSONA_RESTING_RATIONALES.get(
            profile_key,
            f"{profile['display_name']} passed today: No selections met the required edge and risk thresholds."
        )

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
        "resting_rationale": resting_rationale,
    }


def qualify_candidates(candidates: List[Dict[str, Any]], rule_set: Dict[str, Any]):
    qualified = []
    skipped = []
    min_confidence = CONFIDENCE_ORDER.get(rule_set.get("min_confidence", "low"), 0)
    allowed_markets = set(rule_set.get("allowed_markets", []))
    min_odds = rule_set.get("min_odds")
    max_odds = rule_set.get("max_odds")

    for candidate in candidates:
        reason = None
        cand_odds = effective_odds(candidate)
        if candidate["market_type"] not in allowed_markets:
            reason = "market not allowed"
        elif candidate["edge"] < float(rule_set.get("min_edge", 0.0)):
            reason = "edge below threshold"
        elif CONFIDENCE_ORDER.get(candidate.get("confidence", "low"), 0) < min_confidence:
            reason = "confidence below threshold"
        elif not cand_odds or cand_odds <= 1.0:
            reason = "missing effective odds"
        elif min_odds is not None and cand_odds < float(min_odds):
            reason = "odds below threshold"
        elif max_odds is not None and cand_odds > float(max_odds):
            reason = "odds above threshold"

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

    ranking_key = rule_set.get("ranking_key", "expected_value")
    if ranking_key == "probability":
        qualified.sort(key=lambda c: (c.get("model_probability", 0.0), c.get("edge", 0.0)), reverse=True)
    elif ranking_key == "kelly":
        qualified.sort(key=lambda c: (suggested_stake(c, 1000.0, rule_set), c.get("edge", 0.0)), reverse=True)
    else:
        qualified.sort(key=lambda c: (c.get("edge", 0.0), c.get("model_probability", 0.0)), reverse=True)

    return qualified, skipped


def allocate_candidates(
    candidates: List[Dict[str, Any]],
    rule_set: Dict[str, Any],
    bankroll_available: float,
    selection_usage: Optional[Dict[str, int]] = None,
    max_overlap: int = 2,
):
    selected = []
    per_sport_cap = {
        sport: bankroll_available * float(rule_set["sport_weights"].get(sport, 0.0))
        for sport in ("racing", "afl", "nba", "nfl")
    }
    per_sport_used = {sport: 0.0 for sport in ("racing", "afl", "nba", "nfl")}
    selection_pool = []

    # Check if this profile is strictly multi-only
    is_multi_only = rule_set.get("allow_multis") and (
        "sgm" in rule_set["profile_key"] or 
        "multi" in rule_set["profile_key"] or
        rule_set.get("allowed_markets") == ["multi", "sgm"]
    )

    if not is_multi_only:
        selection_pool.extend(candidates)
    else:
        selection_pool.extend([c for c in candidates if c.get("legs")])

    if not any(c.get("legs") for c in selection_pool):
        selection_pool.extend(build_multi_candidates(candidates, rule_set))

    ranking_key = rule_set.get("ranking_key", "expected_value")
    if ranking_key == "probability":
        selection_pool.sort(key=lambda c: (c.get("model_probability", 0.0), c.get("edge", 0.0)), reverse=True)
    elif ranking_key == "kelly":
        selection_pool.sort(key=lambda c: (suggested_stake(c, bankroll_available, rule_set), c.get("edge", 0.0)), reverse=True)
    else:
        selection_pool.sort(key=lambda c: (c.get("edge", 0.0), c.get("model_probability", 0.0)), reverse=True)

    max_bets_total = int(rule_set.get("max_bets_per_day", 5))
    sport_weights = rule_set.get("sport_weights", {})
    active_sports = [s for s, w in sport_weights.items() if float(w) > 0]
    is_balanced_card = len(active_sports) > 1 and not is_multi_only
    max_per_sport = {
        s: max(1, math.ceil(max_bets_total * float(w) * 1.5))
        for s, w in sport_weights.items()
    } if is_balanced_card else {}
    sport_bet_counts: Dict[str, int] = {}

    remaining_bankroll = bankroll_available
    selected_head_to_head_events = set()
    selected_multi_events = set()
    selected_single_events = set()
    deferred_for_second_pass = []

    def _try_allocate(candidate: Dict[str, Any], enforce_sport_cap: bool = True) -> bool:
        nonlocal remaining_bankroll
        if len(selected) >= max_bets_total:
            return False

        c_sport = str(candidate.get("sport", "")).lower()
        if enforce_sport_cap and is_balanced_card and c_sport in max_per_sport:
            if sport_bet_counts.get(c_sport, 0) >= max_per_sport[c_sport]:
                deferred_for_second_pass.append(candidate)
                return False

        # Max overlap check: no single candidate in >2 profiles per day
        sel_key = f"{candidate['sport']}:{candidate['event_id']}:{candidate['selection']}"
        if candidate.get("legs"):
            leg_overlap = any(
                selection_usage is not None and selection_usage.get(f"{leg['sport']}:{leg['event_id']}:{leg['selection']}", 0) >= max_overlap
                for leg in candidate["legs"]
            )
            if leg_overlap or (selection_usage is not None and selection_usage.get(sel_key, 0) >= max_overlap):
                return False
        else:
            if selection_usage is not None and selection_usage.get(sel_key, 0) >= max_overlap:
                return False

        candidate_event_ids = _candidate_event_ids(candidate)
        if candidate.get("legs") and candidate_event_ids & (selected_head_to_head_events | selected_multi_events | selected_single_events):
            return False
        if candidate["market_type"] == "head_to_head" and candidate["event_id"] in (selected_head_to_head_events | selected_multi_events):
            return False
        if candidate["market_type"] != "head_to_head" and candidate["event_id"] in selected_multi_events:
            return False

        remaining_sport = _remaining_sport_capacity(candidate, per_sport_cap, per_sport_used)
        if remaining_sport <= 0 or remaining_bankroll <= 0:
            return False

        stake = suggested_stake(candidate, bankroll_available, rule_set)
        if stake <= 0:
            return False
        stake = round(min(stake, float(rule_set["max_stake_per_bet"]), remaining_sport, remaining_bankroll), 2)
        if stake < 1:
            return False

        writeup = generate_bet_writeup(candidate, rule_set.get("profile_key", ""))
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
            "writeup": writeup,
        })
        if candidate.get("legs"):
            selected[-1]["legs"] = candidate["legs"]
        if candidate.get("odds_sources"):
            selected[-1]["odds_sources"] = candidate["odds_sources"]
        if candidate.get("sport_allocation"):
            selected[-1]["sport_allocation"] = candidate["sport_allocation"]

        _consume_sport_capacity(candidate, per_sport_used, stake)
        remaining_bankroll -= stake
        sport_bet_counts[c_sport] = sport_bet_counts.get(c_sport, 0) + 1

        if candidate.get("legs"):
            selected_multi_events.update(candidate_event_ids)
        else:
            selected_single_events.add(candidate["event_id"])
            if candidate["market_type"] == "head_to_head":
                selected_head_to_head_events.add(candidate["event_id"])

        if selection_usage is not None:
            selection_usage[sel_key] = selection_usage.get(sel_key, 0) + 1
            if candidate.get("legs"):
                for leg in candidate["legs"]:
                    lk = f"{leg['sport']}:{leg['event_id']}:{leg['selection']}"
                    selection_usage[lk] = selection_usage.get(lk, 0) + 1
        return True

    # Pass 1: Slate-balanced allocation (ensures NBA/NFL have dedicated capacity)
    for candidate in selection_pool:
        if len(selected) >= max_bets_total:
            break
        _try_allocate(candidate, enforce_sport_cap=True)

    # Pass 2: Fill any remaining open slots from deferred candidates
    if len(selected) < max_bets_total and deferred_for_second_pass:
        for candidate in deferred_for_second_pass:
            if len(selected) >= max_bets_total:
                break
            _try_allocate(candidate, enforce_sport_cap=False)

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
    if kelly_fraction <= 0:
        return 0.0

    profile_key = rule_set.get("profile_key", "")
    kelly_mult = float(rule_set.get("kelly_fraction", 0.25))
    if profile_key == "aggressive":
        kelly_mult = 0.75
    elif profile_key == "conservative":
        kelly_mult = 0.20
    elif profile_key == "roughies_only":
        kelly_mult = 0.10

    stake = bankroll_available * kelly_mult * kelly_fraction

    if profile_key == "aggressive":
        max_stake = min(float(rule_set.get("max_stake_per_bet", 250.0)), 250.0)
        if candidate.get("edge", 0.0) >= 0.04 and stake > 0:
            stake = max(stake, 50.0)
        stake = min(stake, max_stake)
    elif profile_key == "conservative":
        max_stake = min(float(rule_set.get("max_stake_per_bet", 40.0)), 40.0)
        stake = min(stake, max_stake)
    elif profile_key == "roughies_only":
        max_stake = min(float(rule_set.get("max_stake_per_bet", 20.0)), 20.0)
        stake = min(stake, max_stake)
    else:
        max_stake = float(rule_set.get("max_stake_per_bet", 100.0))
        stake = min(stake, max_stake)

    return round(stake, 2)


def effective_odds(candidate: Dict[str, Any]) -> Optional[float]:
    odds = candidate.get("market_odds") or candidate.get("derived_odds")
    if odds is None:
        return None
    return round(float(odds), 2)


def confidence_bucket(probability: float, edge: float = 0.0) -> str:
    if probability >= 0.50:
        return "high"
    if probability >= 0.30:
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
        if sport in {"racing", "afl", "nba", "nfl"}:
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


import logging
logger = logging.getLogger(__name__)

from app.sgm import calculate_sgm_odds

def build_sgm_candidate(legs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not legs:
        return None
    sport = str(legs[0].get("sport", "")).strip().lower()
    
    model_legs = []
    market_legs = []
    sport_counts: Dict[str, int] = {}
    normalized_legs = []

    for index, leg in enumerate(legs, start=1):
        leg_odds = effective_odds(leg)
        if not leg_odds:
            return None
            
        leg_market = str(leg.get("market_type", "head_to_head"))
        # Price using the model's derived probability
        model_legs.append({
            "probability": _clamp_probability(leg.get("model_probability", 1 / leg_odds)),
            "market_type": leg_market
        })
        # Price using market offered odds
        market_legs.append({
            "odds": leg_odds,
            "market_type": leg_market
        })

        leg_sport = str(leg.get("sport", "")).strip().lower()
        if leg_sport in {"racing", "afl", "nba", "nfl"}:
            sport_counts[leg_sport] = sport_counts.get(leg_sport, 0) + 1
            
        normalized_legs.append(
            {
                "sport": leg_sport or "multi",
                "event_id": str(leg.get("event_id", f"leg-{index}")),
                "event_name": str(leg.get("event_name", leg.get("selection", f"Leg {index}"))),
                "market_type": leg_market,
                "selection": str(leg.get("selection", f"Leg {index}")),
                "odds_used": leg_odds,
                "odds_source": leg["odds_source"],
            }
        )

    try:
        model_pricing = calculate_sgm_odds(model_legs, sport)
        market_pricing = calculate_sgm_odds(market_legs, sport)
    except Exception as e:
        logger.error(f"SGM pricing failed: {e}")
        return None

    combined_probability = model_pricing["adjusted_probability"]
    odds = market_pricing.get("adjusted_odds") or market_pricing.get("market_haircut_odds")
    if not odds or odds <= 1.0:
        odds = model_pricing.get("fair_odds", 2.0)
    implied_probability = round(1.0 / odds, 4) if odds > 0 else market_pricing["adjusted_probability"]
    
    odds_sources = [leg["odds_source"] for leg in normalized_legs]
    leg_count = len(normalized_legs)
    combined_edge = round(combined_probability - implied_probability, 4)
    
    sport_allocation = {sport: 1.0} if sport in {"racing", "afl", "nba", "nfl"} else {}
    return {
        "sport": sport or "sgm",
        "sport_allocation": sport_allocation,
        "event_id": f"sgm:{'|'.join(leg['event_id'] for leg in normalized_legs)}",
        "event_name": normalized_legs[0]["event_name"] if len({l["event_name"] for l in normalized_legs}) == 1 else " + ".join(leg["event_name"] for leg in normalized_legs),
        "market_type": "sgm",
        "selection": " + ".join(leg["selection"] for leg in normalized_legs),
        "model_probability": round(combined_probability, 4),
        "market_odds": None,
        "derived_odds": round(odds, 2),
        "odds_source": odds_sources[0] if len(set(odds_sources)) == 1 else "composite",
        "edge": combined_edge,
        "confidence": confidence_bucket(combined_probability, combined_edge),
        "legs": normalized_legs,
        "sport_allocation": {
            s: round(count / leg_count, 4)
            for s, count in sport_counts.items()
        },
        "odds_used": round(odds, 2),
        "odds_sources": odds_sources,
        "correlation_score": model_pricing.get("correlation_score"),
        "correlation_index": model_pricing.get("correlation_index"),
        "health_grade": model_pricing.get("health_grade"),
        "health_score": model_pricing.get("health_score"),
        "scored_legs": model_pricing.get("scored_legs"),
        "bookie_comparison": model_pricing.get("bookie_comparison"),
    }


def build_multi_candidates(candidates: List[Dict[str, Any]], rule_set: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not rule_set.get("allow_multis"):
        return []

    max_multi_legs = max(2, int(rule_set.get("max_multi_legs", 1)))
    active_sports = {sport for sport, weight in rule_set.get("sport_weights", {}).items() if float(weight) > 0}
    eligible = [
        candidate for candidate in candidates 
        if not candidate.get("legs") 
        and _candidate_supports_multi_settlement(candidate)
        and (not active_sports or str(candidate.get("sport", "")).strip().lower() in active_sports)
    ]
    if len(eligible) < 2:
        return []

    # Group eligible candidates by event_id for SGM vs cross-event multis
    by_event: Dict[str, List[Dict[str, Any]]] = {}
    for c in eligible:
        eid = str(c.get("event_id", "")).strip()
        by_event.setdefault(eid, []).append(c)

    multis = []
    # 1. SGM generation: Group candidates per event before combinatorial building
    for event_id, event_candidates in by_event.items():
        if len(event_candidates) >= 2:
            event_candidates.sort(key=lambda x: (x.get("edge", 0), x.get("model_probability", 0)), reverse=True)
            top_event_candidates = event_candidates[:6]
            for leg_count in range(2, min(max_multi_legs, len(top_event_candidates)) + 1):
                for legs in combinations(top_event_candidates, leg_count):
                    try:
                        sgm = build_sgm_candidate(list(legs))
                        if sgm and sgm["edge"] > 0:
                            multis.append(sgm)
                    except Exception as e:
                        logger.error(f"Failed to build SGM for event {event_id}: {e}")

    # 2. Traditional Cross-Event Multi generation: Take top candidate per distinct event
    cross_event_candidates = []
    for event_id, event_candidates in by_event.items():
        event_candidates.sort(key=lambda x: (x.get("edge", 0), x.get("model_probability", 0)), reverse=True)
        cross_event_candidates.append(event_candidates[0])

    cross_event_candidates.sort(key=lambda x: (x.get("edge", 0), x.get("model_probability", 0)), reverse=True)
    top_cross = cross_event_candidates[:10]
    for leg_count in range(2, min(max_multi_legs, len(top_cross)) + 1):
        for legs in combinations(top_cross, leg_count):
            try:
                event_ids = {leg["event_id"] for leg in legs}
                if len(event_ids) == leg_count:
                    multi = build_multi_candidate(list(legs))
                    if multi and multi["edge"] > 0:
                        multis.append(multi)
            except Exception as e:
                logger.error(f"Failed to build cross-event multi: {e}")

    # 3. Deliberate Cross-Sport Multi Generation (Sport + Racing Mix)
    # Pairs high-confidence US Sport anchors (NBA/NFL) with top Metro Racing bankers
    sport_legs = [c for c in cross_event_candidates if str(c.get("sport", "")).lower() in ("nba", "nfl", "afl")]
    racing_legs = [c for c in cross_event_candidates if str(c.get("sport", "")).lower() == "racing"]
    if sport_legs and racing_legs and max_multi_legs >= 2:
        for s_leg in sport_legs[:4]:
            for r_leg in racing_legs[:4]:
                if s_leg.get("event_id") != r_leg.get("event_id"):
                    try:
                        cross_multi = build_multi_candidate([s_leg, r_leg])
                        if cross_multi and cross_multi.get("edge", 0) > 0:
                            multis.append(cross_multi)
                    except Exception as e:
                        logger.error(f"Failed to build cross-sport multi: {e}")

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
            if sport in {"racing", "afl", "nba", "nfl"} and float(weight) > 0
        }
    sport = candidate.get("sport")
    if sport in {"racing", "afl", "nba", "nfl"}:
        return {sport: 1.0}
    return {}


def _candidate_supports_multi_settlement(candidate: Dict[str, Any]) -> bool:
    sport = str(candidate.get("sport", "")).strip().lower()
    market_type = str(candidate.get("market_type", "")).strip().lower()
    return (
        (sport == "racing" and market_type == "win") or
        (sport in {"afl", "nba", "nfl"} and market_type in {"head_to_head", "spread", "total_points", "player_prop"})
    )


def _remaining_sport_capacity(candidate: Dict[str, Any], per_sport_cap: Dict[str, float], per_sport_used: Dict[str, float]) -> float:
    allocation = _candidate_sport_allocation(candidate)
    if not allocation:
        return 0.0
    limits = []
    for sport, weight in allocation.items():
        cap = per_sport_cap.get(sport, 999999.0)
        used = per_sport_used.get(sport, 0.0)
        remaining = cap - used
        limits.append(remaining / weight if weight > 0 else 0.0)
    return min(limits) if limits else 0.0


def _consume_sport_capacity(candidate: Dict[str, Any], per_sport_used: Dict[str, float], stake: float) -> None:
    for sport, weight in _candidate_sport_allocation(candidate).items():
        per_sport_used[sport] = per_sport_used.get(sport, 0.0) + (stake * weight)


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


def recommend_custom_multi(
    candidates: List[Dict[str, Any]],
    win_legs: int = 1,
    place_legs: int = 2,
    sport_mode: str = "combined",
    min_odds: float = 2.0,
    max_odds: float = 50.0,
    after_time: Optional[str] = None,
    current_legs: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    current_legs = current_legs or []
    used_event_ids = {
        str(leg.get("event_id")).strip()
        for leg in current_legs
        if leg.get("event_id")
    }

    # Count existing win and place legs in current_legs
    current_win_count = sum(
        1 for leg in current_legs
        if str(leg.get("market_type", "")).lower() != "place"
    )
    current_place_count = sum(
        1 for leg in current_legs
        if str(leg.get("market_type", "")).lower() == "place"
    )

    needed_win = max(0, int(win_legs) - current_win_count)
    needed_place = max(0, int(place_legs) - current_place_count)

    # Cutoff time filtering
    cutoff_dt = None
    if after_time:
        raw = str(after_time).strip()
        try:
            if ":" in raw and "T" not in raw and "-" not in raw:
                parts = [int(p) for p in raw.split(":")]
                cutoff_dt = now_melbourne().replace(hour=parts[0], minute=parts[1], second=0, microsecond=0)
            else:
                cutoff_dt = to_melbourne_datetime(raw)
        except Exception:
            cutoff_dt = None

    # Filter candidate pool
    filtered_candidates: List[Dict[str, Any]] = []
    sport_mode_clean = (sport_mode or "combined").lower()

    for c in candidates:
        event_id = str(c.get("event_id", "")).strip()
        if not event_id or event_id in used_event_ids:
            continue

        c_sport = str(c.get("sport", "")).lower()
        if sport_mode_clean == "racing_only" and c_sport != "racing":
            continue
        if sport_mode_clean == "sport_only" and c_sport == "racing":
            continue

        if cutoff_dt and c.get("start_time"):
            try:
                c_dt = to_melbourne_datetime(c["start_time"])
                if c_dt < cutoff_dt:
                    continue
            except Exception:
                pass

        odds_val = effective_odds(c)
        if not odds_val or odds_val <= 1.0:
            continue

        filtered_candidates.append(c)

    # Separate into win and place candidate pools
    win_pool = [
        c for c in filtered_candidates
        if str(c.get("market_type", "")).lower() != "place"
    ]
    place_pool = [
        c for c in filtered_candidates
        if str(c.get("market_type", "")).lower() == "place"
    ]

    # Sort each pool by edge descending, then model probability
    win_pool.sort(key=lambda c: (float(c.get("edge", 0.0)), float(c.get("model_probability", 0.0))), reverse=True)
    place_pool.sort(key=lambda c: (float(c.get("edge", 0.0)), float(c.get("model_probability", 0.0))), reverse=True)

    # Normalize existing current legs
    normalized_current = []
    current_combined_odds = 1.0
    current_combined_prob = 1.0
    for leg in current_legs:
        l_odds = effective_odds(leg) or 1.0
        l_prob = _clamp_probability(leg.get("model_probability", 1.0 / l_odds if l_odds > 1 else 0.5))
        current_combined_odds *= l_odds
        current_combined_prob *= l_prob
        normalized_current.append({
            "sport": leg.get("sport", "multi"),
            "event_id": str(leg.get("event_id", "")),
            "event_name": str(leg.get("event_name", leg.get("selection", "Leg"))),
            "market_type": str(leg.get("market_type", "win")),
            "selection": str(leg.get("selection", "Selection")),
            "odds_used": round(l_odds, 2),
            "odds_source": leg.get("odds_source", "user_slip"),
            "model_probability": round(l_prob, 4),
            "edge": round(float(leg.get("edge", 0.0)), 4),
            "confidence": leg.get("confidence", "medium"),
            "start_time": leg.get("start_time"),
        })

    candidate_multis: List[Dict[str, Any]] = []

    # If needed_win == 0 and needed_place == 0 and len(normalized_current) >= 2:
    if needed_win == 0 and needed_place == 0 and len(normalized_current) >= 2:
        comb_edge = round(current_combined_prob - (1.0 / current_combined_odds), 4)
        candidate_multis.append({
            "id": "rec-multi-slip",
            "event_id": f"multi:{'|'.join(leg['event_id'] for leg in normalized_current)}",
            "event_name": " + ".join(leg["event_name"] for leg in normalized_current),
            "market_type": "multi",
            "selection": " + ".join(f"{leg['selection']} ({leg['market_type'].capitalize()})" for leg in normalized_current),
            "odds": round(current_combined_odds, 2),
            "true_prob": round(current_combined_prob, 4),
            "model_probability": round(current_combined_prob, 4),
            "edge": comb_edge,
            "expected_value": round(current_combined_prob * current_combined_odds - 1.0, 4),
            "confidence": confidence_bucket(current_combined_prob, comb_edge),
            "legs": normalized_current,
            "win_legs_count": current_win_count,
            "place_legs_count": current_place_count,
            "writeup": f"Current Slip Multi: {len(normalized_current)} legs with {round(comb_edge * 100, 1)}% combined edge.",
        })

    # Sub-pools for combination search
    win_subpool = win_pool[:12]
    place_subpool = place_pool[:12]

    win_combos = list(combinations(win_subpool, needed_win)) if needed_win > 0 else [()]
    place_combos = list(combinations(place_subpool, needed_place)) if needed_place > 0 else [()]

    for w_combo in win_combos:
        w_events = {c["event_id"] for c in w_combo}
        if len(w_events) != len(w_combo):
            continue

        for p_combo in place_combos:
            p_events = {c["event_id"] for c in p_combo}
            if len(p_events) != len(p_combo):
                continue

            if w_events & p_events:
                continue

            all_new_legs = list(w_combo) + list(p_combo)
            if not all_new_legs and not normalized_current:
                continue

            total_odds = current_combined_odds
            total_prob = current_combined_prob
            norm_new_legs = []

            for leg in all_new_legs:
                l_odds = effective_odds(leg) or 1.0
                l_prob = _clamp_probability(leg.get("model_probability", 1.0 / l_odds))
                total_odds *= l_odds
                total_prob *= l_prob
                norm_new_legs.append({
                    "sport": leg.get("sport", "racing"),
                    "event_id": str(leg.get("event_id", "")),
                    "event_name": str(leg.get("event_name", leg.get("selection", "Leg"))),
                    "market_type": str(leg.get("market_type", "win")),
                    "selection": str(leg.get("selection", "Selection")),
                    "odds_used": round(l_odds, 2),
                    "odds_source": leg.get("odds_source", "derived"),
                    "model_probability": round(l_prob, 4),
                    "edge": round(float(leg.get("edge", 0.0)), 4),
                    "confidence": leg.get("confidence", "medium"),
                    "start_time": leg.get("start_time"),
                })

            combined_legs = normalized_current + norm_new_legs
            if len(combined_legs) < 2:
                continue

            if not (min_odds <= total_odds <= max_odds):
                continue

            comb_edge = round(total_prob - (1.0 / total_odds), 4)
            ev = round(total_prob * total_odds - 1.0, 4)

            w_count = current_win_count + len(w_combo)
            p_count = current_place_count + len(p_combo)

            writeup_parts = []
            if w_count:
                writeup_parts.append(f"{w_count} Win Anchor{'s' if w_count > 1 else ''}")
            if p_count:
                writeup_parts.append(f"{p_count} Place Roughie{'s' if p_count > 1 else ''}")
            formula_desc = " + ".join(writeup_parts)
            writeup = f"Strategic Multi ({formula_desc}): {len(combined_legs)} legs @ ${total_odds:.2f} ({round(comb_edge * 100, 1)}% Edge, {round(ev * 100, 1)}% EV)."

            candidate_multis.append({
                "id": f"rec-multi-{len(candidate_multis) + 1}",
                "event_id": f"multi:{'|'.join(leg['event_id'] for leg in combined_legs)}",
                "event_name": " + ".join(leg["event_name"] for leg in combined_legs),
                "market_type": "multi",
                "selection": " + ".join(f"{leg['selection']} ({leg['market_type'].capitalize()})" for leg in combined_legs),
                "odds": round(total_odds, 2),
                "true_prob": round(total_prob, 4),
                "model_probability": round(total_prob, 4),
                "edge": comb_edge,
                "expected_value": ev,
                "confidence": confidence_bucket(total_prob, comb_edge),
                "legs": combined_legs,
                "win_legs_count": w_count,
                "place_legs_count": p_count,
                "writeup": writeup,
            })

    # Sort multis by edge descending, then expected value
    candidate_multis.sort(key=lambda m: (m["edge"], m["expected_value"]), reverse=True)
    top_multis = candidate_multis[:3]

    # If no multis matched strict odds range, relax bounds so recommendations are always provided
    if not top_multis and (win_pool or place_pool):
        all_pool_candidates = win_pool[:6] + place_pool[:6]
        target_legs = max(2, (needed_win + needed_place) or 2)
        combos = list(combinations(all_pool_candidates, min(len(all_pool_candidates), target_legs)))
        fallback_multis = []
        for combo in combos[:15]:
            events = {c["event_id"] for c in combo}
            if len(events) != len(combo):
                continue
            total_odds = current_combined_odds
            total_prob = current_combined_prob
            c_legs = []
            for leg in combo:
                l_odds = effective_odds(leg) or 1.0
                l_prob = _clamp_probability(leg.get("model_probability", 1.0 / l_odds))
                total_odds *= l_odds
                total_prob *= l_prob
                c_legs.append({
                    "sport": leg.get("sport", "racing"),
                    "event_id": str(leg.get("event_id", "")),
                    "event_name": str(leg.get("event_name", leg.get("selection", "Leg"))),
                    "market_type": str(leg.get("market_type", "win")),
                    "selection": str(leg.get("selection", "Selection")),
                    "odds_used": round(l_odds, 2),
                    "odds_source": leg.get("odds_source", "derived"),
                    "model_probability": round(l_prob, 4),
                    "edge": round(float(leg.get("edge", 0.0)), 4),
                    "confidence": leg.get("confidence", "medium"),
                    "start_time": leg.get("start_time"),
                })
            all_l = normalized_current + c_legs
            if len(all_l) < 2:
                continue
            comb_edge = round(total_prob - (1.0 / total_odds), 4)
            ev = round(total_prob * total_odds - 1.0, 4)
            fallback_multis.append({
                "id": f"rec-multi-fallback-{len(fallback_multis) + 1}",
                "event_id": f"multi:{'|'.join(leg['event_id'] for leg in all_l)}",
                "event_name": " + ".join(leg["event_name"] for leg in all_l),
                "market_type": "multi",
                "selection": " + ".join(f"{leg['selection']} ({leg['market_type'].capitalize()})" for leg in all_l),
                "odds": round(total_odds, 2),
                "true_prob": round(total_prob, 4),
                "model_probability": round(total_prob, 4),
                "edge": comb_edge,
                "expected_value": ev,
                "confidence": confidence_bucket(total_prob, comb_edge),
                "legs": all_l,
                "win_legs_count": sum(1 for l in all_l if l["market_type"] != "place"),
                "place_legs_count": sum(1 for l in all_l if l["market_type"] == "place"),
                "writeup": f"Optimal Multi Pick: {len(all_l)} legs @ ${total_odds:.2f}.",
            })
        fallback_multis.sort(key=lambda m: (m["edge"], m["expected_value"]), reverse=True)
        top_multis = fallback_multis[:3]

    # Booster legs (top 5 single complementary legs)
    booster_legs = []
    seen_booster_events = set(used_event_ids)
    all_booster_pool = place_pool + win_pool
    for cand in all_booster_pool:
        ev_id = str(cand.get("event_id", ""))
        if ev_id in seen_booster_events:
            continue
        cand_odds = effective_odds(cand) or 1.0
        if cand_odds <= 1.0:
            continue
        cand_prob = _clamp_probability(cand.get("model_probability", 1.0 / cand_odds))
        cand_edge = round(float(cand.get("edge", cand_prob - (1.0 / cand_odds))), 4)

        if current_legs:
            b_odds = round(current_combined_odds * cand_odds, 2)
            b_prob = current_combined_prob * cand_prob
            b_edge = round(b_prob - (1.0 / b_odds), 4)
            b_ev = round(b_prob * b_odds - 1.0, 4)
            market_label = "Place" if str(cand.get("market_type")).lower() == "place" else "Win"
            reason = f"Pair with {cand.get('selection')} to {market_label} for ${b_odds:.2f} combined ({round(b_ev * 100, 1):+0.1f}% EV)"
        else:
            b_odds = cand_odds
            b_edge = cand_edge
            market_label = "Place" if str(cand.get("market_type")).lower() == "place" else "Win"
            reason = f"{market_label} Value Play @ ${cand_odds:.2f} ({round(cand_edge * 100, 1):+0.1f}% Edge)"

        seen_booster_events.add(ev_id)
        booster_legs.append({
            "sport": cand.get("sport", "racing"),
            "event_id": ev_id,
            "event_name": cand.get("event_name", cand.get("selection", "Event")),
            "market_type": cand.get("market_type", "place"),
            "selection": cand.get("selection", "Selection"),
            "odds": cand_odds,
            "model_probability": round(cand_prob, 4),
            "edge": cand_edge,
            "confidence": cand.get("confidence", "medium"),
            "start_time": cand.get("start_time"),
            "boost_odds": b_odds,
            "boost_edge": b_edge,
            "recommendation_reason": reason,
        })
        if len(booster_legs) >= 5:
            break

    return {
        "multis": top_multis,
        "booster_legs": booster_legs,
    }
