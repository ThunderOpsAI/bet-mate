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
Phase 5 — Betting Literacy + Opportunity Discovery

### Agent ID
Codex

### Repo
```
BetMate (monorepo)
```

### Branch worked on
`v2-betmate-bob-and-ui-ux-upgrades`

### Assigned scope
- Implement Phase 5 betting literacy and opportunity discovery work in `apps/web/app/`.
- Add shared fair-odds and value education affordances under `apps/web/app/components/`.
- Add sport-specific opportunity sections for Racing, AFL, and NBA using the existing confidence and urgency signals where useful.
- Add a small dashboard summary of top sport-specific opportunities only.
- Stay frontend-only, avoid cross-sport ranking, and preserve the honest/responsible framing from Phases 2 and 4.

### API contracts confirmed before this session
- Relied on the existing prediction payload fields already confirmed in the handover:
  - `ai_insights_context`
  - `feature_impact`
  - `model_metadata`
- Racing pages already expose live market price via `betfair_back_price`, which is enough for honest edge/value messaging there.
- AFL and NBA pages still only expose fair odds on the frontend surfaces touched in this session, so their opportunity sections were kept model-led rather than price-edge driven.

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
- `apps/web/app/components/EducationTooltip.tsx` (created)
- `apps/web/app/components/OpportunitySection.tsx` (created)
- `apps/web/app/components/racing/BestOpportunities.tsx` (created)
- `apps/web/app/components/afl/BestOpportunities.tsx` (created)
- `apps/web/app/components/nba/BestOpportunities.tsx` (created)
- `apps/web/app/lib/opportunityScore.ts` (created)
- `apps/web/app/page.tsx` (modified)
- `apps/web/app/racing/page.tsx` (modified)
- `apps/web/app/afl/page.tsx` (modified)
- `apps/web/app/nba/page.tsx` (modified)
- `apps/web/app/globals.css` (modified)

### What I did NOT touch
- I did not change backend ML logic, weights, or API contracts.
- I did not add any backend pricing feed, cross-sport ranking, or Phase 3 snapshot work.
- I did not refactor unrelated pages outside the dashboard and the three sport prediction surfaces.

### What was completed
- Added shared education tooltip UI for fair odds, edge/value, model probability, and market disagreement concepts.
- Added a client-side opportunity scoring helper that combines edge, confidence, urgency, and win probability without inventing any cross-sport normalisation.
- Added sport-specific opportunity sections for Racing, AFL, and NBA, with Racing showing real price edge only when live market odds are available.
- Added a compact dashboard summary showing top Racing, AFL, and NBA opportunities separately instead of creating a cross-sport ranked feed.
- Added inline value badges where Racing already has honest live market comparison data, including dashboard racing cards and full racing table rows.

### What was not completed
- No automated verification was run because owner rules say not to test unless explicitly asked.

### Decisions made
- Kept all new frontend work under `apps/web/app/` even where the build spec still references `src`, matching the actual repo structure and owner instruction.
- Used the Phase 4 shared confidence and urgency helpers as inputs to opportunity ranking so the new sections stay consistent with the current trust language.
- Kept Racing as the only sport with explicit edge/value claims because that is the only touched surface that already exposes live market price in the current frontend payload.
- Framed AFL and NBA opportunity sections as model-led discovery cards, explicitly noting that no live market price is attached there yet.
- Added sport-specific dashboard summaries only, preserving the spec rule that cross-sport ranked feeds are deferred to V2.

### Questions asked owner
- No blocking clarification questions were needed after reading the handover/spec; scope and API contract were explicit enough to proceed.

### Owner answers received
- No new answers were required in this session after the handover/spec review because phase ordering and scope were explicit enough to proceed.

### Schema / migration changes
none

### New env vars
none

### Backend/API changes
none

### UI/UX changes
- Added reusable betting literacy tooltips for fair odds, edge/value, model probability, and market disagreement.
- Added sport-specific opportunity discovery sections above Racing, AFL, and NBA prediction lists.
- Added a compact dashboard opportunities summary for the top Racing, AFL, and NBA reads.
- Added positive-value badges to racing selections where live market odds are longer than model fair odds.

### Known issues / blockers
- None blocking inside scope.
- AFL and NBA opportunity sections remain model-led because those pages do not currently expose explicit market odds on the touched frontend payloads.

### Scope creep check
- Scope stayed within Phase 5 frontend UX work and reused shared signal helpers rather than expanding backend contracts or ranking logic.

### ML Engine impact
none

### Tests run
none


### Commit status
Pending final local commit for Phase 5 work.

### Push status
Not pushed — owner will review and push

### Notes for next agent
- ML logic correctly bypasses XGBoost and performs the manual weights defined in `app/ml/weights.py`.
- Be mindful that the backend relies heavily on Pydantic schemas in `main.py`.
- **Frontend Path Warning:** The repo uses `apps/web/app/` for Next.js, NOT `apps/web/src/`. Keep new frontend work under `app/`.
- Phase 4 confidence badges still derive from `ai_insights_context` only; Phase 5 opportunity ranking reuses those signals rather than introducing a new confidence contract.
- Racing value badges rely on `betfair_back_price`; AFL and NBA still need real frontend market odds before any honest edge calculation can be shown there.
- The new dashboard opportunity summary is intentionally split by sport. Do not collapse it into one cross-sport ranked list unless the owner explicitly approves V2 behaviour.

### Recommended next work
Phase 6 — Paper Bet Flow + Blackbook Tightening

#### Phase 6 Prompt for Next Agent:
"Starting Phase 6: Paper Bet Flow + Blackbook Tightening.
Goal: make paper betting actions more consistent and safer now that Phase 4 persistence and Phase 5 opportunity discovery are in place.
1. Add consistent one-click paper bet actions across Racing, AFL, and NBA prediction cards where the spec calls for them.
2. Add smart betslip warnings for duplicates, stale odds, event-started state, and missing/unavailable selections using the existing slip state and current frontend payloads only.
3. Tighten the Blackbook/watch-rule UX without inventing backend trigger behaviour that does not already exist.
4. Keep all work in `apps/web/app/`, stay narrow, and do not run tests unless the owner asks.
Reference BUILD_SPEC.md Phase 6 for details."


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
