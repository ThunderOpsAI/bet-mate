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

---

## 📡 Live Data Policy (No Mock Fixtures)

BetMate **never** serves mock, synthetic, or hardcoded racing or sports fixture data to the UI or API consumers. All race cards, game slates, and market odds come from live upstream sources (primarily Betfair Exchange API and sport-specific feeds such as Squiggle, Ball Don't Lie, and Racing Australia enrichment).

- If live data cannot be fetched (auth failure, upstream outage, empty market catalogue), endpoints return **empty arrays** — never placeholder meetings or fabricated runners.
- The frontend must show an explicit empty state (e.g. **"No races currently"**) rather than silently substituting cached mock content.
- ML model training may still bootstrap from synthetic feature matrices when no persisted model artifact exists; that is internal to the prediction engine and is **not** exposed as live fixture data.

---

## 🏇 Betfair Integration

Racing and several sports markets are sourced from the **Betfair AU Exchange API** in `services/prediction-engine/app/data/scraper.py`.

### Required environment variables

| Variable | Purpose |
|---|---|
| `BETFAIR_APP_KEY` | Application key (`X-Application` header) |
| `BETFAIR_USERNAME` | Betfair account username |
| `BETFAIR_PASSWORD` | Betfair account password |
| `BETFAIR_AUTH_MODE` | `auto` (default), `certificate`, or `interactive` |
| `BETFAIR_API_BASE_URL` | Defaults to `https://api.betfair.com.au` |

### Certificate authentication (recommended for production)

Non-interactive API access requires a client certificate uploaded to the Betfair developer console:

1. Generate a `.crt` / `.key` pair (or export from Betfair after creating a cert login).
2. Provide material via **one** of:
   - `BETFAIR_CERT_PATH` + `BETFAIR_KEY_PATH` (file paths)
   - `BETFAIR_CERT_PEM` + `BETFAIR_KEY_PEM` (inline PEM text)
   - `BETFAIR_CERT_PEM_B64` + `BETFAIR_KEY_PEM_B64` (base64-encoded PEM — used by Modal secrets)
3. Set `BETFAIR_AUTH_MODE=certificate`.
4. Redeploy Modal (`modal deploy modal_app.py`) after updating the `betmate-prediction-engine-secrets` secret.

Use `services/prediction-engine/deploy_secret.py` to push updated certificate material to Modal.

### Local verification

```bash
cd services/prediction-engine
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
curl http://127.0.0.1:8000/api/races/today
```

A successful response includes a non-empty `races` array during active AU thoroughbred meetings. An empty array with `[Betfair] authentication unavailable` in logs indicates missing or expired credentials/certificate.


