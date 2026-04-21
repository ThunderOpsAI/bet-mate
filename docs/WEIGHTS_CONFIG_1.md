# BetMate ML Weights Configuration

## Purpose

This document defines the current ML prediction weights for Racing, AFL, and NBA.

**These weights are frozen until auto-tune has sufficient data (30+ settled results per sport).**

After auto-tune runs, weights will be adjusted based on actual prediction accuracy. Until then, these manually configured weights represent the owner's domain expertise.

---

## Racing Weights

### Base Factors (percentage contributions)

| Factor | Weight | Notes |
|--------|--------|-------|
| Speed rating | 15% | Historical speed performance adjusted for track/distance |
| Horse win rate | 10% | Win percentage over last 12 months |
| Jockey win rate | 5% | Jockey's recent form (last 30 days) |
| Track conditions | 8% | Track rating match to horse's preferred conditions |
| Recent form | 8% | Last 3 runs, recency-weighted |
| Barrier position | -3% penalty | Linear penalty for wide barriers (8+) |
| Carry weight | -3% penalty | Penalty for weight >54kg |
| Class level | 4% | Class step-up/step-down factor |

### Combination Multipliers

| Combination | Multiplier | Why |
|-------------|------------|-----|
| Horse-Jockey proven combo | 2.0x | Significant edge when horse + jockey have won together before |
| Jockey-Trainer combo | 1.5x | Proven stable relationship bonus |

### Formula

```
base_score = 
  (speed_rating * 0.15) +
  (horse_win_rate * 0.10) +
  (jockey_win_rate * 0.05) +
  (track_condition_match * 0.08) +
  (recent_form_score * 0.08) +
  (class_factor * 0.04) -
  (barrier_penalty * 0.03) -
  (weight_penalty * 0.03)

combination_multiplier = 
  (1.0 + horse_jockey_proven * 1.0) *  // 2.0x if proven combo
  (1.0 + jockey_trainer_proven * 0.5)   // 1.5x if proven combo

final_score = base_score * combination_multiplier
```

### Data Requirements

- Speed rating: Requires historical sectional times or published speed maps
- Horse-jockey proven combo: TRUE if horse + jockey have won together in last 12 months
- Jockey-trainer proven combo: TRUE if jockey + trainer have 20%+ strike rate together
- Track condition match: Compare today's track rating to horse's historical best performances
- Recent form: Weight last 3 runs: most recent 50%, second 30%, third 20%

---

## NBA Weights

### Base Factors

| Factor | Weight | Notes |
|--------|--------|-------|
| Offensive rating | 20% | Team's offensive efficiency (points per 100 possessions) |
| Defensive rating | 20% | Team's defensive efficiency (opponent points per 100 possessions) |
| Recent form (last 10) | 15% | Win rate + point differential in last 10 games |
| Head-to-head matchups | 10% | Historical performance vs this opponent (season + last season) |
| Usage rates | 10% | Key player usage % and availability |
| Live odds signal | 15% | Market consensus as a credibility check |
| Home court advantage | Variable | 5% generally, 10% for Toronto (international travel) |

### Multipliers

| Factor | Multiplier | Why |
|--------|------------|-----|
| Back-to-back games | 0.85x | Playing second night of back-to-back, significant fatigue |
| Player rest | Hard to measure | Track manually if key player sat previous game |

### Formula

```
base_score = 
  (off_rating_differential * 0.20) +
  (def_rating_differential * 0.20) +
  (recent_form_last_10 * 0.15) +
  (head_to_head_factor * 0.10) +
  (usage_rate_availability * 0.10) +
  (live_odds_signal * 0.15) +
  (home_court_bonus * home_factor)

home_factor = 
  0.10 if (team == Toronto and opponent_from_us) or (team_from_us and opponent == Toronto)
  else 0.05

back_to_back_multiplier = 
  0.85 if team_playing_b2b
  else 1.0

final_score = base_score * back_to_back_multiplier
```

### Data Requirements

- Off/Def rating: Use NBA.com advanced stats or Basketball Reference
- Recent form: Last 10 games win% + average point differential
- Head-to-head: Season series record + point differentials
- Usage rates: Sum of top 3 players' usage % when available
- Live odds signal: Implied probability from current market odds (if available)
- Back-to-back: Check if team played yesterday
- Toronto travel: International border crossing = extra fatigue/logistics

### Notes on Live Odds

**Live odds weight is 15% — this is intentional.**

The market has information we don't (injuries, lineup changes, betting sharp money). Use live odds as a credibility check:
- If model heavily disagrees with market, reduce confidence
- If model aligns with market, increase confidence
- Live odds help catch data gaps in the model

---

## AFL Weights

### Base Factors

