# BetMate — Codex Handoff

## Status — 10 Apr 2026

### V1.5 completion

- V1.5 is complete in the repo.
- Latest implementation branch: `codex/venue-registry-multi-settlement`
- Latest pushed commit: `181f6b4` (`Expand venue registry and settle multi bets`)
- Validation:
  - `services/prediction-engine/venv/bin/pytest services/prediction-engine/tests/test_racing_scraper.py services/prediction-engine/tests/test_api.py services/prediction-engine/tests/test_strategy.py services/prediction-engine/tests/test_storage.py services/prediction-engine/tests/test_nightly.py services/prediction-engine/tests/test_afl_scraper.py services/prediction-engine/tests/test_nba_scraper.py`
  - Result: `87 passed`

## What shipped in V1.5

### Racing

- Melbourne-date scoping is enforced for daily race fetches.
- Racing venue classification moved beyond the original metro-only allowlist.
- Mapped venues now carry:
  - `meeting_type`
  - `meeting_region`
  - `state`
  - `active_days`
  - alias matching for common Betfair naming variants
- QLD and WA mapped venues are no longer suppressed by the old Wed/Fri/Sat/Sun restriction.
- Unknown venues still pass through instead of being dropped.
- Files:
  - `services/prediction-engine/app/data/metro_allowlist.json`
  - `services/prediction-engine/app/data/scraper.py`
  - `services/prediction-engine/app/main.py`

### Strategy engine

- Racing, AFL, and NBA candidate collection all respect requested Melbourne `run_date`.
- Cross-sport best-edge allocation is active.
- Multis are now fully wired through:
  - selection
  - persistence
  - settlement
- `system_bets` now stores multi leg structure in `legs_json`.
- Multi settlement behavior is explicit:
  - all legs win -> multi wins
  - any leg loses -> multi loses
  - no losing legs and at least one push/void -> multi voids
- Current intentional constraint:
  - new multis are only built from settleable leg types under the current results model:
    - racing `win`
    - AFL `head_to_head`
    - NBA `head_to_head`
- Files:
  - `services/prediction-engine/app/strategy.py`
  - `services/prediction-engine/app/storage.py`
  - `services/prediction-engine/app/database.py`

### APIs and scheduling

- Live fetch endpoints accept strict date queries:
  - `GET /api/afl/games/upcoming?date=YYYY-MM-DD`
  - `GET /api/nba/games/today?date=YYYY-MM-DD`
- FastAPI now has an in-process nightly scheduler path controlled by:
  - `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true`
  - `BETMATE_NIGHTLY_SCHEDULER_TIME=05:00`
- `python -m app.nightly` still works.
- Files:
  - `services/prediction-engine/app/main.py`
  - `services/prediction-engine/app/nightly.py`

## Current state

### Backend

- Backend code for V1.5 is in place and tested.
- The production backend health endpoint was reachable during this chat:
  - `https://bet-mateprediction-engine-production.up.railway.app/health`
- Response observed on 10 Apr 2026:
  - `{"status":"ok","service":"advanced-ml-engine"}`

### Frontend / API contract impact

- Racing responses now include `state` for mapped venues.
- Strategy cards and system bets can now round-trip multi leg metadata cleanly.

## Ops status

- Production scheduler code exists, but Railway environment and instance topology were not changed from this session.
- Reason:
  - Railway auth was not available on this machine.
- So production scheduler enablement is not verified yet.

## V2 backlog / follow-up

These are no longer V1.5 blockers.

### 1. Production scheduler enablement

- Set `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true` on the production FastAPI service.
- Confirm the intended scheduler time:
  - default is `BETMATE_NIGHTLY_SCHEDULER_TIME=05:00` Australia/Melbourne
- Verify only one production instance runs the scheduler.
- Verify logs show one cycle per Melbourne day.

### 2. Broader multi settlement support

- If V2 wants multis from more market types, result ingestion needs richer structured outcomes.
- Current examples that would need extra modeling:
  - racing `place`
  - racing `quinella`
  - other composite market types

### 3. Optional venue registry refinement

- The new registry is broad enough for V1.5, but it can still be expanded over time as new Betfair aliases appear.
- Keep the current fallback behavior:
  - unmapped venues should still appear as `unknown`, not be dropped.

## Notes for the next chat

- Treat V1.5 as complete.
- Any new work should be framed as V2 or deployment / ops follow-up.
- `docs/V1_5_REVISED_PLAN.md` is now historical reference only.
