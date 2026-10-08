# BetMate Improvement Options

Two option lists to choose from:
1. Machine learning and strategy performance
2. Multis, the betslip, and a stats-first product

Nothing here has been built. Pick items by number.

---

## Part 1 — Machine Learning & Strategy

### How it works now
- **Racing:** XGBoost is imported and trained, but predictions come from fixed, hand-set weights in `app/ml/weights.py`. Training starts from `np.random.normal` synthetic data.
- **NBA and other sports:** XGBoost. NBA has `generate_mock_data`, and its training data is topped up with settled paper bets.
- **How models are checked:** a random `train_test_split` with equal sample weights. No probability calibration and no backtest.
- **Staking:** fractional Kelly. If Kelly says not to bet but the edge is positive, it still stakes up to 2%. Candidates are ranked by raw edge.
- **Place and quinella bets:** probabilities use the Harville formula.
- **Learning:** a weekly retrain in `nightly._run_weekly_retrain_if_due`.

### A. Data & Labels
1. Stop models training on synthetic or mock data.
2. Train on all historical results, not just paper bets (paper bets are a biased sample).
3. Store the full odds history: opening odds, odds at intervals, and the starting price (SP).
4. Record closing odds for every bet so closing line value (CLV) can be tracked.
5. Snapshot feature values at the moment each prediction is made.
6. Add a versioned feature store table in Prisma.
7. Pull results from more than one source and check them against each other.
8. Handle scratchings, non-runners and dead heats correctly.

### B. Features
9. Racing: speed figures, sectional times, normalised finishing margins.
10. Racing: jockey/trainer strike rates (overall, by track, by distance) and the jockey-trainer combo.
11. Racing: days since last run, first-up/second-up flags, class rises and drops.
12. Racing: track condition preference, barrier bias, likely race pace (speed map).
13. Racing: weight relative to the field.
14. Market features: odds movement, implied probability with the bookmaker margin removed, Betfair matched volume.
15. Elo or Glicko ratings for teams, players and horses.
16. Rest days, travel distance, back-to-backs, injuries and lineups, home-ground strength.
17. Weather.
18. Rolling averages that decay over time.
19. Opponent-adjusted stats (offensive and defensive ratings).

