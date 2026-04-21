# BetMate Pre-Beta Build Spec

## Purpose

This document translates the Pre-Beta UX Roadmap into executable agent work packages.

Each phase is scoped for one agent session, with clear inputs, outputs, dependencies, and UX success criteria. Phases are designed for parallel work where dependencies allow.

**Owner priority:** UX, trust, speed, onboarding, explainability. Backend work is acceptable only when it directly improves user experience.

---

## Build Principles

- **Ship working UX, not perfect architecture**
- **Trust before speed** — users must believe predictions before caring how fast they load
- **Explainability is non-negotiable** — every prediction must have a "Why?"
- **No phantom features** — if the backend doesn't support it, don't build the UI
- **Mobile-first** — most users will be on phones at racetracks or watching games
- **Paper betting is the core loop** — make it stupid simple

---

## Phase 0 — ML Engine Weight Configuration (MUST RUN FIRST)

### Scope
Replace current ML weights with owner-specified configuration before any UX work begins.

**This phase must complete before Phase 2 (Bob Explainability)** because Bob's explanations are based on feature weights.

### Agent Tasks

**0.1 — Implement Racing Weights**
Update `services/ml-engine/src/models/racing_model.py`:

New weights (see ML_WEIGHTS.md for full details):
- Speed Rating: 15%
- Horse Win Rate: 10%
- Jockey Win Rate: 5%
- Recent Form: 8%
- Track Conditions: 7%
- Class: 5%
- Barrier Draw: -2% penalty per position
- Carry Weight: -1% penalty per kg over 54kg
- Horse-Jockey Proven Combo: 2.0x multiplier
- Jockey-Trainer Proven Combo: 1.5x multiplier
- Live Odds Signal: 12% blend

**0.2 — Implement NBA Weights**
Update `services/ml-engine/src/models/nba_model.py`:

New weights:
- Offensive Rating: 20%
- Defensive Rating: 20%
- Recent Form (last 10): 15%
- Head-to-Head History: 10%
- Usage Rate: 8%
- Live Odds Signal: 15% blend
- Home Court: 5% (10% for Toronto)
- Back-to-Back: -1.5x multiplier
- Rest Advantage: +3%

**0.3 — Implement AFL Weights**
Update `services/ml-engine/src/models/afl_model.py`:

New weights:
- Points For/Against Diff: 25%
- Recent Form: 20%
- Home Ground Advantage: 10% (context-dependent)
- Head-to-Head: 10%
- Squiggle Signal: 15%
- Live Odds Signal: 12% blend
- Travel Fatigue: -8% for long-distance interstate

**0.4 — Create Weight Configuration File**
Create `services/ml-engine/config/model_weights.yaml`:
```yaml
racing:
  base_weights:
    speed_rating: 0.15
    horse_win_rate: 0.10
    jockey_win_rate: 0.05
    recent_form: 0.08
    track_conditions: 0.07
    class: 0.05
    barrier_penalty: -0.02
    weight_penalty: -0.01
  multipliers:
    horse_jockey_combo: 2.0
    jockey_trainer_combo: 1.5
  live_odds_blend: 0.12

nba:
  base_weights:
    offensive_rating: 0.20
    defensive_rating: 0.20
    recent_form: 0.15
    head_to_head: 0.10
    usage_rate: 0.08
  adjustments:
    home_court_standard: 0.05
    home_court_toronto: 0.10
    b2b_multiplier: -1.5
    rest_advantage: 0.03
  live_odds_blend: 0.15

afl:
  base_weights:
    points_differential: 0.25
    recent_form: 0.20
    home_ground: 0.10
    head_to_head: 0.10
    squiggle_signal: 0.15
  adjustments:
    travel_penalty_max: -0.08
  live_odds_blend: 0.12
```

**0.5 — Update Feature Extraction**
Ensure all required features are being extracted:

Racing needs:
- Speed ratings (if not already tracked)
- Horse-jockey combination history
- Jockey-trainer combination statistics
- Track condition matching

NBA needs:
- Offensive/Defensive rating differential
- Last 10 games form
- Head-to-head last 5 matchups
- Player usage rates
- Rest days tracking

AFL needs:
- Points for/against differential
- Interstate travel distance calculation
- Ground-specific home advantage

