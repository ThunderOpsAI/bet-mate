# BetMate

BetMate is an AI-powered multi-sport prediction and betting analytics platform focused on horse racing, basketball (NBA/NBL), AFL, NRL, soccer, golf, and MMA.

The application provides data-driven predictions, explainable AI insights via Gemini, exotic bet calculators, automated strategy tuning, paper bet tracking, and bankroll performance analytics.

> **MVP V1 Baseline:**  
> This version represents the stable **MVP V1** release baseline (Commit: `9a26f8db30987aed7e9cc1715cd363780cfbbbd4`). If issues arise in future development, reference/revert to this commit. **All further feature development or refactoring MUST be performed on a separate feature branch.**

> **Important Disclaimer:**  
> BetMate does **not** accept wagers or handle payments. Users place bets through their own licensed bookmaker platforms. This application is strictly for information, analysis, and tracking purposes. Please gamble responsibly (18+). Australian users: [Gambling Help Online](https://www.gamblinghelponline.org.au).

---

## 🏈 Supported Sports & Analytics

- 🏇 **Horse Racing:** Live race cards, Betfair odds integration, Racing Australia form enrichment, automated metro allowlists, and exotic bet calculators.
- 🏀 **Basketball (NBA & NBL):** Match predictions, win probabilities, player/team analytics, and Ball Don't Lie API data ingestion.
- 🏉 **AFL (Australian Football):** Match predictions, Squiggle API data integration, and Melbourne-calendar settlement tracking.
- 🏉 **NRL (Rugby League):** Match predictions, head-to-head probabilities, and team form analysis.
- ⚽ **Soccer:** Global league match analysis, model predictions, and outcome probabilities.
- ⛳ **Golf:** Tournament outcome analytics and field probabilities.
- 🥊 **MMA (UFC & Combat Sports):** Fight predictions, method-of-victory modeling, and fighter stats.

---

## 🏗 Monorepo Workspace Structure

BetMate is structured as a pnpm + Turborepo monorepo:

```
bet-mate/
├── apps/
│   ├── web/                  # Next.js 16 frontend app (deployed on Vercel)
│   └── api/                  # Express API backend with Prisma (deployed on Vercel Serverless)
├── services/
│   └── prediction-engine/    # Python FastAPI ML engine (runs locally & on Modal)
├── packages/
│   ├── prisma/               # Database schema & Neon Serverless PostgreSQL client
│   ├── types/                # Shared TypeScript type definitions
│   └── utils/                # Shared utility functions
├── scripts/                  # Development automation scripts (e.g. dev-stack.mjs)
├── docs/                     # Domain documentation, weights configuration, and media
└── .agents/                  # AI Developer agent guidelines and skill workflows
```

---

## 🛠 Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, Lucide React, Recharts, TanStack Query, Zustand, Framer Motion
- **Backend API:** Express 4, TypeScript, Prisma 6, Zod, JWT Authentication
- **Prediction Engine:** Python 3, FastAPI, Uvicorn, scikit-learn, pandas, Modal Serverless
- **Database:** Neon Serverless PostgreSQL (via Prisma ORM), SQLite (local dev fallback)
- **AI Integration:** Google Gemini API
- **Data Ingestion:** Betfair API (Racing), Ball Don't Lie API (NBA), Squiggle API (AFL)
- **Monorepo Tooling:** pnpm workspace, Turborepo

---

## 🚀 Local Development Setup

### Prerequisites

- **Node.js:** v20+
- **Package Manager:** `pnpm` (v9.1.0+)
- **Python:** 3.10+ with `venv`

### 1. Repository Setup & Dependencies

Clone the repository and install Node dependencies:

```bash
pnpm install
```

Set up environment variables:

```bash
cp .env.example .env
```

### 2. Python ML Engine Environment

Set up the virtual environment for the prediction engine:

```bash
cd services/prediction-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 3. Database & Prisma Setup

Generate the Prisma client:

```bash
pnpm db:generate
```

### 4. Running Local Development Servers

#### Option A: Combined Web + ML Engine (Recommended)
Starts the local ML engine on `http://127.0.0.1:8000` and Next.js web app on `http://127.0.0.1:3000`:

```bash
pnpm dev:local-stack
```

#### Option B: Express API Backend
Must be run separately when working on authentication or database interaction:

```bash
pnpm --filter @bet-mate/api dev
```

#### Option C: Individual Services
- **Next.js Web App:** `pnpm --filter @bet-mate/web dev`
- **Express API:** `pnpm --filter @bet-mate/api dev`
- **ML Engine:**
  ```bash
  cd services/prediction-engine
  source venv/bin/activate
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  ```

---

## 🧪 Verification & Testing

Before submitting changes, verify that all builds pass cleanly:

### 1. Build Verification

```bash
pnpm --filter @bet-mate/web build
pnpm --filter @bet-mate/api build
```

### 2. Health Endpoint Checks

Ensure local services return healthy status responses:

- **Express API Backend:** `http://127.0.0.1:3001/health`
- **Prediction Engine:** `http://127.0.0.1:8000/health`

### 3. Running Unit Tests

Run Python prediction engine tests:

```bash
cd services/prediction-engine
source venv/bin/activate
pytest
```

---

## 🚀 Production Deployment Architecture

- **Web Frontend:** Deployed on **Vercel** (`apps/web`).
- **Backend API:** Packaged for **Vercel Serverless** (`apps/api`).
- **Prediction Engine & Nightly Jobs:** Deployed as a **Modal** ASGI app (`services/prediction-engine/modal_app.py`).
- **Database:** **Neon Serverless PostgreSQL**.

---

## 📄 License & Responsible Gambling

This project is proprietary software for analytical and informational purposes. Please gamble responsibly.