### C. Modelling
20. Turn the racing XGBoost back on, or use a ranking model (LambdaMART) grouped by race.
21. A conditional logit model for racing (Benter-style).
22. Blend the model with market odds (Benter's two-stage blend).
23. Calibrate probabilities with isotonic or Platt scaling; track Brier score and log-loss.
24. Make win probabilities add up to 1 within each race.
25. Use Henery or Stern place models, or finishing-order simulation, for place, quinella and exotics.
26. Score models (Poisson or Skellam) for soccer, AFL and NRL.
27. Model correlation between legs (copula or simulation) for same-game multis (SGMs) and multis.
28. Combine models (XGBoost + logistic regression + Elo) with a stacking model on top.
29. Bayesian hierarchical models for sports with little data (MMA, golf).
30. Golf: finishing-position simulation using strokes gained.
31. Uncertainty estimates that feed into stake size.

### D. Validation & Backtesting
32. Time-ordered walk-forward splits (the current random split leaks future data).
33. A backtest harness that replays a past day.
34. Judge models by ROI, CLV, yield and drawdown.
35. Champion/challenger promotion for new models.
36. A model registry (version, metrics, training window, git SHA).
37. Calibration (reliability) plots on the dashboard.
38. Drift monitoring (PSI or KS tests) with alerts.

### E. Strategy & Staking
39. Remove the forced up-to-2% stake when Kelly says not to bet.
40. Shrink Kelly stakes when the model is uncertain.
41. Size the whole day's bets together, accounting for correlated bets.
42. Rank candidates by expected value or expected growth, not raw edge.
43. Minimum edge per sport and market, tuned by backtest.
44. Odds bands to avoid long shots the model handles badly.
45. Drawdown controls and a daily stop-loss.
46. Confidence levels from calibrated probability and model disagreement.
47. Move bankroll between sports with a bandit approach (Thompson sampling).
48. Bet-timing model (bet early vs. near the jump).

### F. Learning Loop
49. Retrain daily, or after each batch of results.
50. Online learning: ratings and models that update as results arrive.
51. Weight recent training data more heavily.
52. Hyperparameter tuning with Optuna inside walk-forward splits.
53. Post-mortems of lost bets fed back into training (Bob writes the commentary).
54. Learn strategy settings from backtests.
55. Contextual bandits or reinforcement learning for bet selection (once backtesting exists).

### G. Ops & Explainability
56. SHAP explanations for each prediction, shown in the UI.
57. Scheduled Modal jobs for retraining and backtesting.
58. Remove `generate_mock_data` and the unused racing XGBoost code paths.
59. Tests for calibration and for win probabilities adding up to 1.
60. Performance dashboard per strategy.

**Start here:** 1, 4, 22, 23, 32, 33, 39.

---

## Part 2 — Multis, Betslip & a Stats-First Product

**Who it's for:** someone who logs in on the day (not to bet live), digs into player and team stats in more depth than anyone else offers, and builds strong multis quickly with recommendations they can trust.

Relevant code today: `app/bets/multi-builder`, `components/multi-builder/{MultiLegCard,MultiSummaryPanel}`, `components/betslip`, `PaperBetslipProvider`, `lib/betslip/persistSlip.ts`, and engine-side `strategy.build_multi_candidates`, `sgm.py`, `exotics.py`.

### A. Recommendation Engine (backend)
1. Rate every possible leg the same way: model probability, edge, a confidence band, and why.
2. Correlation-aware multi probability: simulate the game or use a copula instead of multiplying leg probabilities together.
3. Correlation score between legs: show "these legs help each other" vs. "these work against each other."
4. Generate multis automatically for a target payout (e.g. "$20 into $200, best expected value").
5. Generate multis for a target risk: Safe (2–3 high-probability legs), Balanced, Long shot.
6. Pick multis to maximise expected log growth, not just total odds.
7. Recommend the best leg to swap in or out ("swap leg 3 for X: +4% edge, same odds").
8. Weakest-leg detector: highlight the leg dragging the multi down.
9. Stop users stacking legs that depend on each other in a way the bookmaker prices badly against them.
10. Compare SGM pricing: the model's fair price vs. the bookmaker's SGM price, and show the margin.
11. Cross-sport day multis: the best one leg each from racing, AFL, NBA and so on.
12. Racing multis: quaddie, early quaddie and big-6 builder with suggested "banker" and "roughie" picks.
13. Racing "same-race multi" (win + place + top-4 combos) with correct dependency maths.
14. Player-prop multi builder (disposals, points, rebounds, try scorers, goals).
15. Templates: "Blowout script," "Shootout script," "Low-scoring grind": pick a game script and the legs fill in automatically.
16. Morning daily "Bob's Multis": 3–5 curated multis, each with a written rationale.
17. Personalised picks based on the user's favourite teams, sports, risk level and past slips.
18. Learn from the user's wins and losses which leg types they're good or bad at picking.

### B. Stats Engine (the "nobody else does this" layer)
19. Player profile pages: game logs, splits (home/away, vs. opponent, rest days, venue, weather).
20. Hit-rate tables: how often a player cleared a line in the last 5/10/20 games, this season, and vs. this opponent.
21. Line-vs-history charts: game-by-game bars with the betting line drawn across them.
22. Matchup stats: player vs. their direct opponent, team vs. the positions it concedes to (defence vs. position).
23. Role and minutes trends: time on ground, usage rate, centre-bounce attendances, minutes projections.
24. Teammate on/off impact: "When X is out, Y averages +6 disposals."
25. Injury and lineup change alerts that re-price related props automatically.
26. Team stats dashboards: pace, contested possessions, inside 50s, efficiency, form ratings.
27. Elo and power ratings with trend lines.
28. Game script projections: projected margin and total, with player projections built from them.
29. Venue and umpire/referee tendencies.
30. Weather impact for AFL, NRL, golf and racing.
31. Racing form guide: sectionals, speed maps, jockey/trainer form, track bias heatmaps, gear changes.
32. Racing "runner DNA": distance, track, condition and spacing preferences as visual cards.
33. Custom stat query builder ("players with 25+ disposals in 4 of last 5 vs. bottom-6 defences").
34. Saved screens and alerts: "notify me when a player matching my filter is under the line."
35. Compare tool: two players or teams side by side.
36. Natural-language stats Q&A via Bob ("How does Bont go at the MCG in the wet?").
37. Stat-trend detection: highlight unusual streaks and sudden shifts automatically.
38. Projection vs. line edge shown on every prop.

### C. Betslip UX
39. A persistent, always-visible betslip (side drawer on desktop, bottom sheet on mobile).
40. Live multi-maths: combined odds, model probability, fair odds, edge, and expected return.
41. Correlation warnings and boosts shown inline between legs.
42. Weakest-leg highlight with a one-tap swap suggestion.
43. A "Why this leg" panel on each leg (stats, hit rate, model reasoning).
44. Toggle between Singles, Multi, SGM and Round Robin (system bets, e.g. 3 legs from 4).
45. Round-robin and "boxed" multi coverage calculator.
46. Stake suggestion from bankroll and Kelly, with a manual override.
47. "Make it safer / make it bigger" slider that rebalances legs automatically.
48. Multi health score (A–F) with an explanation.
49. Save, name and share slips; clone a mate's slip.
50. Track slips: leg-by-leg progress on the day, then a post-mortem afterwards.
51. Paper mode vs. real-bookie export (deep links to bookmaker betslips where allowed).
52. Odds comparison per leg across bookmakers, with a best-price badge.
53. Price-drift alerts for legs in saved slips before the event starts.
54. Undo/redo and drag-to-reorder legs.
55. Slip history with ROI by leg type, sport and market.

### D. Racing Pages
56. "Add to multi" on every runner, plus quick-add banker/roughie chips.
57. Race-card view with model rank, fair odds vs. market, and an edge badge.
58. Speed map visual and predicted settling positions.
59. Quaddie planner grid across 4 races, with a total cost and probability readout.
60. Exotics builder (trifecta/first-4) with Henery/Stern probabilities.
61. Meeting overview: best bets, track bias, weather, rail position.
62. Runner drawer with a full form timeline and sectionals.
63. "Similar historical races" comparison.

### E. Sports Pages
64. Game hub: preview, projections, key matchups, team stats, injury list.
65. Prop markets grouped by player, each with a hit-rate pill and edge badge.
66. "Build SGM from this game" button that pre-fills legs using the game-script templates.
67. Player cards with a one-tap "add over/under."
68. Heatmaps (e.g. AFL zone stats, NBA shot charts where data exists).
69. Round/day view: all games with recommended legs highlighted.
70. Filters: sport, market, edge, hit rate, odds range, confidence.

### F. Home / Daily Flow
71. "Today" dashboard: the morning briefing, Bob's multis, top edges, key injuries.
72. Onboarding questions to set the user's sports, teams and risk level.
73. A guided multi wizard: pick sport(s), then risk, then target payout, and get suggestions.
74. Countdown and reminders before lockout.
75. Morning email or push digest.
76. Streaks and achievements for disciplined betting (not volume).

### G. Social
77. Mates' leaderboards (ROI, CLV, hit rate).
78. Shared group multis (each mate adds a leg).
79. Tipping competitions built on the stats engine.
80. Public slip feed with tail/fade buttons.
81. Shareable stat cards and slip images for social media.

### H. Responsible Gambling & Trust
82. Show the model's own track record (calibration, ROI) publicly.
83. Deposit/stake limits, cool-off periods, a "this multi has a 4% chance" reality check.
84. Honest empty states. No fake data, as the repo rules require.

### I. Data & Infra Needed
85. Player-level data feeds per sport (AFL disposals, NBA box scores, NRL stats, etc.).
86. Prop odds feeds (bookmaker and Betfair).
87. Prisma models: `Player`, `PlayerGameStat`, `TeamGameStat`, `PropMarket`, `Slip`, `SlipLeg`, `Correlation`.
88. A game-simulation service in the prediction engine for SGM and prop pricing.
89. Caching layer (TanStack Query + API ETags) for fast stats pages.
90. Search across players, teams and horses.

**Start here:** 2, 4, 8, 15, 19–21, 38, 39–43, 66, 71, 73. Together these deliver the "log in on the day and build a smart multi in 60 seconds" experience. Data items 85–88 come first.