| Factor | Weight | Notes |
|--------|--------|-------|
| Points for/against differential | 25% | Season-long offensive/defensive performance |
| Squiggle consensus signal | 25% | Squiggle aggregates multiple models, proven accuracy |
| Recent form | 20% | Last 5 games win% + margin |
| Win streak differential | 15% | Momentum factor when one team streaking |
| Home advantage | Variable | 10% for travel-intensive matchups, 5% otherwise |

### Travel-Adjusted Home Advantage

| Scenario | Home Advantage | Why |
|----------|---------------|-----|
| West Coast, Brisbane, Adelaide vs Melbourne team (at home) | 10% | Opponent travels 3000+ km, timezone, unfamiliar ground |
| Melbourne team vs West Coast, Brisbane, Adelaide (away) | -10% penalty | Melbourne team disadvantaged by travel |
| Standard home game (same state) | 5% | Normal home ground advantage |

### Formula

```
base_score = 
  (points_differential * 0.25) +
  (squiggle_signal * 0.25) +
  (recent_form_last_5 * 0.20) +
  (win_streak_differential * 0.15) +
  (home_advantage * travel_factor)

travel_factor = 
  0.10 if (home_team in [West Coast, Brisbane, Adelaide, Fremantle] and away_team_from == Melbourne) or
          (away_team in [West Coast, Brisbane, Adelaide, Fremantle] and home_team_from == Melbourne)
  else 0.05

final_score = base_score
```

### Data Requirements

- Points for/against: Season average points scored vs points conceded
- Squiggle signal: Import from Squiggle API (free for non-commercial use)
- Recent form: Last 5 games win% + average winning margin
- Win streak: Current win streak length for both teams
- Travel factor: Distance between home grounds + timezone difference

### Notes on Squiggle

Squiggle is a proven AFL predictor that aggregates multiple models. Using it at 25% weight means we're leveraging existing expertise while still building our own edge through other factors.

---

## Weight Freeze Until Auto-Tune

**These weights are fixed until auto-tune conditions are met:**

- 30+ settled results per sport
- 2+ weekly retrains completed
- Calibration metrics stable

Once auto-tune runs, it will:
1. Compare predicted probabilities to actual outcomes
2. Identify which factors over/under-predicted
3. Adjust weights to minimize prediction error
4. Generate a changelog explaining the changes

**Do not manually adjust these weights based on early results.** 

A small sample (e.g., 10 results) will show random noise, not true signal. Trust the auto-tune process.

---

## Implementation Notes for Agents

When implementing these weights in the ML engine:

1. **Normalize all factors to 0-1 scale** before applying weights
2. **Missing data** should default to neutral (0.5) not zero
3. **Log all intermediate calculations** for debugging
4. **Store the weight version** with each prediction for reproducibility

Example implementation:
```python
# services/ml-engine/src/config/weights.py

RACING_WEIGHTS = {
    "speed_rating": 0.15,
    "horse_win_rate": 0.10,
    "jockey_win_rate": 0.05,
    "track_conditions": 0.08,
    "recent_form": 0.08,
    "barrier_penalty": -0.03,
    "weight_penalty": -0.03,
    "class_factor": 0.04,
}

RACING_MULTIPLIERS = {
    "horse_jockey_combo": 2.0,
    "jockey_trainer_combo": 1.5,
}

NBA_WEIGHTS = {
    "off_rating": 0.20,
    "def_rating": 0.20,
    "recent_form_10": 0.15,
    "head_to_head": 0.10,
    "usage_rates": 0.10,
    "live_odds_signal": 0.15,
    "home_court": 0.05,  # base, adjusted by travel
}

NBA_MULTIPLIERS = {
    "back_to_back": 0.85,
}

AFL_WEIGHTS = {
    "points_differential": 0.25,
    "squiggle_signal": 0.25,
    "recent_form_5": 0.20,
    "win_streak": 0.15,
    "home_advantage": 0.05,  # base, adjusted by travel
}

AFL_TRAVEL_BONUS = {
    "interstate_long": 0.10,  # WA, QLD, SA vs VIC
    "standard_home": 0.05,
}

WEIGHTS_VERSION = "v1.0_manual_2026-04-21"
```

---

## Why These Weights Matter

**Racing:** Combination multipliers (horse-jockey, jockey-trainer) capture proven partnerships that stats alone can't see. Speed rating and form are foundational, but the magic is in the combos.

**NBA:** Live odds at 15% keeps the model honest. The market knows things we don't (lineup changes, locker room dynamics, sharp money). Back-to-back fatigue is real and quantifiable.

**AFL:** Squiggle at 25% acknowledges we're not reinventing the wheel. Travel factor at 10% for interstate games reflects the real exhaustion of 3+ hour flights and timezone changes.

These weights come from domain expertise, not arbitrary LLM guesses. They'll be refined by auto-tune once we have data, but they're a smart starting point.
