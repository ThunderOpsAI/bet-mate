# BetMate V2 Execution Build Spec

## Purpose

- This is a docs-only execution contract for the current V2 cleanup pass.
- This is not a fresh roadmap, not a broad redesign, and not a place to preserve obsolete phases.
- The owner brief is `/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/docs/V2 Verification.docx`.
- Use the Word brief above plus this spec as the approved source of truth for implementation.
- If work is not listed here, treat it as out of scope.

## Source Summary From The Owner Brief

- Analytics must become owner-first, with strategy performance visible and current ML analytics demoted to third priority.
- The current `Paper Bets` experience should become the primary `Bankroll` destination.
- The homepage needs the supplied logo direction and a simplified Ask Bob section placed at the bottom of the dashboard with Bob artwork above it.
- Blackbook, strategy cards, and racing predictions all need to load reliably.
- Racing predictions should stay focused on main races, while full Australian race listings must still allow paper-bet logging.
- Logging flows must stop breaking after the first action, must stop wiping prior bets across sports, and must keep logged bets available for analytics.

## Execution Rules

- Active execution contains only Phase 1 and Phase 2 below.
- Phase 1 is local implementation, build, test, and pre-deploy readiness.
- Phase 2 is push and live verification only.
- Do not add extra phases, speculative ideas, or unrelated cleanup.
- Do not treat old roadmap items as active unless they are restated in this document.
- Branding references should use the supplied BetMate logo and BetMate Bob assets only.
- Older deployment notes are not authoritative for this pass. Live deployment authority is Vercel for the web app and Modal for the prediction engine.

## Phase 1 — Build / Test / Ready For Deploy

### Product Scope

- Analytics and strategy reporting:
  - Rework analytics into three top tabs in this order: `User`, `Strategy`, `ML`.
  - Default the analytics landing state to the `User` tab.
  - Keep current ML analytics available, but position them as third-priority telemetry.
  - Ensure strategy bets are logged and represented in analytics rather than treated as hidden or secondary-only data.
- Navigation and page naming:
  - Rename the current `Paper Bets` experience to `Bankroll`.
  - Treat `/bets` as the primary bankroll destination for this pass.
  - Remove the old standalone `/bankroll` experience from active scope and navigation.
- Homepage and Ask Bob:
  - Use the supplied BetMate logo asset in the top brand area.
  - Move the Ask Bob experience to the bottom of the dashboard/main page.
  - Remove the extra `Open Racing` CTA and surrounding clutter called out in the owner brief.
  - Place the BetMate Bob image above the Ask Bob UI.
- Availability regressions:
  - Blackbook must load and be usable for an authenticated user.
  - Strategy cards must load.
  - Racing predictions and refresh behavior must work for the approved main-race scope.
- Racing coverage behavior:
  - Keep prediction cards focused on main races only.
  - Main-race prediction coverage should target Melbourne and Sydney daily, with WA and Brisbane included on the higher-priority days called out in the owner brief.
  - Keep full Australian race listings below the prediction area so users can still place paper bets on all races.
- Betslip and logging regressions:
  - Logging a selection must add it successfully and clear transient selection state correctly.
  - Logging another AFL selection after the first one must still work.
  - Switching between AFL, NBA, and Racing must not wipe existing paper bets.
  - Logged selections must remain available to bankroll/history and analytics flows.

### Local Acceptance Criteria

- Analytics shows tabs in this order: `User`, `Strategy`, `ML`.
- Analytics opens on `User` by default.
- Strategy bet history is visible in analytics.
- Sidebar and active navigation show `Bankroll` instead of `Paper Bets`.
- The old standalone bankroll page is not treated as an active destination for this pass.
- Homepage branding uses the supplied logo direction.
- Ask Bob sits at the bottom of the main dashboard with Bob artwork above it.
- Ask Bob no longer includes the extra `Open Racing` CTA mentioned in the owner brief.
- Blackbook loads for an authenticated user.
- Strategy cards load.
- Racing shows main-race predictions where expected and still exposes full race listings for paper-bet logging.
- Logging a bet does not flicker, does not stall after the first action, does not wipe prior bets when switching sports, and preserves data for downstream analytics.

### Required Pre-Deploy Checks

- Run the project build and required local tests for the touched surfaces.
- Smoke test the main user flows locally before handoff:
  - homepage/dashboard
  - analytics
  - racing
  - strategy
  - blackbook
  - bankroll/history flow
- Record any intentionally deferred item in the handoff. Do not silently drop scope.

## Phase 2 — Push / Verify Live

### Deployment Actions

- Push the approved changes to `main`.
- Verify the frontend deploy on Vercel.
- Verify the prediction-engine deploy on Modal.
- Treat any live blocker discovered here as a targeted follow-up, not a reason to broaden product scope.

### Live Verification Checklist

- Confirm the Vercel deployment is live and the main dashboard loads.
- Confirm the frontend same-origin ML proxy responds successfully on `/api/ml-proxy/health`.
- Confirm the live app can load:
  - homepage/dashboard
  - analytics
  - racing
  - strategy
  - blackbook
- Confirm the live analytics tab order is `User`, `Strategy`, `ML`, with `User` selected first.
- Confirm the live navigation shows `Bankroll`.
- Confirm Ask Bob is at the bottom of the dashboard with Bob art above it and without the extra `Open Racing` CTA.
- Confirm racing still shows main-race predictions while keeping full race listings available for paper-bet actions.
- Confirm a basic paper-bet logging flow still works without losing prior bets across sports.

### Signoff Standard

- Do not call the release complete until both of these are true:
  - the Vercel web deployment is live and usable
  - the same-origin `/api/ml-proxy/health` check succeeds against the deployed Modal backend
- Capture any live issue as a specific blocker with affected area, reproduction steps, and whether it is a Phase 2-only fix or a follow-up task.

## Out Of Scope

- New feature ideation beyond the owner brief
- Extra phases or revived historical roadmap items
- Broad backend redesign
- Speculative ML/personalization work unrelated to the approved V2 cleanup pass
