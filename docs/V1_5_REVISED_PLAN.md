# BetMate v1.5 Revised Plan: Metro Racing, Strategy Profiles, and Betmate Bob

**Revision date:** April 2026  
**Revision basis:** Review of original v1.5 plan against current codebase state  
**Key changes from original:** Phased delivery, concrete strategy rule schema, bankroll scoping, provider consolidation, auto-tune deferred

---

## Summary

Build a shared prediction-and-strategy layer on top of the existing Racing/AFL/NBA ML engine. Keep the current sport models as the base signal, then add five selectable strategy profiles that turn those signals into daily bet cards, portfolio allocation, and a limited Bob explainer chat.

This revision splits delivery into three phases so each phase can be validated before the next begins. Phase 1 ships racing data quality improvements. Phase 2 adds the strategy engine and profile cards. Phase 3 adds Bob chat and the learning pipeline. Auth gating and Stripe remain out of scope throughout.

---

## What Changed and Why

### Phased delivery instead of one big phase

The original plan introduced a new scraper pipeline, a cross-sport strategy engine, five profile configs, a new persistence schema, a chat interface, and a nightly learning loop simultaneously. With no auth gate, no background job runner, and a SQLite-first storage layer in the current codebase, shipping all of this at once creates too many failure surfaces with no way to isolate regressions.

The revised plan delivers in three phases. Each phase has a clear exit condition before the next begins.

### Concrete StrategyRuleSet schema

The original plan named the entity but did not define it. Without a concrete schema, five profiles will either be identical or arbitrary. The revised plan defines what a rule set actually contains.

### Per-profile bankroll scoping

The original plan specified a shared `$250/$500` bankroll without addressing what happens in a multi-tester, auth-free environment. Every tester would read and mutate the same bankroll state. The revised plan scopes bankroll per profile run, not per user, until auth is added.

### AI provider consolidation

The original plan specified Gemini as the Bob chat provider behind a thin interface. The codebase already has Anthropic wired up in documentation and the existing AI service scaffold uses the Anthropic SDK. Introducing a second provider dependency adds complexity with no benefit at this stage. The revised plan uses Anthropic (Claude) as the Bob chat provider, still behind the thin provider interface so Gemini or any other model can replace it later.

### Auto-tune deferred to Phase 3 with minimum data gate

Nightly auto-tune on small settlement samples overfits. The revised plan gates the learning pipeline on a minimum of 30 days of settled outcomes before any weight updates run, and defers its implementation to Phase 3.

### Racing Australia treated as best-effort, not required

The original plan implied Racing Australia enrichment was a reliable secondary source. Their acceptances pages are scraped HTML with no stable API contract. The revised plan treats enrichment as best-effort and makes Betfair-names-only the stable default path, not the fallback.

---

## Phase 1: Racing Data Quality and Metro Filtering

**Exit condition:** Metro allowlist filters correctly in tests, horse and jockey names render in the UI, failed enrichment degrades gracefully without placeholder numbering.

### 1.1 Racing Australia enrichment (best-effort)

Add a secondary scraper that attempts to fetch runner details from Racing Australia acceptances pages. The scraper must:

- Match runners by name against Betfair runners already in the race card
- Enrich matched runners with `jockey_name`, `meeting_type`, `meeting_region`, and `meeting_date`
- Mark `jockey_name` as `null` (not `"Horse 1"`) on any runner that cannot be matched
- Return the Betfair-sourced card unchanged if the Racing Australia fetch fails or times out

The Racing Australia URL pattern is:

```
https://racingaustralia.horse/ozracing/Acceptances.aspx?key={YYYYMMMDD}%2C{STATE}%2C{VENUE}
```

This is scraped HTML, not a JSON API. Parse it defensively. Any change to the page structure should cause the enrichment to silently skip rather than crash.

### 1.2 Metro allowlist config

Introduce an editable backend config (`metro_allowlist.json` or a DB table) that maps normalized venue aliases to active weekdays. The allowlist is read at startup and can be edited without a deploy.

Default allowlist:

| Venue | Active days |
|---|---|
| Flemington | Mon–Sun |
| Caulfield | Mon–Sun |
| Moonee Valley | Mon–Sun |
| Sandown | Mon–Sun |
| Randwick | Mon–Sun |
| Rosehill | Mon–Sun |
| Canterbury | Mon–Sun |
| Warwick Farm | Mon–Sun |
| Eagle Farm | Wed, Fri, Sat, Sun |
| Doomben | Wed, Fri, Sat, Sun |
| Ascot | Wed, Fri, Sat, Sun |
| Belmont Park | Wed, Fri, Sat, Sun |

Weekday filtering must use `Australia/Melbourne` timezone, not UTC. Daylight saving transitions must be handled correctly — write an explicit test for the AEDT/AEST boundary.

