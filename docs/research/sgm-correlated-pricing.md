# Constructing and pricing Same Game Multis (SGMs) with correlated legs

Resolves [#65](https://github.com/ThunderOpsAI/bet-mate/issues/65) (part of map [#59](https://github.com/ThunderOpsAI/bet-mate/issues/59)).

## TL;DR

Work out the **true joint probability** with a Gaussian copula over our **model** leg probabilities, using a **signed, direction-aware** correlation for each pair of legs. Then score it against a **conservative estimate of what the bookmaker would offer**: the product of the de-vigged leg prices, correlation-adjusted with the *same* copula, then cut by an explicit **SGM margin** (default 18%, set per sport). Only keep an SGM if its EV clears the margin **and** every leg is +edge on its own. Correlation alone can never create edge, because the bookmaker prices correlation too.

## 1. How bookmakers price SGMs

- They don't multiply leg odds. Legs in the same game are dependent, so books model the joint outcome (typically copulas or a simulation of the game). Then they apply a "correlation tax" on top of the per-leg margin. Industry write-ups put SGM/bet-builder hold at about **15–25%**, against about 4–5% on single NBA/NFL sides and totals (bettorsearch.com, oddspapi.io SGP explainers, found via web search 2026-10-30).
- The book takes correlation into account, so a positively correlated combo (e.g. *Team A win + Team A −5.5*) pays **less** than the product of the legs. Correlation alone is not an edge. Any edge has to come from leg marginals that the book has mispriced, or from the book under-estimating correlation, and we can't see the second case without the book's real SGM price.
- **Data availability:** The Odds API (our feed) returns per-event markets and props (`/v4/sports/{sport}/events/{eventId}/odds`) but has **no SGM/parlay pricing endpoint** (the-odds-api.com docs). Real SGM quotes exist only in paid parlay APIs (OpticOdds `/parlay/odds`, BoltOdds, OddsBlaze). So for now **every SGM "offered price" we show is an estimate** and must be labelled that way.

## 2. What the current code does (and what's wrong)

`services/prediction-engine/app/strategy.py::build_sgm_candidate` calls `app/sgm.py::calculate_sgm_odds` twice:

- once on model probabilities → `combined_probability` (copula joint),
- once on market odds (as 1/odds) → `implied_probability`, `odds = adjusted_odds`.

Problems:

1. **The "offered price" is made up and has no margin.** `odds` is `1 / copula(market implied probs)`, which is a fair-ish price nobody actually quotes. It takes out no SGM margin (15–25% in reality), so `edge = p_model − p_market_copula` is inflated. Most SGMs that pass `edge > 0` in `build_multi_candidates` would be −EV at a real book.
2. **Edge is just leg edge pushed through a shared matrix.** The same correlation matrix goes on both sides, so correlation mostly cancels. What's left is "sum of leg edges", inflated by the missing margin.
3. **Correlation ignores direction.** `get_pairwise_correlation(market_a, market_b)` keys only on the market *type*. *Team A h2h + Team B spread* gets +0.14, but should be about −0.9 (contradictory legs). *Over + Under* gets 1.0.
4. **Same market type ⇒ ρ = 1.0.** Two `player_points` legs on different players get ρ = 1, which badly inflates the joint probability. Two h2h legs (both teams) also get 1.0 when they should be impossible together.
5. **Unknown pairs fall back to +0.10** (`DEFAULT_CORRELATION_FALLBACK`). That's a quiet upward bias.
6. Values in `SPORT_CORRELATION_MATRIX` are hand-set. Some, like `head_to_head`/`spread` = 0.14, are far too low: a winner and its own spread cover are typically ρ≈0.7–0.9 on the latent scale. AFL uses `line`, but the multi gate accepts `spread`, so AFL pairs never match a key and drop to the fallback.

## 3. Recommended method for `build_sgm_candidate`

**Step 0. Leg compatibility (reject before pricing).** Reject an SGM if: two legs are opposite sides of the same market (same `market_type` and same `line`/player, opposite side), or both h2h sides are included, or it duplicates a player-prop line. Allow at most one leg per (market_type, subject).

**Step 1. Signed latent correlation per pair.**
`rho_ij = base_rho(sport, market_i, market_j, relation) × side_i × side_j`
- `relation` ∈ {`same_team`, `opp_team`, `same_player`, `teammate`, `game`}, taken from leg `team`/`player` fields.
- `side` = +1 for the "home/over/yes/selected team" orientation, −1 otherwise. For example, h2h on team X = +1 if X is the reference team. Over = +1, Under = −1.
- Unknown pair ⇒ **0.0** (not 0.10). Same market type, different subject ⇒ use the table entry for `teammate` or `opp_team`, never 1.0.
- Keep the existing PSD repair in `build_correlation_matrix`.

**Step 2. True joint probability.** `p_joint = copula(p_model_i, R)` using the existing `calculate_copula_joint_probability` (QMC). The model marginals should be calibrated (see the calibration ticket in #59).

**Step 3. Estimated offered price.**
- `q_i` = de-vigged market probability for each leg (normalise both sides of that market. If the other side is missing, use `1/odds × (1 − leg_margin_default)`).
- `q_joint = copula(q_i, R)`, using the same matrix: our estimate of the book's fair SGM price.
- `offered_odds = (1 / q_joint) × (1 − SGM_MARGIN[sport])`, with defaults `{nba: 0.18, nfl: 0.18, afl: 0.20}`. Also cap it: `offered_odds ≤ ∏ leg_odds` (a book never pays more than the straight multi on positively correlated legs).
- If an explicit bookie SGM price is ever passed in (`leg["sgm_offered_odds"]` / future parlay feed), use it instead and set `price_source = "bookie_sgm"`. Otherwise use `"estimated_sgm"`.

**Step 4. Edge and gating.**
- `ev = p_joint × offered_odds − 1`. `edge = p_joint − 1/offered_odds`.
- Accept only if `ev ≥ min_sgm_ev` (default 0.03) **and** every leg has `p_model_i > q_i`.
- Paper settlement uses `offered_odds`, so the track record reflects the realistic haircut.

**Step 5. Size limits.** 2–4 legs. Stakes go through the existing `suggested_stake` with Kelly on `p_joint`/`offered_odds` (it will naturally be small).

### Minimum data needed per leg
`event_id`, `sport`, `market_type`, `selection`, **`side`** (+1/−1), **`team`** (or `null` for game markets), **`player_id`** (props), `line`, `model_probability` (calibrated), `odds`, and **opposite-side odds** (for de-vig). Correlation table: start with seeded literature/heuristic values. Then fit `base_rho` from history: game logs → pairwise binary outcome hit-rates → solve for the latent ρ that reproduces the joint hit-rate under the bivariate normal. Refit each season.

## Sources
- The Odds API v4 docs: per-event odds endpoint and market list; no parlay endpoint. https://the-odds-api.com/liveapi/guides/v4/
- OpticOdds Parlay API (`/parlay/odds`) for real SGP quotes. https://opticodds.com
- SGP hold of 15–25% and copula pricing: bettorsearch.com and oddspapi.io SGP explainers (secondary; there is no primary bookmaker disclosure, and books keep SGP models proprietary).
- Gaussian copula for dependent binary events: standard result. Implementation already in `app/sgm.py` / `app/ml/fast_copula.py`.
