# Best-practice probability modelling for racing & sports betting edge

Research ticket: [#67](https://github.com/ThunderOpsAI/bet-mate/issues/67) (map #59). Blocks #68.

## Short answer

The proven recipe is: **(1) a fundamental model trained on real outcomes → (2) calibrate it → (3) blend it with the de-vigged market probability in log-odds space, fitted on held-out data → (4) measure edge against the de-vigged market, and validate with log-loss vs market and closing-line value (CLV), not hit rate.** The market is the strongest single predictor; edge comes from what the model adds *on top* of it.

## Findings (with primary sources)

1. **Model + market blending (Benter).** Benter fit a multinomial (conditional) logit fundamental model per race, then combined it with the public's implied probability: `c_i ∝ exp(α·log f_i + β·log π_i)` normalised within the race, with α, β fitted by maximum likelihood on held-out races. The combined model significantly beat both the fundamental model and the public alone; fundamental-only probabilities were *not* profitable by themselves. — W. Benter, "Computer Based Horse Race Handicapping and Wagering Systems: A Report", in *Efficiency of Racetrack Betting Markets* (Hausch, Lo, Ziemba eds., 1994; repr. World Scientific 2008).
2. **Conditional logit for races.** Win probability as softmax of a linear score within each race, estimated by maximum likelihood on finishing data (rank-ordered logit can use full finish order). — Bolton & Chapman, "Searching for positive returns at the track: a multinomial logit model for handicapping horse races", *Management Science* 32(8), 1986.
3. **Favourite–longshot bias (FLB).** Longshots are over-bet; raw 1/odds over-states their probability, more so at the long end. Explained mostly by bettor probability misperception. — Snowberg & Wolfers, "Explaining the Favorite–Long Shot Bias", *J. Political Economy* 118(4), 2010. Consequence: a model that merely normalises and compares to raw 1/odds will "find edge" on longshots that is mostly bias + overround.
4. **De-vigging the market.** Implied probabilities must have the overround removed. Proportional normalisation is the baseline; Shin's method (insider-trading model) corrects FLB and outperforms basic normalisation for estimating true probabilities. — Shin, *Economic Journal* 103, 1993; Štrumbelj, "On determining probability forecasts from betting odds", *Int. J. Forecasting* 30(4), 2014. Betfair exchange back prices have low overround; bookmaker odds need de-vigging.
5. **Calibration methods.** Platt (sigmoid) scaling for small data / monotone distortions (Platt 1999); isotonic regression is more flexible but overfits below ~1,000 calibration samples (Zadrozny & Elkan 2002; Niculescu-Mizil & Caruana, ICML 2005); temperature scaling — single parameter on logits, preserves ranking, ideal for multiclass/softmax race models (Guo et al., ICML 2017). Calibrate on data the model was not trained on (scikit-learn `CalibratedClassifierCV` docs).
6. **Select models on calibration, not accuracy.** Calibration-selected models produced substantially higher betting returns than accuracy-selected ones on NBA data. — Walsh & Joshi, "Machine learning for sports betting: should model selection be based on accuracy or calibration?", *Machine Learning with Applications* 16, 2024.
7. **Staking.** Kelly growth-optimal staking assumes the probability is correct; with estimation error, fractional Kelly is standard (Kelly 1956; Thorp, "The Kelly criterion in blackjack, sports betting and the stock market", 2006). Benter also staked fractional Kelly on the *combined* probability.
8. **Validation: CLV.** Closing prices are the most efficient market estimate; consistently beating the close is the fastest-converging signal of genuine edge, far faster than P&L (which needs thousands of bets). Metrics to use: log-loss / Brier vs de-vigged closing market, reliability diagrams/ECE, and mean CLV = `bet_odds / closing_odds − 1` (or in de-vigged probability terms).

## Applicability to our code (current state)

| Area | Current | Gap vs best practice |
|---|---|---|
| Racing `ml/racing.py::predict` | Hand-weighted linear score × combo multiplier, divided by sum. XGBoost is trained (on `generate_mock_data` + paper bets) but unused at predict time. | Not a probability model: no MLE, no calibration, no market term. Replace with conditional logit (softmax per race) trained on real results, then Benter blend with Betfair implied prob. Mock-data training violates repo rule. |
| Racing edge `strategy.py::_racing_candidates` | `edge = p − 1/live_odds` (raw, no de-vig). | Compare to de-vigged (Shin or proportional) race-normalised market prob; use blended prob. |
| Place/quinella (`harville_*`) | Harville from model win probs. | Harville is known to over-state favourites for place; apply Benter/Lo discount exponent or Stern model — later. Feed blended probs. |
| NFL `ml/nfl.py` | XGBoost + `CalibratedClassifierCV(isotonic)` on real nflverse data. | Good. Check sample size (<1k per fold → sigmoid). Add market (closing spread/ML) blending. |
| NBA / AFL | XGBoost on mock + paper bets; AFL uses Squiggle signal. | No calibration step; mock data. Use real history; add Platt calibration; blend with de-vigged H2H odds (Squiggle is effectively a market-like prior for AFL). |
| Spreads/totals edge (NBA/NFL) | `edge = prob − 0.50`, `odds_source = model_implied`. | Not edge: no market price. Should require market odds or be marked "no market, no edge". |
| `build_head_to_head_candidate` | edge vs `baseline_probability`. | Baseline must be de-vigged market prob. |
| `confidence_bucket` | thresholds on p and edge. | Should derive from calibrated, blended edge. |
| Kelly `suggested_stake` | fractional Kelly; floors to `min(edge,0.02)` when Kelly ≤0. | OK fraction; remove the positive fallback when Kelly ≤ 0 (bets with no edge). |
| Validation | None. | Add CLV + log-loss vs market tracking on settled paper bets. |

## Recommendation for #68 (edge definition)

`edge = p_blend × decimal_odds − 1` where `p_blend = softmax_group(α·logit_or_log(p_model) + β·log(p_market_devig))`, α, β fitted on held-out outcomes per sport. If no market price exists, **no edge is reported** (model-only probability shown as "fair odds" only).
