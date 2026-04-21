# BetMate Agent Handover

## START — What This Document Is

This document is the handover file for chained agent work on the BetMate repo.

Every agent must:
1. Read this BEFORE starting work
2. Update the current session block BEFORE finishing
3. Commit completed work
4. Push nothing

The goal is clean, narrow, continuous execution across agents without drift or assumptions.

---

## Owner Rules (Mandatory)

1. **Stay on one repo** — BetMate monorepo only
2. **Never switch branches** unless owner explicitly instructs
3. **Ask questions BEFORE coding** if anything is unclear
4. **Ask questions DURING coding** if a decision becomes ambiguous
5. **Code everything assigned** — complete the full scope
6. **Test nothing** unless owner explicitly asks
7. **Commit everything completed** — descriptive commit messages
8. **Push nothing** — owner will review and push
9. **Avoid unrelated refactors** — stay in scope
10. **Keep work narrow and phase-aligned**

---

## Source Documents (Priority Order)

When documents conflict, follow the most recent:

1. Owner instructions in the active chat (highest priority)
2. BetMate Pre-Beta UX Roadmap
3. BUILD_SPEC.md (this week's tactical plan)
4. Current phase assignment in this handover
5. API contracts documented below

---

## Critical Backend Constraints

### ML Engine (Lightsail AU)
- **Instance:** 1GB RAM, 2 vCPUs, 40GB SSD
- **Location:** Australia (required for Betfair API access)
- **Nightly scrape:** 2am AU (cron)
- **Weekly retrain:** 3am Sunday AU (cron, off-peak)

**Weekly Retrain Monitoring (MANDATORY):**
Every agent touching ML engine jobs MUST log:
- Retrain start time
- Retrain end time  
- Duration (minutes)
- Peak memory usage (MB)
- Success/failure status
- Model validation result

**Alert thresholds:**
- Duration >20 minutes → log warning
- Memory >750MB → log warning
- Failure → alert owner immediately
- Validation fails → keep old model, alert owner

**Why this matters:** 1GB RAM is tight for ML training. We need early warning if retrain becomes unstable so we can upgrade instance or split work before it crashes live traffic.

### ML Weights (FROZEN)

**The ML prediction weights are frozen until auto-tune has sufficient data.**

See `WEIGHTS_CONFIG.md` for full specification.

**Agents MUST NOT modify weights in:**
- `services/ml-engine/src/config/weights.py`
- Any weight/multiplier constants in ML code

**Weights will be automatically adjusted after:**
- 30+ settled results per sport
- 2+ weekly retrains completed
- Auto-tune validation passes

If you need to change a weight for testing/debugging:
1. Ask owner first
2. Document the change as temporary
3. Revert before committing

**Current weights are based on domain expertise, not LLM guesses.** Trust them until data says otherwise.

### Current API Contracts

**Prediction Response** (confirmed to exist):
```typescript
{
  sport: 'racing' | 'afl' | 'nba',
  event_id: string,
  prediction: {
    model_probability: number,
    fair_odds: number,
    feature_impact: Record<string, number>,
    ai_insights_context: string,
    model_metadata: {
      version: string,
      last_trained: string
    }
  }
}
```

**Paper Bet Submission** (confirmed to exist):
```typescript
{
  sport: 'racing' | 'afl' | 'nba',
  event_id: string,
  event_name: string,
  selection: string,
  odds: number,
  stake: number,
  bet_type: 'win' | 'place' | 'head_to_head',
  prediction_log_id?: number
}
```

**Blackbook Rule** (confirmed to exist):
```typescript
{
  id: string,
  user_id: string,
  runner: {
    id: string,
    name: string
  },
  action: 'back' | 'back_opponent',
  stake: number,
  trigger: {
    type: 'event' | 'odds_threshold' | 'opponent',
    condition: string
  },
  auto_action: 'notify' | 'log_paper_bet',
  active: boolean
}
```

---

## Current Session Block

### Current Status
**Phase:** Phase 8 complete; Phase 3 remains the only non-deferred major phase
**Status:** Ready to push for deployment/runtime debugging

- Phase 0-2, 4-6, 8 are implemented.
- Phase 3 (Snapshot/Batch) is the only remaining unimplemented core phase.
- Phase 7 is intentionally deferred per data gates.
- All frontend pages (Dashboard, Racing, AFL, NBA, Analytics, Blackbook) now have Phase 8 error clarity (ErrorState, ErrorBoundary, RefreshControls).
- Phase 6.3 FeedbackButtons implemented for future prediction reporting.
- Latest local fix prevents Dashboard/Racing/AFL/NBA from loading forever in local dev when fixture or prediction requests hang.

### Agent ID
Codex

### Repo
```
BetMate (monorepo)
```

### Branch worked on
`v2-betmate-bob-and-ui-ux-upgrades`

### Assigned scope
- Inspect local branch state, recent commits, and current diff before acting.
- Consolidate remaining local reliability work into clean commits.
- Update handover to the true pre-push state.
- Keep Phase 7 deferred and avoid starting new feature work.
- Prepare the branch for GitHub push and live deployment/runtime debugging.

### Files touched
- `apps/web/app/page.tsx` (timeout/fallback + `isMountedRef` loader fix)
- `apps/web/app/racing/page.tsx` (timeout/fallback + `isMountedRef` loader fix)
- `apps/web/app/afl/page.tsx` (timeout/fallback + `isMountedRef` loader fix)
- `apps/web/app/nba/page.tsx` (timeout/fallback + `isMountedRef` loader fix)
- `apps/web/app/lib/fetchWithTimeout.ts` (shared client fetch timeout helper)
- `docs/LIGHTSAIL_OWNER_INSTRUCTIONS.md` (owner deploy/runtime debugging notes)
- `docs/AGENT_HANDOVER.md` (final pre-push status)
- `apps/web/app/blackbook/page.tsx` (Phase 8 extension)
- `apps/web/app/analytics/page.tsx` (Phase 8 extension)
- `apps/web/app/components/FeedbackButtons.tsx` (Phase 6.3)

### What I did NOT touch
- Phase 3 (Daily Snapshot / Batch Optimization) - Still the main non-deferred backend phase and intentionally left for a dedicated session.
- Phase 7 (Model Learning) - Deferred as per data volume requirements.
- No new product features beyond consolidation/debugging support work.

### What was completed
- Inspected `git status`, recent commits, and the current diff before making changes.
- Committed the remaining local web reliability fix in `31f56bc` (`fix(web): prevent endless dev loading on ML timeouts`).
- Added a shared `fetchWithTimeout` helper and applied it to Dashboard/Racing/AFL/NBA fixture and prediction requests so hanging local endpoints fail into the existing error-state path instead of spinning forever.
- Fixed the dev-mode `isMountedRef` reset bug on Dashboard/Racing/AFL/NBA so loaders can clear correctly after async failures.
- Preserved the earlier Phase 8 extensions to `Analytics` and `Blackbook`, plus the Phase 6.3 `FeedbackButtons` work already on this branch.
- Added owner-facing Lightsail deployment/runtime notes for the live ML engine path.
- Updated handover documentation to reflect the branch state before push.

### What was not completed
- Phase 3 implementation (Backend consolidator / snapshot work).
- Live deployment/runtime debugging itself - this is the next step after push.
- Full browser-based E2E verification was not rerun in this session.

### Decisions made
- Kept scope to consolidation and debugging support only; no new feature phase work was started.
- Treated the local loader hang as reliability debt worth committing before any push because it directly affected branch verification.
- Kept Phase 7 deferred because the documented real-data gates are still the controlling condition.
- Added Lightsail notes as supporting docs for the upcoming live ML debugging flow instead of mixing in backend feature work.

### Questions asked owner
- None.

### Scope creep check
- None.

### Commit status
- `31f56bc` committed: local web timeout/fallback and loader-clear reliability fix.
- Handover/docs update is the remaining pre-push documentation commit.

### Recommended next work
- Push this branch, then debug Lightsail/live ML deployment and runtime behavior against the real environment.
- If the live stack is stable, Phase 3 (Daily Snapshot & Batch Optimization) remains the next non-deferred implementation target.
- Do not start Phase 7 unless the documented settled-results and retrain gates are actually satisfied.

---

## Phase Dependency Map

| Phase | Dependencies | Why |
|-------|--------------|-----|
| Phase 0 | None | ML weight configuration — must run before Phase 2 |
| Phase 1 | None | Frontend foundation — can run parallel to Phase 0 |
| Phase 2 | Phase 0 complete | Bob explains features based on their actual weights |
| Phase 3 | Phase 1 cache layer | Snapshot data needs somewhere to live |
| Phase 4 | Phase 2 Bob drawer | Onboarding tour step 2 references "Why?" |
| Phase 5 | Phase 2 confidence data | Opportunity scoring needs confidence signals |
| Phase 6 | Phase 4 persistent slip | Warnings need slip state to check duplicates |
| Phase 7 | 30+ settled results per sport | Model learning needs data volume |
| Phase 8 | Phase 1 cache | Error states need to know about stale cache |

---

## Weekly Retrain Health Check

If you touch anything in `services/ml-engine/src/jobs/weekly_retrain.py` or related training logic, you MUST add monitoring:

```python
import logging
import time
import psutil
from datetime import datetime

logger = logging.getLogger(__name__)

def retrain_with_monitoring():
    start_time = time.time()
    start_memory = psutil.virtual_memory().used / (1024 * 1024)  # MB
    
    logger.info(f"Retrain started at {datetime.now()}")
    logger.info(f"Initial memory: {start_memory:.2f}MB")
    
    try:
        # Your retrain logic here
        result = perform_retrain()
        
        end_time = time.time()
        end_memory = psutil.virtual_memory().used / (1024 * 1024)
        duration_minutes = (end_time - start_time) / 60
        peak_memory = end_memory  # Track peak during retrain if possible
        
        logger.info(f"Retrain completed at {datetime.now()}")
        logger.info(f"Duration: {duration_minutes:.2f} minutes")
        logger.info(f"Peak memory: {peak_memory:.2f}MB")
        
        # Alert thresholds
        if duration_minutes > 20:
            logger.warning(f"Retrain took {duration_minutes:.2f} minutes (>20min threshold)")
        
        if peak_memory > 750:
            logger.warning(f"Retrain used {peak_memory:.2f}MB (>750MB threshold)")
        
        return result
        
    except Exception as e:
        logger.error(f"Retrain failed: {str(e)}")
        logger.error(f"Duration before failure: {(time.time() - start_time) / 60:.2f} minutes")
        raise
```

---

## Final Response Format

At the end of your session, your final message to owner MUST include:

```
## Handover Summary

**Phase:** [phase number and title]
**Status:** [Completed / Partially Completed / Blocked]

**What was completed:**
- [specific item]
- [specific item]
- [specific item]

**What was not completed:**
- [specific item and reason]

**Commit:**
- Hash: [commit hash]
- Message: [commit message]
- Pushed: No (unless owner requested)

**Blockers:**
- [any blockers]
```
