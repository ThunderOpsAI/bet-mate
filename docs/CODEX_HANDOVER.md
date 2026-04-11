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

**Phase:** V2 transition — ops carry-over + branding foundations
**Branch worked on:** codex/ops-scheduler-branding-start
**Commit:** e8d254e — chore: start v2 ops and branding
**Test result:** `pnpm --filter @bet-mate/web build` passed. Browser verification passed on `http://127.0.0.1:3000` for desktop and mobile: no Next overlay, no console errors, dashboard left loading state. Full pytest suite was not run.

### What was completed
- Railway project `bet-mate`, production service `@bet-mate/prediction-engine`, was linked locally for CLI inspection.
- Production scheduler env vars confirmed: `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true`, `BETMATE_NIGHTLY_SCHEDULER_TIME=05:00`.
- Active successful Railway deployment confirmed healthy with one replica; production health endpoint returns `{"status":"ok","service":"advanced-ml-engine"}`.
- Scheduler logs checked: `2026-04-12` nightly cycle completed and scheduled `2026-04-13 05:00:00 AEST`.
- `docs/ops_log.md` created with the scheduler/env/log/deployment findings.
- Branding foundations added for the web app:
  - `apps/web/tailwind.config.js` brand colour, font, and radius tokens.
  - CSS brand tokens in `apps/web/app/globals.css`.
  - Placeholder SVG BetMate Bob mascot component at `apps/web/app/components/BobMascot.tsx`.
  - Bob mascot slot added to the sidebar brand and top header.
  - Header/nav/footer restyled onto the new brand palette.
  - Persistent footer copy added: `18+ only. BetMate is informational only.` with a Gambling Help Online link.
- Metadata and login copy adjusted away from wagering-positioned language.
- Local dev server was stopped before commit.

### What was NOT completed (carry forward)
- Latest Railway deployment record is failed (`2310b0ee-43ca-443e-bf0c-eb91d9a53e98`) due an inaccessible `asia-southeast1` region config. The active successful deployment remains healthy.
- `2026-04-11` nightly cycle logged `connection already closed`; `2026-04-12` completed successfully. Re-check if this repeats.
- Branding task only covered foundations/app shell. Existing individual screens still need a full brand polish pass.
- Tailwind config was added as the token source requested by the build spec, but the current app still uses global CSS rather than Tailwind utilities.

---

## This session's tasks

Complete the following in order. Stop after each task and check in with the product owner before proceeding.

**Task 1 — Railway deployment cleanup check (V2 ops carry-over, P0)**
- Inspect Railway service deployment settings and remove/fix the inaccessible `asia-southeast1` region if still configured.
- Confirm a fresh deployment can succeed without replacing the active healthy service with a failed deployment.
- Re-check scheduler logs after the next run window if available; document any repeated `connection already closed` failure in `docs/ops_log.md`.

**Task 2 — V2: Email + Google auth (P0)**
- Refer to `docs/BUILD_SPEC.md`, Phase V2, Auth section.
- Confirm current auth architecture in `apps/web/app/providers/AuthProvider.tsx` before editing.
- Implement email/password auth via Supabase Auth or confirm with owner if magic link should remain.
- Implement Google OAuth via Supabase provider with PKCE, redirect/error handling, and production/local redirect URI notes.
- Add protected route guards on authenticated pages.

**Task 3 — V2: Compliance foundations start (P0)**
- Refer to `docs/BUILD_SPEC.md`, Phase V2, Compliance Foundations section.
- Start with age gate + Terms acceptance storage design.
- Ensure recommendation card disclaimer copy is planned for every recommendation card before V3 work.

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
