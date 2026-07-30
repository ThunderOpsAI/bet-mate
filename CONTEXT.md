# BetMate Context & Architecture Glossary

BetMate is an AI-powered multi-sport prediction and betting analytics platform providing data-driven model predictions, explainable AI insights, paper betting, bankroll management, and automated strategy tuning across multiple sports.

---

## 🎯 Supported Sports & Analytics Coverage

- **Horse Racing:** Live race cards, Betfair odds integration, Racing Australia form enrichment, automated metro allowlists, and exotic bet calculation.
- **Basketball (NBA / NBL):** Game predictions, win probabilities, player/team analytics, and Ball Don't Lie API data ingestion.
- **AFL (Australian Football):** Match predictions, Squiggle API data integration, and Melbourne-calendar settlement tracking.
- **NRL (Rugby League):** Match predictions, head-to-head probabilities, and team form analysis.
- **Soccer:** Global league match analysis, model predictions, and outcome probabilities.
- **Golf:** Tournament outcome analytics and field probabilities.
- **MMA (UFC / Fighting):** Fight predictions, method-of-victory modeling, and fighter stats.

---

## 🏗 System Architecture & Services

### 1. Web Frontend (`apps/web`)
- **Framework:** Next.js 16 (App Router), React 19, TypeScript.
- **Styling & UI:** Tailwind CSS v4, Lucide React, Framer Motion, Recharts.
- **State & Data:** TanStack Query (`@tanstack/react-query`), Zustand.
- **Proxy Rewrites:**
  - `/api/ml-proxy/*` -> Proxies browser requests to Python ML Engine (`ML_API_PROXY_TARGET`).
  - `/api/*` -> Proxies user authentication & bankroll requests to Express API (`API_PROXY_TARGET`).

### 2. Express Backend API (`apps/api`)
- **Framework:** Express 4 on Node.js / TypeScript, packaged for Vercel Serverless.
- **Database Access:** Prisma ORM connecting to Neon Serverless PostgreSQL.
- **Core Modules:**
  - `auth`: User registration, login, JWT token issuance.
  - `user`: Profile management, settings, bankroll baseline resets.
  - `bets`: User bet tracking, paper bet management.
  - `races`: Race card caching and betting calculators.

### 3. Machine Learning & Prediction Engine (`services/prediction-engine`)
- **Framework:** Python 3, FastAPI, Uvicorn, scikit-learn.
- **Deployment:** Modal ASGI app (`modal_app.py`) with shared Modal Volume (`/vol/betmate-models`).
- **Core Workflows:**
  - Nightly Strategy Runner (`app.nightly`): Daily strategy cards, result ingestion, profile auto-tuning loop.
  - Prediction Settlement (`/api/predictions/results`): SQLite/PostgreSQL persistence, accuracy metrics (hit rate, Brier score, log loss, ROI).
  - Paper Bets Tracking (`/api/paper-bets`): Local simulation tracking tied to model predictions.

### 4. Shared Packages (`packages/*`)
- `@bet-mate/prisma`: Database models (User, Bet, Race, Prediction, StrategyCard, etc.) and Prisma Client.
- `@bet-mate/types`: Shared TypeScript definitions and interfaces.
- `@bet-mate/ui`: Shared React component primitives.
- `@bet-mate/utils`: Shared utility functions (formatting, date utilities, calculations).

---

## 🔒 Security & Environment Rules

- **Database:** Neon Serverless PostgreSQL (`DATABASE_URL`).
- **Authentication:** `JWT_SECRET` must be synchronized between `apps/api` and `services/prediction-engine`.
- **Package Manager:** `pnpm` for JavaScript/TypeScript, `venv` for Python.


