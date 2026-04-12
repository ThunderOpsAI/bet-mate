# BetMate — Codex Chat Handover Template

> **How to use this file:**
> This is the master handover template. At the start of every new Codex chat, paste the contents of **Part 1 + Part 2** as your opening prompt. Part 3 runs at the end of the session. The editable prompt block in Part 2 is the only section you update between chats — it contains what the last session did and what this one needs to do.

---

## PART 1 — Context (paste this every time, unchanged)

```
You are a senior full-stack developer working on BetMate — a sports statistics, tracking, and recommendation platform for Australian sports bettors. BetMate is NOT a wagering product. It does not accept bets, hold funds, or place bets on behalf of users. It provides data-driven picks, multi-sport analysis, and personalised strategy via a web app and email.

## Tech stack
- Frontend: Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS 4
- Backend: FastAPI (Python), deployed on Railway
- Database: Supabase Postgres with RLS and Auth (magic link + email/password + Google OAuth)
- LLM: Gemini API
- Payments: Stripe (V3, not yet built)
- Scheduler: APScheduler via FastAPI in-process nightly job
- Testing: pytest (87 tests passing at V1.5 baseline)

## Production endpoints
- API health: https://bet-mateprediction-engine-production.up.railway.app/health
- Expected response: {"status":"ok","service":"advanced-ml-engine"}

## Non-negotiables
- All pipeline jobs must be idempotent
- Partial success policy: one sport failing must not kill the full nightly run
- No placeholder trend data before two completed pipeline runs exist
- Never commit directly to main — always branch
- Branch naming: codex/[short-description]
- Every session ends with a clean repo and an updated prompt block (see Part 3)

## Build reference documents in the repo
- docs/BetMate_Build_Spec_V2_V3_V4.docx — full phase-by-phase feature and acceptance criteria table (P0/P1/P2 priorities)
- docs/CODEX_HANDOVER.md — this file

## Your working rules
1. Read docs/BetMate_Build_Spec_V2_V3_V4.docx before starting any task. It is the source of truth.
2. Read the editable prompt below (Part 2). It tells you exactly what was done last session and what to do this session.
3. Branch from main before touching any code.
4. After completing each task, stop and check in with the product owner. Do not move to the next task without confirmation.
5. At end of session, follow Part 3 exactly.
```

---

## PART 2 — Editable Prompt (update this after every session)

> **Instructions:** This block is the only thing that changes between chats. Rewrite it at the end of every session (see Part 3). Keep it factual and specific — no fluff. The next Codex chat reads this to know where to start.

```
## Previous session summary

**Phase:** V2 transition — ops carry-over, auth, compliance foundations
**Branch worked on:** codex/ops-scheduler-branding-start
**Commits:** c1c0c65 — chore: add railway service deployment config; a555c8f — feat: add supabase auth and compliance foundations
**Test result:** `pnpm --filter @bet-mate/web build` passed. `pnpm --filter @bet-mate/web test` passed but only prints "No tests configured for web". `venv/bin/python -m pytest` in `services/prediction-engine` passed with 96 tests. `jq empty services/prediction-engine/railway.json` passed. `git diff --check` passed. Browser smoke screenshots on `http://127.0.0.1:3100` for `/login`, `/terms`, and protected `/` redirect showed rendered pages with no Next overlay; console capture via `agent-browser` was unavailable because the CLI is not installed, and `npx -p playwright node -e ...` could not resolve the Playwright module. Local login correctly showed the expected Supabase configuration error because Supabase env vars are not set locally.

### What was completed
- Completed Task 1 carry-over:
  - Added service-local Railway config-as-code at `services/prediction-engine/railway.json`.
  - Fresh Railway deployment `e58263c9-954f-4098-bda8-246b3e0d7d56` succeeded with Dockerfile builder, `numReplicas=1`, and `multiRegionConfig={"europe-west4-drams3a":{"numReplicas":1}}`.
  - Production `/health` returned `{"status":"ok","service":"advanced-ml-engine"}` after deploy.
  - Production strategy-card read for James on `2026-04-12` returned existing card with `selected_count=3`.
  - New deployment logs showed scheduler sleeping until `2026-04-13T05:00:00+10:00`; no new `connection already closed` entries were found after deploy.
  - `docs/ops_log.md` updated with deployment IDs and Railway CLI limitations.
- Completed Task 2 auth implementation:
  - Replaced local Express/JWT browser auth in `apps/web/app/providers/AuthProvider.tsx` with Supabase Auth.
  - Added browser Supabase client at `apps/web/app/lib/supabase.ts` with PKCE, persisted sessions, and auto-refresh.
  - Added email/password login and signup via Supabase Auth.
  - Added Google OAuth via Supabase provider and `/auth/callback` code exchange route.
  - Added redirect/error handling for login, register, and OAuth callback flows.
  - Added app-wide route guard in `apps/web/app/components/AppShell.tsx`: all non-public routes require auth; incomplete compliance redirects to `/compliance`.
  - Added profile hydration/update support from Supabase `profiles`, including display name, email, created_at, plan tier, and compliance timestamps.
  - Added local/production Supabase redirect URI notes to `.env.example` and README.
