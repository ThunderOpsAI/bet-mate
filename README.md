# BetMate — AI Multi-Sport Predictions & Paper Betting

BetMate is a high-performance quantitative sports prediction and simulated paper-trading platform rewritten as a React application on Vite and Tailwind CSS.

The application delivers explainable AI model predictions, expected value (+EV) overlay signals, Gaussian Copula Same-Game-Multi (SGM) pricing, Blackbook automated alerts, and virtual bankroll portfolio management across Horse Racing, NBA, AFL, NRL, Soccer, Golf, and MMA.

> **Responsible Wagering Notice:**  
> BetMate is purely an educational research and strategy simulation platform. No real-money gambling is conducted on this platform. 18+ | Australian Users: Gambling Help Online 1800 858 858.

---

## 🚀 Key Features

### 1. 🏇 Thoroughbred, Harness & Greyhound Racing
- **Metro & Provincial Racecards:** Complete form, weights, barriers, and jockey/trainer statistics.
- **XGBoost Win Probabilities:** Model-derived fair odds compared against live Betfair Back prices.
- **Speed Map Positioning:** Visual classification of Leaders, On-Pace, Midfielders, and Backmarkers.
- **Quaddie Planner:** 4-leg accumulator combination calculator with flexi stake percentages and dividend estimation.

### 2. 🏀 Multi-Sport Forecasting Hub
- **NBA & Basketball:** Model win probabilities, offensive/defensive ratings, and player prop overlays.
- **AFL (Aussie Rules):** Ground advantage, clearance conversion rates, and disposal lines.
- **NRL (Rugby League):** Yardage defense, kick metres differential, and anytime tryscorer props.
- **Soccer, Golf & MMA:** Global match predictions, strokes gained approach metrics, and UFC strike power modeling.

### 3. ⚡ Gaussian Copula Multi & SGM Builder
- **Correlation Engine:** Pairwise correlation analysis detecting synergies and conflicts between legs.
- **Dynamic Haircut Adjustments:** Calculates adjusted true probabilities and fair odds.
- **Expected Value (+EV) Metrics:** Real-time calculation of expected yield per $10 staked.
- **Multi Wizard:** Instant 1-click accumulator presets ("Safe Anchor", "High Yield Alpha", "Metro Quad", "Cross-Sport").

### 4. 🤖 Ask Bob AI Quant Explainer
- **Explainable Predictions:** Translates complex statistical models into natural language explanations.
- **Feature Contribution:** Explains speed figures, barrier bias, track suitability, and form decay.
- **Interactive Dialogue:** Ask custom questions regarding pacing, market drift, and model confidence.

### 5. 📒 Blackbook & Syndicate Management
- **Rule Builder:** Set automated alerts with probability thresholds, custom stakes, and notification channels.
- **Combination Tracker:** Tracks high-yield jockey + trainer partnerships in metro races.
- **Bet With Mates:** Create or join syndicates with unique 6-digit codes, pooled treasury, and shared betting ledgers.

### 6. 📊 Strategy Lab & ML Calibration
- **Strategy Backtesting:** Test Kelly criterion vs flat staking models across historical samples.
- **Calibration Curve:** Reliability diagrams measuring forecast probability vs observed strike rate.
- **Brier Score & Feature Importance:** Quantifiable model accuracy tracking.

---

## 🛠 Tech Stack

- **Runtime:** React 18 SPA with TypeScript
- **Bundler:** Vite 6 with `@tailwindcss/vite`
- **Styling:** Tailwind CSS v4 & custom high-contrast dark theme
- **Icons:** Lucide React
- **Port:** Dev server runs on port `3000` (`0.0.0.0`)