### 1.3 Expanded racing response types

Add the following fields to the racing API response. Fields sourced from Racing Australia enrichment must carry `data_source: "racing_australia"`. Fields sourced from Betfair only must carry `data_source: "betfair"`.

```typescript
jockey_name: string | null
meeting_type: "metro" | "provincial" | "country" | "unknown"
meeting_region: string
meeting_date: string  // YYYY-MM-DD in AEST
data_source: "betfair" | "racing_australia" | "mock"
```

### 1.4 Phase 1 tests

- Metro allowlist filters the correct meetings by venue and weekday
- Weekday boundary test: a race at 23:30 UTC on a Wednesday in AEST is correctly identified as Thursday AEST
- Betfair + Racing Australia merge produces horse and jockey names when enrichment succeeds
- Failed enrichment (timeout, parse error, HTTP error) returns the Betfair card unchanged
- No runner in any response has a name matching the pattern `Horse \d+`
- Existing `/health`, `/api/races/today`, `/api/predict/racing` endpoints still pass

---

## Phase 2: Strategy Engine and Profile Cards

**Exit condition:** All five profiles produce distinct daily cards via the API, best-edge cross-sport selection works, bankroll allocation respects caps, derived odds carry correct provenance, James config round-trips correctly through the UI.

**Prerequisite:** Phase 1 exit conditions met.

### 2.1 Shared strategy engine

Keep one shared core ML layer per sport. Add a strategy overlay engine that:

- Normalises all sport outputs into a common `CandidateBet` shape (defined below)
- Scores candidates from Racing, AFL, and NBA on the same day
- Selects the best edges across all sports rather than applying strict sport fallback order
- Allocates from one shared bankroll pool per profile run: `$250` on standard days, `$500` on Friday and Saturday (AEST)

The `CandidateBet` shape:

```typescript
interface CandidateBet {
  sport: "racing" | "afl" | "nba"
  event_id: string
  event_name: string
  market_type: "win" | "place" | "quinella" | "head_to_head"
  selection: string
  model_probability: number       // 0–1, from ML model
  market_odds: number | null      // live market odds if available
  derived_odds: number | null     // Harville-derived if no market
  odds_source: "live_market" | "harville_derived" | "model_implied"
  edge: number                    // model_probability - (1 / effective_odds)
  confidence: "high" | "medium" | "low"
}
```

Odds policy:

- Use live market odds where available and set `odds_source: "live_market"`
- For racing place and quinella with no live market, derive from win probabilities using Harville finish-order probabilities and set `odds_source: "harville_derived"`
- Multi odds = product of leg odds; each leg must have its own `odds_source`
- Never present derived odds as live market odds in the UI

### 2.2 StrategyRuleSet schema

Each profile has a `StrategyRuleSet` stored in the database. The rule set is a JSON document with the following structure:

```typescript
interface StrategyRuleSet {
  profile_key: string              // "bob" | "james" | "conservative" | "neutral" | "aggressive"
  display_name: string
  min_edge: number                 // minimum edge threshold to qualify a bet (e.g. 0.05 = 5%)
  min_confidence: "high" | "medium" | "low"
  max_bets_per_day: number
  max_stake_per_bet: number        // absolute dollar cap
  kelly_fraction: number           // e.g. 0.25 = quarter-Kelly
  allowed_markets: MarketType[]    // subset of ["win","place","quinella","head_to_head"]
  allow_multis: boolean
  max_multi_legs: number
  sport_weights: {                 // relative allocation weight, must sum to 1.0
    racing: number
    afl: number
    nba: number
  }
  notes: string                    // human-readable description of intent
}
```

Default rule seeds:

| Profile | min_edge | min_confidence | max_bets | kelly_fraction | notes |
|---|---|---|---|---|---|
| bob | 0.05 | medium | 5 | 0.25 | Balanced. Flagship profile. |
| james | 0.08 | medium | 8 | 0.35 | High action. Editable by admin. |
| conservative | 0.10 | high | 3 | 0.15 | Low variance. Top confidence only. |
| neutral | 0.06 | medium | 4 | 0.20 | Disciplined. No multis. |
| aggressive | 0.04 | low | 10 | 0.50 | High action, wider net. |

### 2.3 New persistence entities

Add these tables alongside the existing `prediction_log`. Do not reuse `prediction_log` for strategy-generated bets — the unique index on `(sport, event_id, selection)` will conflict.