- Completed Task 3 compliance foundations:
  - Added Supabase migration `supabase/migrations/202604120001_auth_profiles_compliance.sql` for `profiles` and `user_settings`, RLS policies, default free plan tier, and auth trigger setup.
  - Added `/compliance` age gate and Terms acceptance flow with hard sign-out on decline.
  - Added `/terms` and `/privacy` public pages with V2 placeholder legal/privacy copy.
  - Added recommendation disclaimer component with exact required copy: `This is informational only. BetMate does not accept wagers or provide betting services.`
  - Added recommendation disclaimer to dashboard cards, racing cards, AFL cards, NBA cards, race detail cards, and strategy cards.
  - Updated README with no-KYC decision: no KYC is required while BetMate remains informational and does not accept funds or provide betting services.

### What was NOT completed (carry forward)
- Supabase project setup was not applied from this local session. The next operator must run `supabase/migrations/202604120001_auth_profiles_compliance.sql`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, enable Email and Google providers, and configure redirect URLs before production auth can be fully tested.
- Live email/password and Google OAuth flows were not exercised against a real Supabase project because local Supabase env vars are not configured.
- Terms and Privacy copy is implementation-ready placeholder copy, not lawyer-reviewed final copy.
- Railway dashboard service config still appears stale in `railway environment config`; deployments succeed because `services/prediction-engine/railway.json` overrides the stale multi-region config.
- Re-check the scheduler after the `2026-04-13 05:00 AEST` run window.
- Branding task still needs a full screen-level polish pass beyond the app shell/foundations.

---

## This session's tasks

Complete the following in order. Stop after each task and check in with the product owner before proceeding.

**Task 1 — Supabase production auth configuration and smoke test (V2 Auth/Compliance, P0)**
- Run `supabase/migrations/202604120001_auth_profiles_compliance.sql` in the target Supabase project.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for local and production web environments.
- Enable Supabase Email and Google providers.
- Configure redirect URLs:
  - Local: `http://localhost:3000/auth/callback`
  - Production: `https://your-production-domain/auth/callback`
- Smoke test email/password signup/login, Google OAuth callback, profile row creation, `user_settings` creation, age gate/Terms acceptance, decline flow, sign-out, and protected route redirects.

**Task 2 — Scheduler post-run check (V2 ops carry-over, P0)**
- Re-check Railway scheduler logs after the `2026-04-13 05:00 AEST` run window.
- Confirm exactly one nightly cycle ran.
- Confirm no repeated `connection already closed` entry.
- Confirm production `/health` and the `2026-04-13` strategy card endpoint still work.
- Update `docs/ops_log.md` with findings.

**Task 3 — Product/legal copy confirmation (V2 Compliance, P0)**
- Ask the product owner to review `/terms` and `/privacy` copy.
- Flag that these pages are not lawyer-reviewed and should not be treated as final legal text.
- Confirm the exact recommendation disclaimer copy remains acceptable everywhere before moving toward V3.

**Task 4 — Branding screen polish continuation (V2 Branding, P1)**
- Continue the screen-level brand polish pass on existing pages.
- Keep the persistent responsible gambling notice and required recommendation disclaimers intact.

Check in with product owner after each task. Do not proceed to the next without confirmation.
```

---

## PART 3 — End of Session Checklist (run this at the end of every chat)

Follow these steps in order before closing the session.

### 1. Verify your work
- [ ] All new code has passing tests (run the full test suite)
- [ ] No hardcoded secrets or API keys in any file
- [ ] No placeholder or stub code left in place without a TODO comment

### 2. Clean up the repo
- [ ] Remove any debug files, temp scripts, or scratch files created during the session
- [ ] Confirm no uncommitted changes are floating (git status clean on your working branch)

### 3. Commit and push your branch
```bash
git add .
git commit -m "[codex] short description of what this session completed"
git push origin codex/[your-branch-name]
```

### 4. Check in with product owner
- Tell the product owner: what you completed, what you did NOT complete, and any blockers or decisions needed.
- Wait for instruction: the product owner will either ask you to do another task (loop back to Part 2) or approve the branch for merge.

### 5. If approved to merge
```bash
git checkout main
git pull origin main
git merge codex/[your-branch-name]
git push origin main
git branch -d codex/[your-branch-name]
```

### 6. Update the editable prompt (Part 2 of this file)
Rewrite the Part 2 block so the next Codex chat starts with accurate context. Follow this structure exactly:

```
## Previous session summary

**Phase:** [e.g. V2]
**Branch worked on:** [branch name]
**Commit:** [commit hash + message]
**Test result:** [X passed / any failures]

### What was completed
- [bullet list — specific, factual]

### What was NOT completed (carry forward)
- [anything that was started but not finished, or explicitly deferred]

---

## This session's tasks

Complete the following in order. Stop after each task and check in with the product owner before proceeding.

**Task 1 — [Title] ([priority])**
- [specific instructions]
- [refer to build spec section]

**Task 2 — [Title] ([priority])**
- [specific instructions]

Check in with product owner after each task. Do not proceed to the next without confirmation.
```

### 7. Commit the updated handover file
```bash
git add docs/CODEX_HANDOVER.md
git commit -m "[codex] update handover prompt for next session"
git push origin main
```

---

## Quick reference — branch naming

| Situation | Branch name format |
|---|---|
| New feature | codex/feature-short-name |
| Bug fix | codex/fix-short-description |
| Compliance task | codex/compliance-short-name |
| Ops / infra | codex/ops-short-description |

## Quick reference — priority levels

| Level | Meaning |
|---|---|
| P0 | Blocker — must complete this session |
| P1 | Important — complete if P0s are done |
| P2 | Nice to have — only if time permits |
