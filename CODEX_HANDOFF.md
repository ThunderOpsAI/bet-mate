# BetMate — Codex Handoff

## Update — 10 Apr 2026

### What changed in this chat

- Integrated multi selection into final strategy card allocation:
  - `services/prediction-engine/app/strategy.py`
  - `allow_multis` and `max_multi_legs` now affect the actual selected card, not just config state.
- Scoped AFL and NBA candidate collection to the requested Melbourne `run_date`:
  - `services/prediction-engine/app/strategy.py`
  - `services/prediction-engine/app/data/afl_scraper.py`
  - `services/prediction-engine/app/data/nba_scraper.py`
- Extended live fetch endpoints to accept strict date queries:
  - `GET /api/afl/games/upcoming?date=YYYY-MM-DD`
  - `GET /api/nba/games/today?date=YYYY-MM-DD`
- Added an in-process nightly scheduler path for the FastAPI service:
  - `services/prediction-engine/app/nightly.py`
  - `services/prediction-engine/app/main.py`
  - Env flags:
    - `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true`
    - `BETMATE_NIGHTLY_SCHEDULER_TIME=05:00`
- Changed the default QLD/WA allowlist behavior so Brisbane and WA metro venues are not suppressed on non-Wed/Fri/Sat/Sun cards:
  - `services/prediction-engine/app/data/metro_allowlist.json`

### Validation completed

- `services/prediction-engine/venv/bin/pytest services/prediction-engine/tests/test_racing_scraper.py services/prediction-engine/tests/test_api.py services/prediction-engine/tests/test_strategy.py services/prediction-engine/tests/test_nightly.py services/prediction-engine/tests/test_afl_scraper.py services/prediction-engine/tests/test_nba_scraper.py`
- Result: `47 passed`

## Current state

### Racing

- Daily race fetch is Melbourne-date scoped.
- Melbourne and Sydney metro venues are tagged through the allowlist.
- Brisbane and WA metro allowlist entries now default to all days so those meetings can appear whenever Betfair has them for the Melbourne target date.
- Non-allowlisted venues are still retained instead of being dropped.

### Strategy engine

- Racing, AFL, and NBA candidate collection all respect the requested `run_date`.
- Cross-sport best-edge allocation is working.
- Multis can now appear in final cards.

### Nightly cycle

- `python -m app.nightly` still works.
- The FastAPI app can also run the nightly cycle automatically if scheduler env vars are enabled.

## Remaining work for next chat

### 1. Tag unknown racing venues properly

This is the main remaining racing gap.

Current behavior:
- Unknown venues still show in cards, which is good.
- But if a Betfair venue alias is not in the allowlist, it stays:
  - `meeting_type: "unknown"`
  - `meeting_region: ""`

What the next chat should do:
- Introduce a broader venue registry so QLD/WA venues are explicitly classified, not just included.
- Best approach:
  - either expand `metro_allowlist.json` substantially
  - or move to a proper venue table/JSON registry keyed by normalized aliases
- Target output per mapped venue:
  - `meeting_type`: `metro` / `provincial` / `country`
  - `meeting_region`: `VIC` / `NSW` / `QLD` / `WA` / etc
  - `state`
  - `active_days`
  - aliases from Betfair venue naming

Suggested implementation shape:
- Add a venue registry file or DB table that covers all commonly observed Betfair AU racing venues.
- Keep the current “unknown venues still pass through” fallback.
- Add tests that prove:
  - a mapped Brisbane venue is tagged `QLD`
  - a mapped WA venue is tagged `WA`
  - an unmapped venue still appears rather than being dropped

### 2. Finish multi persistence and settlement

This is the main leftover from strategy v1.5 after allocation was wired.

Current behavior:
- Multis can be selected into cards.
- But settlement/storage is still shaped around single-event bets.
- A selected multi currently has composite card data, but `system_bets` settlement still keys off one `sport + event_id + selection`.

What the next chat should do:
- Make multis first-class persisted bets.
- Recommended design:
  - add `system_bet_legs` table, or
  - add structured `legs_json` to `system_bets`
- Then update settlement logic so a multi:
  - wins only if all legs win
  - loses if any leg loses
  - void logic is explicit and deterministic

Files to inspect:
- `services/prediction-engine/app/strategy.py`
- `services/prediction-engine/app/storage.py`
- `services/prediction-engine/app/database.py`

### 3. Production scheduler enablement

Code path exists now, but production still needs an ops decision.

Need to verify:
- the deployed backend has `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true`
- only one production instance runs the scheduler
- logs confirm one cycle per Melbourne day

## Notes for the next chat

- `docs/V1_5_REVISED_PLAN.md` is still the historical planning reference.
- This file is now the single current handoff.
- The old March 2026 handover playbook was stale and should stay deleted.