```sql
CREATE TABLE strategy_profiles (
  id SERIAL PRIMARY KEY,
  profile_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  rule_set_json JSONB NOT NULL,
  is_editable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_strategy_runs (
  id SERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL REFERENCES strategy_profiles(profile_key),
  run_date DATE NOT NULL,             -- AEST date
  bankroll_standard NUMERIC(8,2) NOT NULL DEFAULT 250.00,
  bankroll_premium NUMERIC(8,2) NOT NULL DEFAULT 500.00,
  total_allocated NUMERIC(8,2),
  candidate_count INTEGER,
  selected_count INTEGER,
  skipped_count INTEGER,
  run_payload_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_key, run_date)
);

CREATE TABLE system_bets (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES daily_strategy_runs(id),
  profile_key TEXT NOT NULL,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  market_type TEXT NOT NULL,
  selection TEXT NOT NULL,
  model_probability NUMERIC(6,4) NOT NULL,
  odds_used NUMERIC(8,2) NOT NULL,
  odds_source TEXT NOT NULL,
  edge NUMERIC(6,4) NOT NULL,
  stake NUMERIC(8,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout NUMERIC(8,2),
  profit NUMERIC(8,2),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_bets_run ON system_bets(run_id);
CREATE INDEX idx_system_bets_event ON system_bets(sport, event_id);
CREATE INDEX idx_system_bets_profile ON system_bets(profile_key, created_at);
```

Also extend `paper_bet_log` with:

```sql
ALTER TABLE paper_bet_log ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'user';
-- origin values: 'user', 'system_bob', 'system_james', etc.
ALTER TABLE paper_bet_log ADD COLUMN IF NOT EXISTS system_bet_id INTEGER REFERENCES system_bets(id);
```

### 2.4 Daily strategy card API

Generate one idempotent daily card per profile per AEST date. The first request for a given profile+date generates the card and persists it. Subsequent requests return the cached card.

```
GET  /api/strategy-profiles
GET  /api/strategy-profiles/{key}
PATCH /api/strategy-profiles/james          -- editable profile only
GET  /api/strategy-cards?date=YYYY-MM-DD   -- all profiles
GET  /api/strategy-cards/{profileKey}?date=YYYY-MM-DD
GET  /api/system-bets
```

Strategy card response shape:

```typescript
interface StrategyCard {
  profile_key: string
  display_name: string
  card_date: string              // YYYY-MM-DD AEST
  bankroll_available: number
  total_allocated: number
  selected_bets: SystemBet[]
  skipped_opportunities: SkippedBet[]  // top candidates that did not qualify
  sport_mix: Record<string, number>    // e.g. { racing: 0.6, afl: 0.4 }
  expected_edge: number                // weighted average edge of selected bets
  performance: ProfilePerformance | null  // null until bets settle
}
```

### 2.5 James editable config screen

Add a settings screen in the frontend for the `james` profile only. The screen reads from `GET /api/strategy-profiles/james` and writes via `PATCH /api/strategy-profiles/james`. All rule set fields defined in section 2.2 must be editable. Changes take effect on the next daily card generation, not retroactively.

### 2.6 Phase 2 tests

- Each profile applies its intended qualification rules (edge threshold, confidence gate, market type filter)
- Best-edge cross-sport selection outperforms strict sport fallback on a synthetic candidate set
- Daily bankroll allocation respects `$250/$500` caps and does not exceed `max_stake_per_bet`
- Derived place, quinella, and multi odds carry `odds_source: "harville_derived"` or `"model_implied"` — never `"live_market"`
- Idempotency: calling the card generation endpoint twice for the same profile+date returns the same card
- James config edits round-trip: PATCH → GET returns updated rule set
- Existing paper-bet and prediction endpoints still pass

---

## Phase 3: Bob Chat, Logging, and Learning Pipeline

**Exit condition:** Bob chat answers from today's card context only, prediction and system bet outcomes log correctly to their separate tables, nightly tuning runs only when the 30-day data gate is met.

**Prerequisite:** Phase 2 exit conditions met and at least 14 days of daily strategy runs accumulated.

### 3.1 Bob explainer chat

Add `POST /api/bob/chat`.

Bob chat is scoped strictly to:

- Explaining today's Bob profile card
- Explaining why a specific bet qualified or was skipped
- Comparing profile behaviour (e.g. why Bob selected X but James did not)
- Explaining how bankroll was allocated
- Explaining how a user paper bet relates to model signals

Bob must not answer questions outside this scope. Implement this with a system prompt that describes Bob's role and explicitly lists what he does not do. Bob must not modify application code, strategy configs, or his own prompts.

Provider interface:

```python
class BobChatProvider(Protocol):
    async def complete(
        self,
        system_prompt: str,
        messages: list[dict],
        max_tokens: int = 1000,
    ) -> str: ...
```

Ship with `AnthropicBobProvider` as the concrete implementation using `claude-sonnet-4-20250514`. The provider is injected at startup so a future `GeminiBobProvider` can replace it without changing the endpoint.

Context injected into every Bob request:

