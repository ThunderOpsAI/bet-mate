# BetMate — Codex Handoff

## Update — 10 Apr 2026

### What changed in this chat

- Made multis first-class in persistence and settlement:
  - `services/prediction-engine/app/strategy.py`
  - `services/prediction-engine/app/storage.py`
  - `services/prediction-engine/app/database.py`
  - Selected multis now retain `legs` through allocation and storage.
  - `system_bets` now stores `legs_json`.
  - Multi settlement is deterministic:
    - wins when all legs win
    - loses as soon as any leg loses
    - voids when all resolved legs are non-losing and at least one leg pushes / voids
- Limited new multis to leg types that can be settled with the current result-ingestion model:
  - racing `win`
  - AFL `head_to_head`
  - NBA `head_to_head`
- Expanded racing venue classification beyond the original metro-only allowlist:
  - `services/prediction-engine/app/data/metro_allowlist.json`
  - Added mapped metro / provincial / country venues across VIC, NSW, QLD, WA, SA, TAS, NT, and ACT.
  - Added richer alias coverage, including state-suffixed Betfair names like `Belmont (WA)`.
- Propagated mapped venue metadata into racing cards:
  - `services/prediction-engine/app/data/scraper.py`
  - Mapped venues now carry `meeting_type`, `meeting_region`, and `state`.
- Exposed `state` on the racing API schema:
  - `services/prediction-engine/app/main.py`
- Added regression coverage for mapped QLD / WA venues, provincial / country tagging, and unmapped fallback:
  - `services/prediction-engine/tests/test_racing_scraper.py`
  - `services/prediction-engine/tests/test_api.py`
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

- `services/prediction-engine/venv/bin/pytest services/prediction-engine/tests/test_racing_scraper.py services/prediction-engine/tests/test_api.py services/prediction-engine/tests/test_strategy.py services/prediction-engine/tests/test_storage.py services/prediction-engine/tests/test_nightly.py services/prediction-engine/tests/test_afl_scraper.py services/prediction-engine/tests/test_nba_scraper.py`
- Result: `87 passed`

## Current state

### Racing

- Daily race fetch is Melbourne-date scoped.
- Melbourne and Sydney metro venues are tagged through the allowlist.
- Brisbane and WA mapped venues now default to all days so those meetings can appear whenever Betfair has them for the Melbourne target date.
- The venue config now classifies mapped meetings as `metro`, `provincial`, or `country` and exposes `state` on each mapped race.
- Non-allowlisted venues are still retained instead of being dropped.

### Strategy engine

- Racing, AFL, and NBA candidate collection all respect the requested `run_date`.
- Cross-sport best-edge allocation is working.
- Multis can now appear in final cards.
- Multis persist with full leg data and settle across all legs via `system_bets`.
- New multis are currently constrained to settleable leg types (`racing win`, `afl/nba head_to_head`) until broader market-result logging exists.

### Nightly cycle

- `python -m app.nightly` still works.
- The FastAPI app can also run the nightly cycle automatically if scheduler env vars are enabled.

## Remaining work for next chat

### 1. Production scheduler enablement

Code path exists now, but production still needs an ops decision.

Need to verify:
- the deployed backend has `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true`
- only one production instance runs the scheduler
- logs confirm one cycle per Melbourne day

## Notes for the next chat

- `docs/V1_5_REVISED_PLAN.md` is still the historical planning reference.
- This file is now the single current handoff.
- The old March 2026 handover playbook was stale and should stay deleted.
