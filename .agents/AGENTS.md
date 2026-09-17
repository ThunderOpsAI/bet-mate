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

## 2. General Development Rules & Operational Boundaries

### Core Constraints & Directives

1. **'Patch, Don't Rewrite' Directive:** Agents are explicitly forbidden from rewriting entire components, pages, or functions to solve a bug. They must diagnose the specific line or block causing the issue and apply a targeted, surgical patch.
2. **Strict Architectural Boundaries:** Agents must respect separation of concerns. An agent assigned to a specific domain (e.g. UI/Frontend) must never alter backend data pipelines, database schemas, or API logic to achieve its goal without following the Hard-Stop Protocol.
3. **Zero-Tolerance for Mock Data Fallbacks:** Agents are strictly forbidden from adding, injecting, or leaving hardcoded fallback arrays, static JSON, sample props, or fake data in any component, page, or API route. If a data stream or API returns empty or fails, the UI must render an explicit, clean Empty/Error state component (e.g. `<NoLiveMeetings />` or `"Awaiting Data Feed"`).
4. **Mandatory Execution Checkpoints:** Before an agent executes any change that touches more than one file or involves structural/architectural changes, it must stop, output a concise Execution Plan, and await explicit written authorization.

---

### Hard-Stop Protocol for Architectural Boundaries

If an agent is assigned a task within a specific domain (e.g., Frontend/UI) and discovers that the task genuinely cannot be completed without crossing an architectural boundary to alter another domain (e.g., modifying Backend APIs, altering Prisma schema, or changing state management pipelines), the agent MUST treat this as a hard blocker and execute the following protocol:

1. **HALT EXECUTION:** Immediately stop making code changes. Do not attempt a workaround or use mock data.
2. **REPORT THE BLOCKER:** Clearly explain to the user exactly what missing backend/architectural requirement or dependency is blocking the task.
3. **PROPOSE AN EXECUTION PLAN:** Output a clear, step-by-step Execution Plan detailing both the backend changes required to expose the data and the subsequent frontend changes needed to consume it.
4. **AWAIT AUTHORIZATION:** Wait in a standby state for explicit, written authorization from the user before touching any files outside the originally assigned architectural boundary.

---

### Execution Checkpoint Thresholds

- 🟢 **GREEN LIGHT (Execute Immediately):** If a task is a single-file, non-structural bug fix or a targeted surgical patch (e.g., updating a CSS class, fixing a localized typo, or patching a self-contained logic error), the agent is authorized to execute the patch immediately without pausing for a checkpoint, provided it strictly respects architectural boundaries.
- 🔴 **RED LIGHT (Mandatory Checkpoint):** If a task requires modifying multiple files, refactoring the structural hierarchy of a component, altering a shared data pipeline, or crossing frontend/backend boundaries, the agent MUST trigger a Mandatory Checkpoint. It must halt execution, output a concise, step-by-step Execution Plan, and wait for explicit, written authorization from the user before making any edits.

---

### Repository Standards

- **Prisma Schema Updates:** If you modify the Prisma schema, you must regenerate the Prisma client using:
  ```bash
  pnpm --filter @bet-mate/prisma prisma:generate
  ```
- **Sync Environment Variables:** Keep JWT secrets (`JWT_SECRET`) and database URLs (`DATABASE_URL`) identical between `apps/api` and `services/prediction-engine`.
- **Node package manager:** Always use `pnpm` for JavaScript/TypeScript packages.
- **Python environments:** Always use `venv` inside `services/prediction-engine` for managing Python dependencies.

---

## 3. Frontend Development & UI Guidelines

AI agents working on `apps/web` must strictly adhere to the operational boundaries and core directives outlined above.

- **Component Decomposition:** Avoid adding logic or UI directly into giant monolithic files (like `app/page.tsx`). Break down complex pages into small, modular React components under `app/components/` or dedicated feature folders.
- **Visual Design & Aesthetics:** Aim for high-quality, modern, and dynamic UI designs. Utilize Tailwind CSS v4, smooth gradients, subtle micro-animations (Framer Motion), clean typography, and polished empty/loading states.
- **Zero-Tolerance for Synthetic Data:** Never inject fake data, static JSON fixtures, or sample props into UI components to mask empty or failing API feeds. Always render explicit empty states when data is missing.
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