```python
bob_context = {
    "card_date": today_aest,
    "strategy_card": load_todays_card("bob"),
    "all_profile_cards": load_todays_cards_summary(),
    "model_signals": load_relevant_predictions(event_ids_in_card),
}
```

### 3.2 Logging and learning

Keep `prediction_log` as the ML output log. System bets log to `system_bets`. User paper bets log to `paper_bet_log` with the `origin` field set appropriately.

On settlement, propagate outcomes to `system_bets` via the existing settlement pipeline. Profile ROI is computed from `system_bets` grouped by `profile_key`.

Nightly auto-tune behaviour:

- Gate: do not run unless there are at least 30 calendar days of settled `system_bets` for the profile being tuned
- Scope: tune only the overlay weights (`kelly_fraction`, `min_edge`, `sport_weights`) stored in `strategy_profiles.rule_set_json`
- Never retrain the core XGBoost models — that remains a separate admin-controlled pipeline
- Never modify application code or Bob's system prompt
- Log every tuning run to an `auto_tune_log` table with before/after values and the settled outcome window used

```sql
CREATE TABLE auto_tune_log (
  id SERIAL PRIMARY KEY,
  profile_key TEXT NOT NULL,
  tuned_at TIMESTAMPTZ DEFAULT NOW(),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  settled_bets_in_window INTEGER NOT NULL,
  params_before JSONB NOT NULL,
  params_after JSONB NOT NULL,
  improvement_metric NUMERIC(8,4)   -- e.g. ROI delta
);
```

### 3.3 Phase 3 tests

- Base predictions, system bets, and user paper bets all log to their own tables with no cross-contamination
- Bob chat returns answers that reference today's card data
- Bob chat refuses requests outside its defined scope (open-ended betting advice, code modification)
- Auto-tune does not run when settled bet count is below the 30-day gate
- Auto-tune updates stored profile parameters without touching model `.pkl` files or application code
- Settlements propagate through to profile ROI correctly
- Regression: all Phase 1 and Phase 2 tests still pass

---

## Deferred Items (not in scope for any phase)

These items from the original plan are deferred until auth and Stripe are added:

- Auth gating of Bob chat and premium profile access
- Per-user bankroll (currently per-profile-run)
- Login and Stripe integration
- Broad open-ended Bob assistant

---

## Implementation Notes

### Timezone handling

All date logic that affects scheduling, allowlist filtering, or card generation must use `Australia/Melbourne` as the reference timezone, not UTC or the server local time. Use the `zoneinfo` module (Python 3.9+) or `pytz` as a fallback.

### Racing Australia scraper reliability

Do not treat Racing Australia as a required dependency. Every call to the enrichment scraper must be wrapped in a try/except with a timeout of 10 seconds. Log failures at INFO level, not ERROR — enrichment failure is expected behaviour, not an incident.

### Bankroll in auth-free tester phase

Until auth is added, bankroll state is scoped to the profile, not the user. The `daily_strategy_runs` table holds the bankroll pool for each profile's daily card. There is no per-user isolation. This is acceptable for the tester phase and should be documented in the tester onboarding notes.

### Existing endpoint stability

None of the existing endpoints change behaviour in any phase. The strategy layer is additive. The existing `/api/races/today`, `/api/afl/games/upcoming`, `/api/nba/games/today`, and all paper-bet and prediction endpoints continue to work as before.

---

## Summary of New Endpoints by Phase

| Phase | Method | Path | Notes |
|---|---|---|---|
| 1 | GET | `/api/races/today` | Extended response with `jockey_name`, `meeting_type`, `meeting_region`, `data_source` |
| 2 | GET | `/api/strategy-profiles` | All profiles |
| 2 | GET | `/api/strategy-profiles/{key}` | Single profile with rule set |
| 2 | PATCH | `/api/strategy-profiles/james` | Admin edit, James only |
| 2 | GET | `/api/strategy-cards` | All profile cards for date |
| 2 | GET | `/api/strategy-cards/{profileKey}` | Single profile card for date |
| 2 | GET | `/api/system-bets` | All system-generated bets |
| 3 | POST | `/api/bob/chat` | Scoped explainer chat |

---

## Assumptions and Defaults

- This plan stays auth-free for testers throughout all three phases. Auth gating is a separate workstream.
- Bob is the flagship balanced profile. Neutral is the disciplined low-variance profile.
- Anthropic (Claude) is the Bob chat provider, behind a provider interface that allows future substitution.
- Derived odds are acceptable in all phases and must always be stored with `odds_source` provenance.
- Racing Australia is a best-effort enrichment source, not a required dependency.
- The 30-day data gate for auto-tune is a hard minimum, not a soft guideline.
- Bankroll is scoped per profile run until auth is implemented.
