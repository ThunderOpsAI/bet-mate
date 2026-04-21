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
**Phase:** Phase 8 — Error Clarity + Performance Budget (Extended to all pages)
**Status:** Substantially Complete (except Phase 3 backend optimization)

- Phase 0-2, 4-6, 8 are implemented.
- Phase 3 (Snapshot/Batch) is the only remaining unimplemented core phase.
- Phase 7 is intentionally deferred per data gates.
- All frontend pages (Dashboard, Racing, AFL, NBA, Analytics, Blackbook) now have Phase 8 error clarity (ErrorState, ErrorBoundary, RefreshControls).
- Phase 6.3 FeedbackButtons implemented for future prediction reporting.

### Agent ID
Antigravity

### Repo
```
BetMate (monorepo)
```

### Branch worked on
`v2-betmate-bob-and-ui-ux-upgrades`

### Assigned scope
- Verify branch stability and implementation status of all phases.
- Confirm whether every phase except Phase 7 is complete.
- Complete any narrow appropriate work if incomplete.
- Perform end-to-end verification.

### Files touched
- `apps/web/app/blackbook/page.tsx` (Phase 8 extension)
- `apps/web/app/analytics/page.tsx` (Phase 8 extension)
- `apps/web/app/components/FeedbackButtons.tsx` (Phase 6.3)

### What I did NOT touch
- Phase 3 (Daily Snapshot) - This requires backend changes and was deemed out of "narrow" scope for this verification session, but identified as the primary missing piece.
- Phase 7 (Model Learning) - Deferred as per data volume requirements.

### What was completed
- Extended Phase 8 error clarity (ErrorState, ErrorBoundary, RefreshControls) to the `Analytics` and `Blackbook` pages.
- Implemented `FeedbackButtons` component (Phase 6.3) to allow prediction quality reporting.
- Audited the entire repository and confirmed alignment with the `BUILD_SPEC.md` phases.
- Identified that Phase 3 (Daily Snapshot) is the only major non-deferred phase currently missing.
- Updated handover documentation with an accurate implementation checklist.

### What was not completed
- Phase 3 implementation (Backend Consolidator Missing).
- Full browser-based E2E testing due to environment path restrictions for Node/Pnpm binaries.

### Decisions made
- Chose to finish Phase 8 extension as the most "appropriate narrow work" after auditing the branch.
- Added Phase 6.3 FeedbackButtons to fulfill the UI/UX roadmap for pre-beta feedback.
- Documented Phase 3 as the next logical task to unlock performance targets.

### Questions asked owner
- None.

### Scope creep check
- None.

### Commit status
TBD (will commit after handover update)

### Recommended next work
- Implement Phase 3 (Daily Snapshot & Batch Optimization) to consolidate API requests and improve page load performance.
- Perform a full E2E verification once services are reachable in a stable environment.

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