**0.6 — Test Prediction Changes**
Before committing:
- Run predictions on sample events from each sport
- Verify probabilities sum to 1.0 within field/matchup
- Check feature_impact output reflects new weights
- Confirm live odds blending works when odds available
- Log sample predictions for owner review

### Files Touched
- `services/ml-engine/src/models/racing_model.py`
- `services/ml-engine/src/models/nba_model.py`
- `services/ml-engine/src/models/afl_model.py`
- `services/ml-engine/config/model_weights.yaml` (new)
- `services/ml-engine/src/utils/feature_extraction.py` (if features missing)

### Dependencies
None — this is foundational.

### Success Criteria
- Predictions use new weight configuration
- Feature importance in API response matches new weights
- Probabilities are well-calibrated (sum to 1.0, realistic ranges)
- Live odds blending works correctly
- Old weight configuration completely removed

### Backend Work
**Fully justified:** This directly improves prediction quality and makes Bob's explanations (Phase 2) more accurate and trustworthy.

---

## Critical Backend Constraints

### ML Engine (Lightsail AU)
- **1GB RAM, 2 vCPUs, 40GB SSD**
- Nightly scrape runs at 2am AU (cron)
- Weekly retrain runs at 3am Sunday AU (cron, off-peak)
- Must monitor memory during retrain — log start/end/duration/peak memory
- If retrain takes >20min or uses >750MB, alert owner
- Keep old model warm until new model validates

### Current Data Available
The ML engine already returns:
- `feature_impact` — per-feature contribution to prediction
- `ai_insights_context` — metadata about data quality, confidence
- `model_metadata` — includes feature importance rankings

**Bob explainability (Phase 2) is NOT blocked.** The data exists.

### What Does NOT Exist Yet
- Batch prediction endpoints (Phase 3 work)
- Daily snapshot storage (Phase 3 work)  
- Server-side betslip persistence (Phase 4 uses localStorage v1)
- Cross-sport ranking normalization (Phase 5 deferred to V2)

---

## Pre-Work: ML Weights Configuration

**MUST BE COMPLETED BEFORE ANY PHASES START**

The ML engine weights need to be updated from the old LLM-generated guesses to the corrected domain-expert weights.

### Task

Update `services/ml-engine/src/config/weights.py` with the weights specified in `WEIGHTS_CONFIG.md`.

### Implementation

Replace the current weight constants with:

**Racing:**
```python
RACING_WEIGHTS = {
    "speed_rating": 0.15,
    "horse_win_rate": 0.10,
    "jockey_win_rate": 0.05,
    "track_conditions": 0.08,
    "recent_form": 0.08,
    "barrier_penalty": -0.03,
    "weight_penalty": -0.03,
    "class_factor": 0.04,
}

RACING_MULTIPLIERS = {
    "horse_jockey_combo": 2.0,  # TRUE if won together in last 12mo
    "jockey_trainer_combo": 1.5,  # TRUE if 20%+ strike rate together
}
```

**NBA:**
```python
NBA_WEIGHTS = {
    "off_rating": 0.20,
    "def_rating": 0.20,
    "recent_form_10": 0.15,
    "head_to_head": 0.10,
    "usage_rates": 0.10,
    "live_odds_signal": 0.15,
    "home_court_base": 0.05,
}

NBA_MULTIPLIERS = {
    "back_to_back": 0.85,
}

NBA_HOME_FACTORS = {
    "toronto_international": 0.10,  # Toronto vs US team or vice versa
    "standard": 0.05,
}
```

**AFL:**
```python
AFL_WEIGHTS = {
    "points_differential": 0.25,
    "squiggle_signal": 0.25,
    "recent_form_5": 0.20,
    "win_streak": 0.15,
    "home_advantage_base": 0.05,
}

AFL_TRAVEL_FACTORS = {
    "interstate_long": 0.10,  # WA/QLD/SA vs VIC
    "standard": 0.05,
}
```

Add version constant:
```python
WEIGHTS_VERSION = "v1.0_manual_2026-04-21"
```

### Files Touched
- `services/ml-engine/src/config/weights.py`
- Update any prediction calculation code that references old weight names

