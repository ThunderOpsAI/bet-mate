# BetMate NFL & NBA Stat Multi Builder — System Design Specification

## 1. Overview & Scope
This document specifies the V1 architecture for the BetMate day-ahead stat multi builder, focusing strictly on **NFL and NBA**. The system shifts the product from high-frequency live betting to a slower, analytical pre-game builder featuring automated High EV feeds, player props, and Copula-adjusted Same-Game Multis (SGMs).

**Out of Scope for V1:** Live/in-play betting, Racing, AFL, NRL, Soccer, Golf, MMA.

## 2. Domain Glossary
- **Leg**: A single prediction (player prop OR team market) priced by the best available odds across Betfair or our retail API fallback.
- **Multi**: "Anything Goes" accumulator. Can contain same-game (SGM), same-sport cross-game, or cross-sport (NBA + NFL) legs.
- **Top 10 EV Feed**: A daily feed of the top 10 *individual legs* ranked by mathematical edge %, which users can tap to add to their manual multi builder.
- **Max Multi**: An aggressive automated strategy (`nba_max_multi`, `nfl_max_multi`) targeting 3 to 8 legs that always spends its full daily budget.
- **Mini Multi**: A conservative automated strategy (`nba_mini_multi`, `nfl_mini_multi`) targeting 2 to 5 higher-probability legs. Bets daily but scales stakes based on value.

## 3. Data Pipeline & Ingestion
The ingestion pipeline is completely decoupled from Vercel's daily cron limits. It runs directly on the prediction engine using Modal's native scheduling.

**Schedule:** Two runs daily per sport:
1. **00:00 AEST (Midnight)**: Catches early team lines and first-wave player props.
2. **08:00 AEST**: Crucial refresh to catch the morning wave of US retail player props before games commence.

**Execution Sequence:**
1. **Fetch Games**: BDL API (NBA + NFL) for today's slate.
2. **Fetch Markets**: Betfair Exchange (team H2H / Spreads).
3. **Fetch Props**: The Odds API (`regions=us` for NFL, `regions=au` for NBA). The system falls back to retail odds here because Betfair Exchange lacks player prop liquidity.
4. **Predict**: Run ML models to generate true leg probabilities.
5. **Devig & Score**: `Edge % = (True Probability * Best Available Decimal Odds) - 1`.
6. **Top 10 Feed**: Rank single legs by Edge % → upsert to DB (`daily_ev_feed` table).
7. **Auto-Bets**: Generate Max/Mini strategy picks and log to DB.

## 4. Prediction Engine (ML Architecture)
**NFL V1 (XGBoost):**
- **Model**: `XGBClassifier` + `CalibratedClassifierCV(method='isotonic')`.
- **Data**: ~6,400 labeled games (1999-present) fetched via `nfl-data-py`.
- **Features**: Team EPA (Expected Points Added) differentials, rest days, surface/dome, historical spread lines.
- **Output**: Calibrated `predict_proba()` output directly drives the true probability.

**NBA V1 (Manual Weighted Sum):**
- **Model**: The current hand-tuned weighted sum (capped via sigmoid [0.22, 0.82]) is retained for V1.
- **Bug Fix**: The BDL scraper's silent synthetic-data bug must be patched (`start_season=current_season-2, max_pages_per_season=15`).
- **V2 Path**: Walk-forward backtesting of XGBoost vs the weighted sum baseline using real BDL data before wiring it to production.

## 5. SGM Gaussian Copula Engine
The legacy 12-18% heuristic haircut is replaced with a Gaussian Copula to correctly price correlated Same-Game Multi legs.

- **Correlation Matrix**: Generated dynamically during model training using `pandas.DataFrame.corr()` on the historical `nfl-data-py` and BDL datasets.
- **Copula Fallback**: If a rogue market combination is not in the matrix, the system defaults to a mild positive correlation (`ρ = +0.10`).
- **UI Warnings**: The frontend Multi Builder checks the pairwise `ρ` of active legs:
  - `ρ > 0.20`: 🟡 Yellow warning (Mild correlation)
  - `ρ > 0.40`: 🔴 Red warning (High correlation)

## 6. Frontend UI
**Route**: `/bets/multi-builder` (or integrating the shell at `/high-ev`).
**Components**:
1. **Top 10 High EV Feed**: Interactive list of today's best single legs. Tapping `[+]` pushes the leg to the active builder state.
2. **Leg Card**: Displays the sport badge, game context, leg description, back price, lay price (if available on Betfair), calculated Edge %, and the correlation warning badge.
3. **Multi Summary Panel**: Displays the stacked legs, standard combined odds, the Copula-adjusted true probability, combined Edge %, and expected return (EV) on a $10 stake.

## 7. Required API & DB Changes
**Prisma Schema**:
- Add `DailyEVFeed` table (id, sport, game_context, leg_description, true_prob, best_odds, edge_pct, created_at).
- Update `StrategyRun` / `StrategyPick` to support Max/Mini variants and leg counts.

**Express API**:
- `GET /api/ev-feed/today` (Returns the top 10 legs for the UI).
- `POST /api/bets/multi` (Upgraded to accept the new Copula payload and cross-sport legs).
