# BetMate Handover Playbook (For Tomorrow)

**Date:** March 15, 2026 (Australia/Sydney)  
**Project:** BetMate (monorepo)  
**Purpose:** Single source of truth so any engineer can resume fast and build an exceptional MVP.

---

## 1) What This App Is

BetMate is a **prediction + tracking** platform for racing (MVP), then basketball/AFL later.  
It **does not** place bets or process payments.

Core MVP promise:
- show racing predictions clearly
- let users log and settle bets
- track bankroll + ROI
- provide reliable, fast, mobile-friendly UX

---

## 2) Current Repository State (As of Today)

Implemented now:
- `apps/web` (Next.js 14 app) with MVP dashboard page
- `apps/api` (TypeScript + Express) with:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/races/today`
  - `GET /health`
- `services/prediction-engine` (FastAPI) with `GET /health`
- `packages/prisma` with Prisma schema (users, races, predictions, bets, bankroll history)
- Root scripts for Prisma generate/migrate

Important behavior:
- API has graceful fallback mode when DB is unavailable:
  - auth can run in-memory
  - races endpoint returns sample fallback data
- This allows demo/review without blocking on infrastructure.

---

## 3) Monorepo Layout

- `apps/web` -> Next.js frontend
- `apps/api` -> API gateway/backend
- `services/prediction-engine` -> Python prediction service
- `packages/prisma` -> DB schema + Prisma client
- `packages/types`, `packages/ui`, `packages/utils` -> shared packages (to be filled next)
- `docs` -> product + technical docs

---

## 4) Quick Start Runbook

From repo root:

```powershell
pnpm.cmd install
pnpm.cmd db:generate
pnpm.cmd dev
```

Local URLs:
- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Prediction engine: `http://localhost:8000`

Health checks:
- `GET http://localhost:3001/health`
- `GET http://localhost:8000/health`

---

## 5) Env Setup

Use `.env` based on `.env.example`.

Minimum keys to run comfortably:
- `API_PORT=3001`
- `JWT_SECRET=...`
- `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
- `DATABASE_URL=postgresql://...` (real local DB for full mode)

Optional for later phases:
- `REDIS_URL`
- `GEMINI_API_KEY`
- `BETMATE_BOB_MODEL=gemini-2.5-flash`
- `BETMATE_BOB_TIMEOUT_SECONDS=30`
- sports API keys (`RACING_API_KEY`, `NBA_API_KEY`, `AFL_API_KEY`)

---

## 6) MVP Scope Lock (Do Not Expand Yet)

### In Scope (must ship)
- auth (register/login)
- racing list/detail with top picks
- manual bet logging + settlement
- bankroll tracking + ROI summary
- stable deploy + monitoring + legal disclaimers

### Out of Scope (after MVP)
- mobile app
- NBA/AFL predictions
- AI chat assistant
- advanced exotic builder
- social/copy betting

---

## 7) “Amazing MVP” Standards

Non-negotiables:
- Fast: p95 read endpoints < 500ms (cached paths)
- Stable: no critical production errors for core flows
- Safe: auth, validation, rate limiting, sanitized errors
- Clear: confidence/probability explained in plain language
- Honest: explicit “not financial advice” and “no betting transactions”
- Mobile-first UX, strong empty/loading/error states

---

## 8) Product UX Requirements (MVP)

User can:
1. Create account and set bankroll
2. View today’s races + top picks
3. Log a bet with stake/odds/selection
4. Settle win/loss/void
5. See bankroll and ROI update immediately

Design guardrails:
- racing-first home screen
- one clear CTA per screen
- no cluttered “all features” dashboard
- obvious confidence + risk cues

---

## 9) Data Model Snapshot (Prisma)

Current core models:
- `User`
- `Race`
- `Prediction`
- `Bet`
- `BankrollHistory`

Next DB tasks:
- create first migration
- seed sample races/predictions
- add constraints/enums where missing
- add indexes for top query paths (`raceDate`, `userId/status`, etc.)

---

## 10) API Contract Plan (MVP)

Already present:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/races/today`

Next to implement:
- `GET /api/races/:raceId`
- `POST /api/bets`
- `GET /api/bets`
- `PATCH /api/bets/:betId/settle`
- `GET /api/user/bankroll`

Quality requirements:
- strict payload validation
- consistent error shape
- request IDs in logs
- auth middleware and route protection

---

## 11) Engineering Plan (Starting Tomorrow)

### Day 1: Infrastructure and DB Reality
- bring up local Postgres
- run Prisma migration + seed script
- switch API from fallback to DB-first path for auth/races
- add `GET /api/races/:raceId`

### Day 2: Bet Tracking Vertical Slice
- implement bet create/list/settle endpoints
- bankroll update transactionally on settlement
- add web screens/forms for log + history

### Day 3: Analytics + Hardening
- bankroll/ROI widgets
- robust loading/error/empty states
- baseline integration tests for auth/races/bets
- rate limiting + input hardening

### Day 4: Release Readiness
- staging deploy
- smoke tests
- legal/compliance copy final pass
- launch checklist signoff

---

## 12) Testing Strategy

Minimum suite before MVP ship:
- unit tests for bankroll math and settlement logic
- integration tests for auth/races/bets APIs
- web smoke tests for main user path
- one end-to-end happy path:
  - register -> view races -> log bet -> settle bet -> bankroll updated

---

## 13) Security + Compliance Checklist

- hashed passwords (`bcrypt`)
- JWT expiry and secret rotation plan
- rate limits on auth endpoints
- schema validation on every write endpoint
- no sensitive stack traces in responses
- responsible gambling notice visible in app
- age statement (18+) and no-betting-transaction disclaimer

---

## 14) Deployment Checklist

- environment vars configured per service
- DB migrations applied
- health checks green
- logs/metrics/traces connected
- rollback plan tested
- alert on API error rate + latency

---

## 15) Immediate Backlog (Prioritized)

P0:
- Postgres wiring + migration + seed
- bet endpoints + bankroll transaction updates
- races detail endpoint + web detail page

P1:
- auth middleware across protected routes
- web bet history + filters
- basic analytics cards (ROI, win rate, bankroll trend)

P2:
- Redis caching for race/prediction reads
- richer UI polish and skeleton loading

---

## 16) Handover Notes for Any New Coder

- Start by running health checks and verifying all three services boot.
- Keep MVP scope tight; avoid adding NBA/AFL/chat yet.
- Preserve legal boundary: this app tracks and analyzes; it does not place bets.
- Prefer shipping one complete vertical slice at a time over broad partial work.
- If blocked by infra, keep fallback mode available for demo continuity.

---

## 17) Definition of Done (MVP)

MVP is done when:
- core user journey works end-to-end on staging
- no P0/P1 bugs in auth, races, bet tracking, bankroll calculations
- baseline tests pass in CI
- observability + rollback are in place
- legal/compliance copy is visible and reviewed

---

## 18) One-Line Mission

Build the most trusted, fast, and clear racing prediction + performance tracker for everyday punters, with zero ambiguity about risks and zero fake confidence in outcomes.