### Testing
- Verify predictions still generate (smoke test)
- Check that new weights are being applied in logs
- Confirm WEIGHTS_VERSION appears in prediction metadata

### Completion Criteria
- Old arbitrary weights replaced
- New domain-expert weights active
- Prediction calculation code updated to use new weight structure
- Weights frozen until auto-tune has data

---

## Phase Execution Order

**Recommended sequence for this week:**

1. **Phase 0** — ML Weight Configuration (MUST RUN FIRST — backend)
2. **Phase 1** — Cache + Refresh UX (foundation for everything)
3. **Phase 2** — Bob Explainability (unlocks trust, requires Phase 0 weights)
4. **Phase 4** — Onboarding + Persistent Slip (enables workflow)
5. **Phase 6** — Paper Bet + Blackbook (core loop tightening)
6. **Phase 3** — Snapshot + Batch (speed optimization, needs UX validated first)
7. **Phase 5** — Betting Literacy + Opportunities (discovery)
8. **Phase 8** — Error Clarity + Performance Budget (polish)
9. **Phase 7** — Model Learning + Personalization (requires settled data volume)

**Critical path:**
- Phase 0 MUST complete before Phase 2 (Bob needs correct weights for explanations)
- Phase 0 can run in parallel with Phase 1 (different codebases)

