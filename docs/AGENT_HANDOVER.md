# BetMate V2 Two-Agent Handover

## Mission

- Use this document together with `/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/BUILD_SPEC.md`.
- The owner brief is `/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/V2 Verification.docx`.
- The goal is to run the current V2 cleanup pass through two agents with no ambiguity about ownership, gates, or deployment authority.

## Scope Guardrails

- Stay inside the approved V2 brief only.
- Do not add fresh roadmap items, speculative improvements, or unrelated cleanup.
- Do not treat old deployment notes as authoritative for this pass.
- Production authority for this handoff is:
  - Vercel for the web app
  - Modal for the prediction engine

## Agent Ownership

### Agent 1 — Build / Test / Ready For Deploy

- Owns all approved code fixes in the current V2 brief.
- Owns local validation, build/test readiness, and pre-deploy smoke testing.
- Must implement only the approved scope captured in the build spec.
- Must hand off only after the local acceptance criteria are met.
- Must not broaden scope during debugging. If a new issue is discovered, it should be documented and classified rather than quietly added.

### Agent 2 — Push / Verify Live

- Owns push-to-live and production verification.
- Verifies Vercel and Modal only.
- Uses the live checklist from the build spec as the release gate.
- May make minimal blocker fixes discovered during live verification, but only when the fix is directly required to complete the approved rollout.
- Must not reopen the brief into a wider refactor or feature pass.

## Approved Product Targets

- Analytics becomes owner-first with top tabs in this order: `User`, `Strategy`, `ML`.
- The `User` tab is the default analytics landing state.
- Strategy bets must appear in analytics.
- The current `Paper Bets` experience becomes the primary `Bankroll` destination.
- The old standalone bankroll experience is not active scope for this pass.
- Homepage uses the supplied logo direction.
- Ask Bob moves to the bottom of the main dashboard with the Bob image above it.
- The extra `Open Racing` CTA and related clutter are removed from that homepage Ask Bob area.
- Blackbook must load.
- Strategy cards must load.
- Racing predictions must work for the approved main-race scope.
- Full Australian race listings must still support paper-bet placement even when predictions are limited to main races.
- Paper-bet logging must stop breaking after the first interaction and must stop wiping prior bets across sports.

## Handoff Gate From Agent 1 To Agent 2

Agent 1 must provide all of the following before Agent 2 starts the live push:

- Local build status:
  - the app builds successfully
  - any required local tests for touched areas pass
- Local smoke test status for:
  - homepage/dashboard
  - analytics
  - racing
  - strategy
  - blackbook
  - bankroll/history flow
- Acceptance confirmation that:
  - analytics tab order is `User`, `Strategy`, `ML`
  - analytics opens on `User`
  - strategy bets show up in analytics
  - nav shows `Bankroll`
  - Ask Bob is at the bottom of the dashboard with Bob art above it
  - racing still supports paper bets across full race listings
  - logging no longer wipes prior bets across sports
- Notes on anything intentionally deferred or any known limitation that does not block deploy

## Agent 2 Live Verification Steps

- Push the approved changes to `main`.
- Confirm the Vercel deployment completes and the frontend is live.
- Confirm the Modal prediction engine is live and the frontend `/api/ml-proxy/health` check succeeds.
- Verify the live dashboard loads.
- Verify live analytics:
  - tab order is `User`, `Strategy`, `ML`
  - default tab is `User`
  - strategy-linked reporting is visible
- Verify live navigation shows `Bankroll`.
- Verify the homepage Ask Bob section:
  - sits at the bottom of the dashboard
  - uses Bob artwork above the Ask Bob UI
  - no longer includes the extra `Open Racing` CTA
- Verify Blackbook loads for an authenticated user.
- Verify strategy cards load.
- Verify racing shows main-race predictions where expected and still exposes full race listings for paper-bet logging.
- Verify a basic paper-bet logging flow still works across sport changes without losing prior bets.

## Required Evidence For Signoff

- Confirmation that the Vercel deployment is live
- Confirmation that `/api/ml-proxy/health` succeeds against the deployed Modal backend
- Short notes for each critical live route checked:
  - homepage/dashboard
  - analytics
  - racing
  - strategy
  - blackbook
- A short blocker list if anything failed, including:
  - affected area
  - reproduction summary
  - whether it was fixed in Phase 2 or left as a follow-up

## Completion Rule

- The handoff is complete only when Agent 1 has met the local gate and Agent 2 has passed live verification on both Vercel and Modal.
- If either live deployment fails, do not mark the pass complete.
