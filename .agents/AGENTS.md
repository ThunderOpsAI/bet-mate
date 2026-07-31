# BetMate Developer Agent Guidelines

This document outlines the rules, architectural patterns, and development guidelines for the BetMate monorepo. All AI agents and developers working on this project must adhere to these guidelines.

---

## 1. Project Architecture & Stack

BetMate is a monorepo containing a web frontend, an Express API backend, and a Python-based machine learning prediction engine.

- **Frontend:** [apps/web](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/apps/web) - Next.js application deployed on Vercel.
- **Backend API:** [apps/api](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/apps/api) - Express application using Prisma, packaged for Vercel Serverless via [vercel.json](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/apps/api/vercel.json).
- **Prediction Engine:** [services/prediction-engine](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/services/prediction-engine) - Python FastAPI app running locally and deployed as a [Modal](https://modal.com) app.
- **Database:** Neon Serverless PostgreSQL, managed with Prisma ([packages/prisma](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/packages/prisma)).

---

## 2. General Development Rules

- **Prisma Schema Updates:** If you modify the Prisma schema, you must regenerate the Prisma client using:
  ```bash
  pnpm --filter @bet-mate/prisma prisma:generate
  ```
- **Sync Environment Variables:** Keep JWT secrets (`JWT_SECRET`) and database URLs (`DATABASE_URL`) identical between `apps/api` and `services/prediction-engine`.
- **Node package manager:** Always use `pnpm` for JavaScript/TypeScript packages.
- **Python environments:** Always use `venv` inside `services/prediction-engine` for managing Python dependencies.

---

## 3. Frontend Development & UI Guidelines

AI agents working on `apps/web` have full authorization to improve, redesign, and refactor frontend components.

- **Component Decomposition:** Avoid adding logic or UI directly into giant monolithic files (like `app/page.tsx`). Break down complex pages into small, modular React components under `app/components/` or dedicated feature folders.
- **Visual Design & Aesthetics:** Aim for high-quality, modern, and dynamic UI designs. Utilize Tailwind CSS v4, smooth gradients, subtle micro-animations (Framer Motion), clean typography, and polished empty/loading states.
- **UI Prototyping & Sample Props:** When building or updating UI components, feel free to use sample props, mock UI states, and visual preview data within components to ensure rich visual feedback, even when local API servers or live odds data feeds are offline or returning empty arrays.
- **State Management:** Keep local UI state in standard React hooks (`useState`, `useReducer`) or local component state. Use TanStack Query / Zustand for global data fetching and app-wide state when interacting with backend APIs.

---

## 4. Standard Local Commands

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

## 5. Verification & Testing

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

## 6. Agent Skills

### Issue tracker

Issues and PRDs live in the repo's GitHub Issues, accessed via the `gh` CLI. See [issue-tracker.md](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/agents/issue-tracker.md).

### Triage labels

Using default canonical triage labels (`needs-triage`, `needs-info`, etc.). See [triage-labels.md](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/agents/triage-labels.md).

### Domain docs

Configured for single-context domain documentation. See [domain.md](file:///Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/agents/domain.md).