**Parallel work opportunities:**
- Phase 0 + Phase 1 can run simultaneously (backend vs frontend)
- Phase 4 + Phase 6 can overlap (onboarding doesn't touch betslip state)
- Phase 5 + Phase 8 can run together (no file conflicts)

---

## Phase 1 — Shared ML Cache + Refresh UX

### Scope
Make BetMate feel fast after first load by caching ML data client-side and refreshing in background.

### Agent Tasks

**1.1 — Shared Cache Layer**
- Create `apps/web/src/lib/cache/mlDataCache.ts`
- 5-minute TTL cache for predictions, fixtures, odds
- Keys: `predictions:{sport}:{date}`, `fixtures:{sport}:{date}`
- Cache stores: prediction data, last_updated timestamp, next_refresh_at
- Stale data remains visible during refresh

**1.2 — Auto-Refresh UI**
Update these pages to use cache:
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/racing/page.tsx`
- `apps/web/src/app/afl/page.tsx`
- `apps/web/src/app/nba/page.tsx`

Add to each page:
- "Last updated: 2 min ago" timestamp
- "Auto-refresh in: 3:24" countdown
- Manual "Refresh now" button
- Non-blocking refresh state (show spinner in header, keep content visible)

**1.3 — Loading States**
- Full-page loader ONLY when cache is empty
- After first load, show cached content + "Refreshing..." indicator in header
- Skeleton cards ONLY for empty cache state

### Files Touched
- `apps/web/src/lib/cache/mlDataCache.ts` (new)
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/racing/page.tsx`
- `apps/web/src/app/afl/page.tsx`
- `apps/web/src/app/nba/page.tsx`
- `apps/web/src/components/RefreshControls.tsx` (new)

### Dependencies
None — this phase is foundational.

### UX Success Criteria
- Navigate Dashboard → Racing → AFL → NBA with zero repeated waits
- Timestamp shows when data was last fetched
- Countdown shows when next refresh will occur
- Manual refresh updates data without blanking the page

### Backend Work
None.

---

## Phase 2 — BetMate Bob Explainability

### Scope
Turn Bob into the explanation layer for ML picks using existing feature_impact data.

### Agent Tasks

**2.1 — "Why This Pick?" Drawer**
Create a drawer/modal component that opens from any prediction card:
- `apps/web/src/components/ExplainDrawer.tsx`
- Shows horse/team name, model probability, fair odds, market odds
- Explains in plain English why the model likes or dislikes the pick

**2.2 — Bob Explanation Engine**
Create `apps/web/src/lib/bob/explainer.ts`:
- Takes: `feature_impact`, `ai_insights_context`, `model_metadata`
- Returns: plain-English explanation in Bob's voice

Example outputs:
- "I like this pick because the jockey has won 8 of 12 recent races at this track, and the barrier draw is favorable."
- "The model is cautious here — limited recent form data and heavy carry weight."
- "Strong signal: This team is on a 6-game win streak and playing at home."

Tone rules:
- Useful, not overclaiming
- Honest about data limits
- Confidence-aware ("I like this" vs "The data is thin here")
- No generic chatbot responses

**2.3 — Bob Brand Update**
- Update Bob logo/avatar when design assets available
- Consistent Bob presence across all "Why?" drawers
- Bob explains, he doesn't sell

**2.4 — Integration**
Add "Why this pick?" button/link to:
- `apps/web/src/components/PredictionCard.tsx`
- Racing prediction rows
- AFL game cards  
- NBA game cards

### Files Touched
- `apps/web/src/components/ExplainDrawer.tsx` (new)
- `apps/web/src/lib/bob/explainer.ts` (new)
- `apps/web/src/components/PredictionCard.tsx`
- Racing/AFL/NBA prediction components

### Dependencies
**CRITICAL:** 
- Requires Phase 0 weight configuration to be complete — Bob explains features based on their actual weights
- Verify `feature_impact` and `ai_insights_context` exist in current prediction API response before coding
- If missing, this phase is blocked

### UX Success Criteria
- Every prediction card has a clear "Why this pick?" action
- Drawer opens with Bob-branded explanation
- Explanation feels useful and honest, not generic
- Users can close drawer and return to predictions seamlessly

### Backend Work
**If** feature_impact or ai_insights_context are missing from current API, backend work is required:
- Update ML engine prediction response to include these fields
- Document the data contract in `services/ml-engine/docs/prediction-schema.md`

---

## Phase 3 — Daily Snapshot + Batch Predictions

### Scope
Prepare predictions before users arrive and reduce fan-out loading.

**NOTE:** This phase should run AFTER Phase 2 and Phase 4 validate the UX experience. Speed optimization only matters if users trust what they're seeing.

### Agent Tasks

**3.1 — Daily Snapshot Job**
- `services/ml-engine/src/jobs/daily_snapshot.py`
- Runs at 5am AU (after nightly scrape, before peak traffic)
- Generates predictions for all today's races/games
- Stores in Supabase: `daily_snapshots` table
- Schema:
  ```sql
  create table daily_snapshots (
    id uuid primary key default gen_random_uuid(),
    sport text not null,
    snapshot_date date not null,
    predictions jsonb not null,
    created_at timestamptz default now(),
    unique(sport, snapshot_date)
  );
  ```

**3.2 — Batch Prediction Endpoints**
Create batch-style prediction access:
- `GET /api/predictions/racing/daily` — all today's racing predictions
- `GET /api/predictions/afl/daily` — all today's AFL games
- `GET /api/predictions/nba/daily` — all today's NBA games

Returns: full prediction data from snapshot + live odds if available.

**3.3 — Frontend Integration**
Update pages to:
1. Request daily snapshot first (fast)
2. Refresh live odds in background
3. Show "Using latest snapshot" when appropriate

**3.4 — Engine Status Messaging**
Add clear status messages:
- "Engine warm" — snapshot ready, live odds available
- "Refreshing markets" — snapshot ready, fetching latest odds
- "Using daily snapshot" — snapshot ready, live odds unavailable
- "Live model ready" — real-time prediction + live odds

### Files Touched
- `services/ml-engine/src/jobs/daily_snapshot.py` (new)
- `apps/web/src/app/api/predictions/[sport]/daily/route.ts` (new)
- Supabase migration: `supabase/migrations/XXX_daily_snapshots.sql` (new)
- Dashboard/Racing/AFL/NBA page updates

### Dependencies
- Requires Phase 1 cache layer (to store snapshot data)
- Should run AFTER Phase 2 validates explainability UX

### UX Success Criteria
- First load shows predictions within 1-2 seconds
- Users see clear messaging about data freshness
- No fan-out loading across multiple races/games
- Graceful degradation when live odds unavailable

### Backend Work
**Justified:** Daily snapshot reduces load time and makes the app feel ready before users arrive.

---

## Phase 4 — Onboarding + Confidence + Persistent Slip

### Scope
Help new users understand BetMate and keep their betting workflow intact.

### Agent Tasks

**4.1 — ML Engine Explainer Page**
Create `apps/web/src/app/how-it-works/page.tsx`:

Explains:
- What the prediction engine does
- How nightly scraping works
- How weekly retraining works
- Why more data improves calibration
- What fair odds mean
- What paper bets are
- How to use BetMate responsibly

Include:
- Short explainer video or interactive diagram
- Plain-English glossary
- Links to learn more about betting concepts

**4.2 — First-Run Onboarding Tour**
Create `apps/web/src/components/OnboardingTour.tsx`:

Steps:
1. View predictions
2. Open "Why this pick?" (requires Phase 2)
3. Add selection to paper betslip
4. Track bankroll and results
5. Review analytics

Use a library like `react-joyride` or build custom tooltips.

Trigger: First visit or if user has never added a paper bet.

**4.3 — Prediction Confidence Labels**
Add confidence indicators to prediction cards:
- "High confidence" — strong data, model agrees with market
- "Medium confidence" — moderate data quality
- "Thin data" — limited historical data
- "Market disagrees" — model probability differs significantly from market odds
- "Model-only view" — no market odds available

Derive from `ai_insights_context` fields.

**4.4 — Event Urgency States**
Add urgency/status indicators:
- "Starts in 12 min" — race/game imminent
- "Live soon" — within 1 hour
- "Today" — same-day event
- "Closed" — betting closed, race/game started
- "Result pending" — event finished, awaiting official result
- "Settled" — result confirmed, paper bets resolved

**4.5 — Persistent Paper Betslip**
Implement localStorage-based betslip persistence:
- `apps/web/src/lib/betslip/persistSlip.ts`
- Save slip state on every add/remove/update
- Restore slip on page load
- Clear slip on explicit user action only
- Sync across tabs using storage events

**V1 uses localStorage.** Server-side sync is V2.

### Files Touched
- `apps/web/src/app/how-it-works/page.tsx` (new)
- `apps/web/src/components/OnboardingTour.tsx` (new)
- `apps/web/src/lib/betslip/persistSlip.ts` (new)
- Prediction card components (confidence labels)
- Event list components (urgency states)
- Betslip component (persistence integration)

### Dependencies
- Requires Phase 2 "Why this pick?" for onboarding step 2
- Cache layer from Phase 1 helps with tour performance

### UX Success Criteria
- New users see onboarding tour on first visit
- Tour completes in <60 seconds
- Confidence labels help users interpret predictions
- Urgency states prevent betting on closed events
- Betslip survives refresh, navigation, and tab switches
- "How It Works" page answers basic questions clearly

### Backend Work
None. Persistence is localStorage v1.

---

## Phase 5 — Betting Literacy + Opportunity Discovery

### Scope
Help users understand model output and discover useful opportunities.

**NOTE:** Cross-sport ranked feed is V2. Ship sport-specific sections first.

### Agent Tasks

**5.1 — Fair Odds Education**
Add tooltips/explainers throughout the UI:
- What are fair odds?
- What is edge/value?
- How to interpret model probability?
- What does "model disagrees with market" mean?

Use `apps/web/src/components/EducationTooltip.tsx` for consistent styling.

**5.2 — Edge/Value Indicators**
When market odds > model fair odds, show edge/value:
- "Good value: Market paying $4.50, model fair odds $3.20"
- Badge on prediction card: "Edge: 28%"
- Use responsible language, avoid "guaranteed profit" framing

**5.3 — Sport-Specific Best Opportunities**
Create opportunity sections on each sport page:
- `apps/web/src/components/racing/BestOpportunities.tsx`
- `apps/web/src/components/afl/BestOpportunities.tsx`
- `apps/web/src/components/nba/BestOpportunities.tsx`

Ranking formula (within each sport):
```
Opportunity Score = 
  (model_edge × 0.45) +           // value gap
  (confidence × 0.30) +            // data quality
  (recency_urgency × 0.15) +       // time until start
  (model_probability × 0.10)       // raw win probability
```

Show top 5 opportunities per sport.

**5.4 — Dashboard Cross-Sport View**
On dashboard, show:
- Top 3 racing opportunities
- Top 2 AFL opportunities
- Top 2 NBA opportunities

Links to full sport pages.

### Files Touched
- `apps/web/src/components/EducationTooltip.tsx` (new)
- `apps/web/src/lib/scoring/opportunityScore.ts` (new)
- `apps/web/src/components/racing/BestOpportunities.tsx` (new)
- `apps/web/src/components/afl/BestOpportunities.tsx` (new)
- `apps/web/src/components/nba/BestOpportunities.tsx` (new)
- `apps/web/src/app/dashboard/page.tsx` (add cross-sport view)

### Dependencies
- Requires Phase 2 confidence data for opportunity scoring
- Works better with Phase 3 batch predictions (fewer requests)

### UX Success Criteria
- Users understand what fair odds and edge mean
- Best opportunities feel like helpful discovery, not promises
- Each sport page has clear "today's best" section
- Dashboard gives quick overview across all sports
- Educational tooltips answer questions without leaving the page

### Backend Work
None. Scoring happens client-side using existing prediction data.

---

## Phase 6 — Paper Bet Flow + Blackbook Tightening

### Scope
Make paper betting and Blackbook workflow smooth, safe, and useful.

### Agent Tasks

**6.1 — One-Click Paper Bet Actions**
Every prediction card needs consistent paper bet actions:
- Quick-add button (uses default stake from settings)
- Opens betslip drawer for review before confirmation
- Shows current slip count badge

Ensure consistency across:
- Racing prediction rows
- AFL game cards
- NBA game cards

**6.2 — Smart Betslip Warnings**
Add validation warnings before bet submission:
- Duplicate selection (same horse/team already in slip)
- Stale odds (market odds changed >10% since card loaded)
- Event already started
- Missing required data (no odds available)
- Selection scratched/unavailable
- Odds changed notification with option to proceed or cancel

**6.3 — Pre-Beta Feedback on Predictions**
Add lightweight feedback buttons to prediction cards:
- "Helpful" — this prediction was useful
- "Looks wrong" — model seems off
- "Data issue" — missing or incorrect data
- "Confusing" — unclear presentation

Stores feedback in Supabase:
```sql
create table prediction_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  prediction_id text not null,
  sport text not null,
  feedback_type text not null,
  created_at timestamptz default now()
);
```

**6.4 — Blackbook Direct Add Flow**
Update Blackbook page:
- "Add Horse" button → opens horse search/selector
- "Add Team" button → opens team selector
- "Browse Today's Runners" → quick-add from today's races
- "Browse Upcoming Games" → quick-add from upcoming fixtures

No more empty-state dead ends.

**6.5 — Blackbook Structured Watch Rules**
Create watch rule builder:
- Horse/team selector
- Action: "Back them" or "Back opponent"
- Stake amount
- Trigger condition:
  - When they run/play
  - When odds reach X
  - When certain opponent
- Notify or auto-log paper bet

**V1 uses structured form.** Plain-English parsing ("When Winx runs, auto-log $10") is V2.

UI should READ like plain English, but store structured data:
```typescript
{
  subject: { type: 'horse', id: 'winx_123', name: 'Winx' },
  action: 'back',
  stake: 10,
  trigger: { type: 'event', condition: 'participates' },
  autoAction: 'log_paper_bet'
}
```

### Files Touched
- `apps/web/src/components/PredictionCard.tsx` (paper bet actions)
- `apps/web/src/components/Betslip.tsx` (warnings)
- `apps/web/src/components/FeedbackButtons.tsx` (new)
- `apps/web/src/app/blackbook/page.tsx` (add flow)
- `apps/web/src/components/blackbook/WatchRuleBuilder.tsx` (new)
- Supabase migration: `supabase/migrations/XXX_prediction_feedback.sql` (new)
- Supabase migration: `supabase/migrations/XXX_watch_rules.sql` (new)

### Dependencies
- Phase 4 persistent betslip for warnings to work correctly
- Phase 1 cache for quick-add from today's events

### UX Success Criteria
- Adding paper bet feels instant and consistent
- Warnings catch mistakes before submission
- Feedback buttons let users report issues quickly
- Blackbook page has clear add actions, no dead ends
- Watch rules are easy to create and understand
- Auto-logged paper bets appear in slip automatically

### Backend Work
**Justified:** Watch rule evaluation requires backend job to check triggers nightly and create auto-logged paper bets.

Create `services/ml-engine/src/jobs/evaluate_watch_rules.py`:
- Runs after nightly scrape
- Checks active watch rules against today's events
- Creates paper bet entries when triggers match
- Sends notification if user opted in

---

## Phase 7 — Model Learning + Personalization

### Scope
Make BetMate feel like it learns over time and adapts to user preferences.

**IMPORTANT:** This phase requires settled results volume. Do not ship until:
- At least 30 settled results per sport
- Weekly retrain has run successfully 2+ times
- Calibration metrics are stable

### Agent Tasks

**7.1 — Model Learning Dashboard**
Create `apps/web/src/app/model-performance/page.tsx`:

Shows:
- Predictions logged (total count)
- Settled results (by sport)
- Accuracy trend (% correct picks)
- Calibration trend (predicted probability vs actual outcomes)
- Sports covered
- Last weekly retrain date
- Top features currently (from model_metadata)
- Recent model changes (if weekly retrain ran)

Charts:
- Accuracy over time (line chart)
- Calibration curve (predicted prob vs actual rate)
- Feature importance (bar chart)

**7.2 — Weekly "Got Smarter" Changelog**
After weekly retrain, generate plain-English summary:

Example:
> "AFL model retrained on 42 new results. Travel fatigue became more important this week, while home-ground advantage softened slightly. Overall accuracy improved from 64% to 67%."

Store in `model_changelogs` table, display on dashboard.

**7.3 — Personalized Strategy Profiles**
Create profile selector:
- Conservative (favor high-confidence, low-edge picks)
- Balanced (default model output)
- Aggressive (favor high-edge, accept lower confidence)
- Longshot Hunter (favor underdogs with value)

**V1 profiles are filtering/ranking preferences**, not different models:
- Conservative: filter out <50% confidence picks, rank by confidence
- Aggressive: show all picks, rank by edge
- Longshot Hunter: show underdogs with positive edge

Store user preference, apply to opportunity feeds and predictions list.

### Files Touched
- `apps/web/src/app/model-performance/page.tsx` (new)
- `apps/web/src/components/ModelLearningChart.tsx` (new)
- `apps/web/src/components/ProfileSelector.tsx` (new)
- `apps/web/src/lib/profiles/applyProfile.ts` (new)
- Supabase migration: `supabase/migrations/XXX_model_changelogs.sql` (new)

### Dependencies
- Requires settled results data (30+ per sport minimum)
- Requires weekly retrain to have run successfully
- Phase 5 opportunity scoring for profile filtering

### UX Success Criteria
- Users can see the model is improving over time
- Weekly changelog makes model changes understandable
- Strategy profiles feel personalized without being overwhelming
- Model performance page builds trust through transparency

### Backend Work
**Justified:** Generating weekly changelog requires backend processing of retrain results.

Create `services/ml-engine/src/jobs/generate_changelog.py`:
- Runs after weekly retrain completes
- Compares old vs new feature importance
- Generates plain-English summary
- Stores in `model_changelogs` table

---

## Phase 8 — Error Clarity + Performance Budget

### Scope
Make failures understandable and protect app performance as it scales.

### Agent Tasks

**8.1 — User-Friendly Error States**
Replace generic errors with helpful messages:

Examples:
- "Live odds unavailable, using model-only probabilities"
- "Racing data delayed. Showing latest cached snapshot"
- "AFL scores refreshing. Predictions still available"
- "ML engine warming up. Last saved predictions shown below"
- "This event has started. Betting closed"
- "Result pending. Check back in 10 minutes"

Error states should:
- Explain what happened
- Say what BetMate is doing about it
- Preserve any usable cached data
- Offer manual refresh option

**8.2 — Graceful Degradation**
When refresh fails:
- Keep old data visible
- Show clear stale-data warning
- Allow manual retry
- Don't blank the page

**8.3 — Performance Budget**
Define and enforce:
- Cached views render in <2 seconds
- Pages never blank out if cached data exists
- Manual refresh shows progress within 500ms
- Slow backend calls (>5s) degrade gracefully
- Users always know: live / cached / stale / unavailable

**8.4 — Monitoring Setup**
Track performance signals:
- Slow page loads (>3s)
- Refresh failures (API errors)
- Stale data age (>10min)
- Backend timeout patterns
- Empty state frequency
- Failed paper bet submissions

Use Vercel Analytics + custom tracking.

**8.5 — Error Boundary Implementation**
Wrap major sections in error boundaries:
- Predictions list
- Betslip
- Blackbook
- Model performance

If section crashes, show fallback UI without breaking whole page.

### Files Touched
- `apps/web/src/components/ErrorState.tsx` (new)
- `apps/web/src/components/ErrorBoundary.tsx` (new)
- `apps/web/src/lib/monitoring/performance.ts` (new)
- All prediction page components (error handling)
- Cache layer (stale data warnings)

### Dependencies
- Requires Phase 1 cache layer for stale data detection
- Works with Phase 3 snapshot for degradation fallback

### UX Success Criteria
- Errors feel informative, not alarming
- Users never lose context when something fails
- Cached data stays visible during outages
- Performance feels consistent as data volume grows
- Monitoring catches issues before users report them

### Backend Work
None. This is frontend robustness.

---

## Data Gating Rules

Some phases should not ship until certain data volume thresholds are met:

| Phase | Minimum Data Required | Why |
|-------|----------------------|-----|
| Phase 1-6 | None | Core UX, works with any data |
| Phase 7 | 30+ settled results per sport | Model learning dashboard needs calibration data |
| Phase 7 | 2+ weekly retrains completed | Changelog needs comparison data |

Do not ship Phase 7 prematurely. Users will see:
- "Model improved 2% based on 8 results" (statistically meaningless)
- "Top feature changed" (noise, not signal)
- Misleading calibration curves

Wait until you have real volume.

---

## ML Weights Configuration

**IMPORTANT:** The ML engine weights have been corrected based on domain expertise.

**See WEIGHTS_CONFIG.md for full specification.**

### Current Weights Summary

**Racing:**
- Speed rating (15%), Horse-jockey combo (2x multiplier), Jockey-trainer combo (1.5x multiplier)
- Recent form, track conditions, barrier, weight, class as secondary factors
- **Fixed until auto-tune has 30+ settled results**

**NBA:**
- Off/Def ratings (20% each), Recent form (15%), Live odds signal (15%)
- Back-to-back multiplier (0.85x), Toronto international travel bonus (10% vs 5%)
- **Fixed until auto-tune has 30+ settled results**

**AFL:**
- Squiggle signal (25%), Points differential (25%), Recent form (20%)
- Travel-adjusted home advantage (10% for interstate, 5% standard)
- **Fixed until auto-tune has 30+ settled results**

### For Agents

When implementing ML engine features:
- Do NOT modify weights in `services/ml-engine/src/config/weights.py`
- Weights are frozen until auto-tune conditions are met
- Log all intermediate calculations for debugging
- Store weights version with each prediction

---

## API Contracts

Document these before any agent touches the code:

**See ML_WEIGHTS.md for complete weight configuration details.**

### Prediction Response Shape
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

### Betslip Item Shape
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

### Watch Rule Shape
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

## Phase Dependency Map

Some phases depend on others being complete:

| Phase | Dependencies | Why |
|-------|--------------|-----|
| Phase 0 | None | Backend foundation — must run first |
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
3. Document any assumed dependencies in handover

**Critical path this week:**
- Phase 0 → Phase 2 (weights must be correct for Bob)
- Phase 2 → Phase 4 (onboarding needs "Why?" drawer)
- Phase 4 → Phase 6 (betslip persistence needed for warnings)

---

## Testing Gates

Owner instruction: **test nothing unless explicitly asked.**

However, these sanity checks should be done before marking work complete:

- Does the page load without errors?
- Does the cache persist across navigation?
- Does the betslip show added items?
- Does the "Why?" drawer open and close?
- Do error states render without crashing?

No formal tests, no jest runs, no Cypress. Just basic "does it work?" checks.

---

## Final Notes

**Build fast, validate with users, iterate based on data.**

Don't wait for perfect architecture. Ship working UX, measure what users actually do, adjust.

The goal is a pre-beta that feels:
- Fast (cache + snapshots)
- Trustworthy (Bob + explainability)
- Easy to understand (onboarding + confidence labels)
- Useful (opportunities + paper betting)

Everything else can wait for V2.
