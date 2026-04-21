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
    market_odds: number | null,
    confidence: 'high' | 'medium' | 'low',
  },
  feature_impact: Array<{
    feature: string,
    weight: number,
    contribution: number
  }>,
  ai_insights_context: {
    data_quality: 'strong' | 'moderate' | 'thin',
    calibration_confidence: number,
    market_agreement: boolean,
    notes: string[]
  },
  model_metadata: {
    feature_importance: Record<string, number>,
    last_trained: string,
    version: string
  }
}
```

**What This Means:**
- Bob explainability (Phase 2) is NOT blocked — feature_impact exists
- Confidence labels (Phase 4) can derive from ai_insights_context
- Model learning dashboard (Phase 7) can use model_metadata

**Betslip Item Shape** (localStorage v1):
```typescript
{
  id: string,
  sport: 'racing' | 'afl' | 'nba',
  event_id: string,
  selection_id: string,
  selection_name: string,
  odds: number,
  stake: number,
  bet_type: 'win' | 'place' | 'each_way',
  added_at: string
}
```

**Watch Rule Shape** (structured form, not NLP):
```typescript
{
  id: string,
  user_id: string,
  subject: {
    type: 'horse' | 'team',
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

### Current phase
Phase 8 — Error Clarity + Performance Budget

### Agent ID
Codex

### Repo
```
BetMate (monorepo)
```

### Branch worked on
`v2-betmate-bob-and-ui-ux-upgrades`

### Assigned scope
- Continue only from the next appropriate approved phase after Phase 6.
- Keep the Phase 8 pass frontend-only, narrow, and aligned to the cached prediction surfaces already living in `apps/web/app/`.
- Make refresh failures and stale data understandable without changing backend contracts or inventing unsupported recovery behaviour.
- Preserve cached content and isolate section crashes so one broken block does not blank the whole page.

### API contracts confirmed before this session
- Confirmed the existing prediction payload fields already documented in the handover remain available:
  - `ai_insights_context`
  - `feature_impact`
  - `model_metadata`
- Phase 7 is still explicitly gated by settled-result volume and retrain history from `docs/BUILD_SPEC.md`, so it was not the next approved phase for this session.
- This Phase 8 slice relies on the existing frontend cache metadata only; no new API fields were required.

### Owner instructions for this session
- "Read docs/AGENT_HANDOVER.md and docs/BUILD_SPEC.md first."
- "Phase 1 is complete"
- "Phase 2 is complete and committed locally"
- "Continue from the next appropriate phase/task only"
- Frontend code is in `apps/web/app/`, not `apps/web/src/`.
- "Keep work narrow and phase-aligned"
- "Avoid unrelated refactors"
- "Do not push."
- "Before finishing: update docs/AGENT_HANDOVER.md with your session details."
- "Commit completed work with a descriptive message."
- "Inspect the current working tree and recent commit"
- "Continue from the next appropriate phase/task only"

### Files touched
- `apps/web/app/components/ErrorBoundary.tsx` (created)
- `apps/web/app/components/ErrorState.tsx` (created)
- `apps/web/app/lib/monitoring/performance.ts` (created)
- `apps/web/app/globals.css` (modified)
- `apps/web/app/page.tsx` (modified)
- `apps/web/app/racing/page.tsx` (modified)
- `apps/web/app/afl/page.tsx` (modified)
- `apps/web/app/nba/page.tsx` (modified)

### What I did NOT touch
- I did not change backend ML logic, weights, or API contracts.
- I did not change `apps/web/src/` paths from the old build spec examples; all new work stayed under `apps/web/app/`.
- I did not add new analytics vendors, Vercel configuration, or backend monitoring endpoints.
- I did not refactor unrelated feature flows such as paper betslip logic, Blackbook rules, or model analytics contracts.

### What was completed
- Added reusable Phase 8 frontend primitives:
  - `ErrorState` for friendly cached/stale/unavailable messaging
  - `ErrorBoundary` for isolating section crashes
  - `lib/monitoring/performance.ts` for lightweight refresh/stale telemetry events tied to the existing cache flow
- Updated the dashboard, Racing, AFL, and NBA pages to keep cached content visible during refresh failures and show honest delayed/unavailable copy instead of failing silently.
- Added page-level status messaging for:
  - cached snapshot fallback
  - stale snapshot visibility
  - unavailable snapshot states when no usable cache exists
  - background refresh progress while saved content remains on screen
- Added an AFL-specific reconnecting message so users know live scores may lag while predictions remain available.
- Wrapped major prediction/opportunity sections on dashboard, Racing, AFL, and NBA with local error boundaries so one crashing block does not take down the whole page.

### What was not completed
- No automated verification was run because owner rules say not to test unless explicitly asked.
- I did not extend the same Phase 8 treatment into Blackbook or Analytics in this session because the owner asked to keep the work narrow and phase-aligned.

### Decisions made
- Kept all new frontend work under `apps/web/app/` even where the build spec still references `src`, matching the actual repo structure and owner instruction.
- Treated Phase 8, not Phase 7, as the next approved phase because `docs/BUILD_SPEC.md` explicitly gates Phase 7 on settled-result volume and successful weekly retrains.
- Focused the Phase 8 pass on the cached prediction surfaces introduced in earlier phases because those are the highest-frequency user paths already depending on snapshot metadata.
- Reused existing cache timestamps and retry scheduling instead of inventing new backend freshness APIs.
- Kept messaging honest: BetMate now says when it is showing cached or delayed data, but does not pretend to have live market refresh when that payload does not exist.

### Questions asked owner
- No blocking clarification questions were needed after reading the handover/spec; the Phase 7 gating and Phase 8 dependency path were explicit enough to proceed.

### Owner answers received
- No new answers were required in this session after the handover/spec review because phase ordering and scope were explicit enough to proceed.

### Schema / migration changes
none

### New env vars
none

### Backend/API changes
none

### UI/UX changes
- Dashboard, Racing, AFL, and NBA now explain when BetMate is showing live refresh activity versus cached or delayed snapshots.
- Cached views remain visible during refresh issues instead of silently degrading.
- Sections with rendering failures now fall back locally with a retry affordance rather than breaking the whole page.
- AFL now explicitly tells the user when live scores are reconnecting while predictions remain usable.

### Known issues / blockers
- No blocking issues inside scope.
- Phase 7 remains blocked until the settled-result and retrain thresholds in `docs/BUILD_SPEC.md` are genuinely met.
- This Phase 8 pass only covers the dashboard and sport prediction surfaces; Blackbook and Analytics still use their existing page-level handling.

### Scope creep check
- Scope stayed within a narrow frontend-only Phase 8 slice on cached prediction surfaces and shared UI helpers.

### ML Engine impact
none

### Tests run
none


### Commit status
Pending local commit creation at end of session
Primary feature commit hash: `pending`
Primary feature commit message: `"Implement Phase 8 cached error clarity"`

### Push status
Not pushed — owner will review and push

### Notes for next agent
- ML logic correctly bypasses XGBoost and performs the manual weights defined in `app/ml/weights.py`.
- Be mindful that the backend relies heavily on Pydantic schemas in `main.py`.
- **Frontend Path Warning:** The repo uses `apps/web/app/` for Next.js, NOT `apps/web/src/`. Keep new frontend work under `app/`.
- Phase 7 is still gated. Re-read the settled-result and retrain requirements before touching model-learning/personalization work.
- The new Phase 8 status layer is currently wired into dashboard, Racing, AFL, and NBA only.
- Refresh telemetry is lightweight frontend event dispatch only; it does not persist anywhere by itself.

### Recommended next work
If the owner wants to continue Phase 8, extend the same error-boundary/status treatment to Analytics and Blackbook. Otherwise wait on Phase 7 until the documented data gates are honestly met.

#### Phase 8 Prompt for Next Agent:
"Phase 8 now covers dashboard plus Racing/AFL/NBA cached prediction surfaces.
If the owner wants another narrow frontend pass, extend the same honest error/stale-state treatment to remaining pages in `apps/web/app/` without changing backend contracts. Do not start Phase 7 unless the settled-data and retrain gates are truly satisfied."


---

## Cleanup And Handoff Rules (Mandatory)

Before finishing, every agent must:

1. ✅ Stay in BetMate repo only — no other repos
2. ✅ Complete only assigned phase scope — no feature creep
3. ✅ Ask owner before coding if requirements unclear
4. ✅ Ask owner during coding if meaningful decision appears
5. ✅ Stop and document blocker if no answer received
6. ✅ Check scope creep — document if out-of-scope files touched
7. ✅ Check API contracts — document if dependencies exist
8. ✅ Check schema changes — get owner approval before migration
9. ✅ Code everything assigned (or document what blocked you)
10. ✅ Test nothing unless owner explicitly asked
11. ✅ Commit completed work with descriptive message
12. ✅ Do not push (unless owner explicitly asked)
13. ✅ Update every section of this handover — no blanks
14. ✅ Write specific completion notes — no vague summaries

### Bad Handoff Examples

**Vague:**
```
What was completed: Updated UI
```

**Better:**
```
What was completed:
- Added ExplainDrawer component at apps/web/src/components/ExplainDrawer.tsx
- Integrated "Why this pick?" button on Racing and AFL prediction cards
- Created bob/explainer.ts with feature_impact rendering logic
- Tested drawer open/close on mobile and desktop
```

**Missing critical info:**
```
Schema changes: Added some tables
```

**Better:**
```
Schema changes:
- Created daily_snapshots table (migration: supabase/migrations/20260421_daily_snapshots.sql)
- Owner approved on 2026-04-21 at 14:30 AU time
- Migration tested locally, not yet applied to production
```

**Assumption instead of asking:**
```
Decisions made:
- Assumed Bob should show all features, implemented top 10
```

**Better:**
```
Questions asked owner:
- How many features should Bob show in explanation?

Owner answers received:
- Top 3 features only, keeps explanation focused

Decisions made:
- [Owner decision] Bob shows top 3 features sorted by contribution
```

---

## Phase Dependency Map

Some phases depend on others being complete:

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

**Before starting a phase, check:**
1. Are dependencies complete?
2. If not, is owner okay with you starting anyway?
3. Document any assumed dependencies here

**Critical path:**
- Phase 0 → Phase 2 (weights must be correct for Bob)
- Phase 2 → Phase 4 (onboarding needs "Why?" drawer)
- Phase 4 → Phase 6 (betslip persistence needed for warnings)

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

**Why this matters:**
- 1GB RAM is the hard limit
- If retrain uses >750MB, we're close to OOM crashes
- If retrain takes >20min, it might interfere with morning traffic
- Early warning lets owner upgrade instance before it breaks

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
Or: "none — all assigned tasks completed"

**Commit:**
- Hash: [commit hash]
- Message: [commit message]
- Pushed: No (unless owner requested)

**Blockers:**
- [any blockers]
Or: "none"

**Owner decisions needed:**
- [any decisions needed for next phase]
Or: "none — ready for next phase"

**Recommended next work:**
- [suggestion for next agent]

**Handover updated:** Yes
```

---

## Remember

- **Ask questions early** — don't assume
- **Document decisions clearly** — next agent needs context
- **Stop if blocked** — don't guess the answer
- **Stay in scope** — resist feature creep
- **Commit everything** — owner wants reviewable checkpoints
- **Push nothing** — unless explicitly asked
- **Update handover completely** — no blanks, no vague summaries

The goal is **continuous progress without drift.**

Every handover should make the next agent's job easier, not harder.
