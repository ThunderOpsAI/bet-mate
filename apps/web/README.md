# @bet-mate/web

Next.js 16 web application frontend for BetMate.

## Features & Routes

- **Dashboard & Hub (`/`):** High-level odds, multi-sport summary, and strategy alerts.
- **Sport Pages:**
  - 🏇 **Horse Racing (`/racing`, `/races`):** Race cards, Betfair runner odds, Racing Australia form data, exotic calculators.
  - 🏀 **Basketball (`/nba`):** Game slates, win probabilities, team/player analytics.
  - 🏉 **AFL (`/afl`):** Match slates, model predictions, win probabilities.
  - 🏉 **NRL (`/nrl`):** League match predictions and probabilities.
  - ⚽ **Soccer (`/soccer`):** Global league match predictions.
  - ⛳ **Golf (`/golf`):** Tournament analysis and field odds.
  - 🥊 **MMA (`/mma`):** Fight predictions and fighter statistics.
- **Analytics & Tracking:**
  - 📊 **Bankroll (`/bankroll`):** Performance trends, baseline resets, ROI analytics.
  - 📝 **Bets & Paper Bets (`/bets`):** Bet logging, paper betting history, prediction accuracy tracking.
  - 🎯 **Strategy (`/strategy`):** Strategy cards and auto-tuning profile performance.
  - 📌 **Blackbook (`/blackbook`):** Runner & team tracking notifications.

## Next.js API Proxy Rewrites (`next.config.mjs`)

- `/api/ml-proxy/*` -> Proxies browser requests to the Python ML Prediction Engine (`ML_API_PROXY_TARGET`).
- `/api/*` -> Proxies authentication and user requests to the Express API (`API_PROXY_TARGET`).

## Development

Run Next.js dev server on port 3000:

```bash
pnpm --filter @bet-mate/web dev
```

Build for production:

```bash
pnpm --filter @bet-mate/web build
```
