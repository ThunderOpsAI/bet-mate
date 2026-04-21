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
Phase 6 — Paper Bet Flow + Blackbook Tightening

### Agent ID
Codex

### Repo
```
BetMate (monorepo)
```

### Branch worked on
`v2-betmate-bob-and-ui-ux-upgrades`

### Assigned scope
- Add consistent one-click paper bet actions across Racing, AFL, and NBA prediction surfaces in `apps/web/app/`.
- Tighten the persistent paper betslip with duplicate, stale-odds, event-started, and missing/unavailable data safeguards using current frontend payloads only.
- Tighten Blackbook/watch-rule UX without inventing unsupported backend trigger behaviour.
- Stay frontend-only, keep scope narrow, and preserve the honest/responsible framing from earlier phases.

### API contracts confirmed before this session
- Relied on the existing prediction payload fields already confirmed in the handover:
  - `ai_insights_context`
  - `feature_impact`
  - `model_metadata`
- Racing pages already expose live market price via `betfair_back_price`, which is enough for honest stale-odds comparisons when that price is present in the current tab snapshot.
- AFL and NBA pages still only expose fair odds on the touched frontend surfaces, so their paper bet flow remains model-led and explicitly does not claim live market comparison.
- Existing Blackbook frontend/backend flow still writes to `/blackbook/{runner}/auto-bet` with stake, bet type, probability threshold, enabled flag, and optional notification fields only.

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
- `apps/web/app/lib/betslip/betKey.ts` (created)
- `apps/web/app/components/PaperBetAction.tsx` (modified)
- `apps/web/app/components/PaperBetslip.tsx` (modified)
- `apps/web/app/providers/PaperBetslipProvider.tsx` (modified)
- `apps/web/app/lib/betslip/persistSlip.ts` (modified)
- `apps/web/app/blackbook/page.tsx` (modified)
- `apps/web/app/page.tsx` (modified)
- `apps/web/app/racing/page.tsx` (modified)
- `apps/web/app/afl/page.tsx` (modified)
- `apps/web/app/nba/page.tsx` (modified)

### What I did NOT touch
- I did not change backend ML logic, weights, or API contracts.
- I did not add server sync for the paper betslip, settlement changes, or new feedback/watch-rule database tables.
- I did not invent new Blackbook trigger types, opponent rules, or plain-English parsing.
- I did not refactor unrelated pages outside the dashboard, sport prediction surfaces, and Blackbook UX.

### What was completed
- Reworked `PaperBetAction` into a consistent quick-add action that opens the persistent slip, avoids silently adding exact duplicates, and shows the current slip count inline across dashboard, Racing, AFL, and NBA prediction surfaces.
- Extended the local paper betslip model with lightweight frontend-only metadata and a shared selection-key helper so the slip can reason about duplicate selections, event timing, and current tab snapshots.
- Added betslip warning and submission safeguards:
  - blocks logging when an event has already started
  - blocks logging when odds are missing/unusable
  - blocks logging when a selection is marked unavailable in the current snapshot
  - flags duplicate selections already present in persisted state
  - flags racing odds moves greater than 10% when a fresh Betfair price is honestly available in the current tab
  - explicitly explains that AFL/NBA remain model-fair-odds only because live market comparison is not available on these touched surfaces
- Updated racing paper-bet actions to use live market price when available and keep fair-odds fallback when not.
- Tightened racing watch-rule copy to read as a saved watch rule rather than promising invisible automation.
- Reworked the Blackbook page so it:
  - explains the current supported scope up front
  - offers direct “Add Horse” / “Add Team” entry points
  - provides browse links to today’s runners and upcoming AFL/NBA games
  - includes a simple builder for the currently supported saved-rule payload only
  - rephrases existing items as straightforward watch rules with threshold, stake, and notification preferences

### What was not completed
- No automated verification was run because owner rules say not to test unless explicitly asked.

### Decisions made
- Kept all new frontend work under `apps/web/app/` even where the build spec still references `src`, matching the actual repo structure and owner instruction.
- Reused the existing persistent Phase 4 paper betslip flow rather than introducing any server-side persistence or settlement logic.
- Used current-tab snapshot registration from the existing frontend surfaces to support honest stale-odds checks, instead of inventing background refresh or backend quote syncing.
- Limited stale-odds comparison to Racing selections with live `betfair_back_price`; AFL and NBA explicitly remain fair-odds-only and show informational messaging instead of fake market checks.
- Treated event-started, unavailable, and missing-odds states as blocking slip issues, while stale odds remain reviewable with explicit acknowledgement.
- Rephrased Blackbook UX around “watch rules” and “paper bet stake” so the UI matches the currently supported fields instead of overpromising richer automation.

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
- Added a one-click quick-add paper bet action with slip count context across dashboard, Racing, AFL, and NBA prediction surfaces.
- Added safer persistent betslip warnings for duplicates, started events, missing odds, unavailable selections, and racing stale-odds drift where the current frontend can honestly compare prices.
- Added an explicit stale-odds acknowledgement step before logging selections whose racing price moved materially after being added.
- Tightened racing watch-rule copy so it reads as a saved rule, not a magic automation promise.
- Reworked the Blackbook page with clear supported-scope copy, direct add entry points, browse links, and a simple builder for the currently supported rule payload.

### Known issues / blockers
- No blocking issues inside scope.
- Stale-odds comparison only works when the current tab has loaded a fresh frontend snapshot for that selection; this is intentional and surfaced in the UI instead of being faked.
- AFL and NBA still do not expose live market odds on the touched surfaces, so their paper bet actions and slip warnings stay model-led rather than price-led.

### Scope creep check
- Scope stayed within Phase 6 frontend UX work and reused the existing local slip/Blackbook contracts rather than expanding backend APIs or automation behaviour.

### ML Engine impact
none

### Tests run
none


### Commit status
Committed
Primary feature commit hash: `record after commit from git log`
Primary feature commit message: `"Implement Phase 6 paper bet flow safeguards"`

### Push status
Not pushed — owner will review and push

### Notes for next agent
- ML logic correctly bypasses XGBoost and performs the manual weights defined in `app/ml/weights.py`.
- Be mindful that the backend relies heavily on Pydantic schemas in `main.py`.
- **Frontend Path Warning:** The repo uses `apps/web/app/` for Next.js, NOT `apps/web/src/`. Keep new frontend work under `app/`.
- Phase 4 confidence badges still derive from `ai_insights_context` only; this session did not change confidence/urgency contracts.
- Racing stale-odds checks rely on `betfair_back_price` snapshots registered by the current tab. If future work needs stronger guarantees, it will need explicit product approval for backend quote refresh or frontend polling.
- AFL and NBA paper bet flows still run on fair odds only because those touched frontend payloads do not provide honest live market odds yet.
- Blackbook UI now better matches the currently supported rule payload, but richer watch-rule conditions from the build spec still need real backend support before they should be exposed.

### Recommended next work
Phase 7 — Model Learning / Results UX once enough settled data exists

#### Phase 6 Prompt for Next Agent:
"Phase 6 is complete on the frontend.
If the owner wants to continue sequentially, move to the next approved phase only after re-reading BUILD_SPEC.md and confirming data dependencies. Keep the same repo/branch rules, stay in `apps/web/app/`, and do not run tests unless explicitly asked."


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
