# BetMate Developer Agent Guidelines

This document outlines the rules, architectural patterns, and development guidelines for the BetMate monorepo. All AI agents and developers working on this project must adhere to these guidelines.

---

## 1. Project Architecture & Stack

BetMate is a monorepo containing a web frontend, an Express API backend, and a Python-based machine learning prediction engine.

- **Frontend:** [apps/web](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/apps/web) - Next.js application deployed on Vercel.
- **Backend API:** [apps/api](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/apps/api) - Express application using Prisma, packaged for Vercel Serverless via [vercel.json](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/apps/api/vercel.json).
- **Prediction Engine:** [services/prediction-engine](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/services/prediction-engine) - Python FastAPI app running locally and deployed as a [Modal](https://modal.com) app.
- **Database:** Neon Serverless PostgreSQL, managed with Prisma ([packages/prisma](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/packages/prisma)).
- **Legacy Platform:** Railway is deprecated and must not be used or referenced for new deployments.

---

## 2. General Development Rules

- **Do Not Modify Railway Configurations:** The repository has migrated away from Railway. Any leftover Railway configurations should be ignored or deleted.
- **Prisma Schema Updates:** If you modify the Prisma schema, you must regenerate the Prisma client using:
  ```bash
  pnpm --filter @bet-mate/prisma prisma:generate
  ```
- **Sync Environment Variables:** Keep JWT secrets (`JWT_SECRET`) and database URLs (`DATABASE_URL`) identical between `apps/api` and `services/prediction-engine`.
- **Node package manager:** Always use `pnpm` for JavaScript/TypeScript packages.
- **Python environments:** Always use `venv` inside `services/prediction-engine` for managing Python dependencies.

---

## 3. Standard Local Commands

### Combined Stack (Web + ML Engine)
Starts the Next.js app and the Python prediction engine (does not include the API):
```bash
pnpm dev:local-stack
```

### Express API Backend
Must be run separately if authentication/database interactions are needed:
```bash
pnpm --filter @bet-mate/api dev
```

### Next.js Frontend
```bash
pnpm --filter @bet-mate/web dev
```

### Python ML Engine
```bash
cd services/prediction-engine
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

---

## 4. Verification & Testing

Before completing any task, verify changes:
1. Ensure TypeScript builds successfully:
   ```bash
   pnpm --filter @bet-mate/web build
   pnpm --filter @bet-mate/api build
   ```
2. Verify API health endpoints:
   - API: `http://127.0.0.1:3001/health`
   - ML Engine: `http://127.0.0.1:8000/health`

---

## 5. Agent Skills

### Issue tracker

Issues and PRDs live in the repo's GitHub Issues, accessed via the `gh` CLI. See [issue-tracker.md](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/agents/issue-tracker.md).

### Triage labels

Using default canonical triage labels (`needs-triage`, `needs-info`, etc.). See [triage-labels.md](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/agents/triage-labels.md).

### Domain docs

Configured for single-context domain documentation. See [domain.md](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/agents/domain.md).

