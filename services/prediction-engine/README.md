# BetMate Prediction Engine

FastAPI service for racing, AFL, and NBA model predictions.

## Nightly Strategy Runner

Generate daily strategy cards, ingest completed AFL/NBA results, and run the gated profile auto-tune loop:

```bash
cd services/prediction-engine
python -m app.nightly
```

Useful flags:

```bash
python -m app.nightly --date 2026-04-10
python -m app.nightly --profiles bob,james --skip-ingest
python -m app.nightly --sports afl,nba --max-results 100
```

The auto-tune step is hard-gated. It will not run for a profile until that profile has at least 30 distinct Melbourne-calendar settlement days in `system_bets`.

Set `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true` on the FastAPI service to run the same nightly cycle automatically in-process. The default scheduler time is `05:00` Australia/Melbourne and can be changed with `BETMATE_NIGHTLY_SCHEDULER_TIME=HH:MM`.

Weekly retrain can be layered on top of nightly with:

- `BETMATE_WEEKLY_RETRAIN_ENABLED=true`
- `BETMATE_WEEKLY_RETRAIN_DAY=sun` (mon..sun)

When enabled, the nightly cycle only runs weekly retrain on the configured weekday and records metadata to `weekly_retrain_log` so each date is processed once.

Optional SQLite backup snapshots can run after each nightly cycle:

- `BETMATE_SQLITE_BACKUP_DIR=/absolute/path/to/backups`

## Date-Scoped Fetching

All three sport fetch endpoints now accept an optional Melbourne `date` query:

```bash
curl "http://localhost:8000/api/races/today?date=2026-04-10"
curl "http://localhost:8000/api/afl/games/upcoming?date=2026-04-10"
curl "http://localhost:8000/api/nba/games/today?date=2026-04-10"
```

When a `date` is supplied, AFL and NBA are strict to that day instead of falling forward to the next available slate.

## Prediction Settlement

Prediction requests are logged in SQLite at `BETMATE_DB_PATH`, or under `runtime/betmate.sqlite3` by default. Rows are deduped by `sport + event_id + selection` so repeat page loads refresh the same open prediction instead of inflating metrics. Once a prediction is settled, its probability is frozen for accuracy reporting.

Settle an event result:

```bash
curl -X POST http://localhost:8000/api/predictions/results \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "afl",
    "event_id": "12345",
    "winner_selection": "Collingwood"
  }'
```

For non-binary or drawn outcomes, pass explicit selection outcomes:

```json
{
  "sport": "afl",
  "event_id": "12345",
  "selection_results": {
    "Collingwood": 0.5,
    "Carlton": 0.5
  }
}
```

Read accuracy metrics:

```bash
curl http://localhost:8000/api/predictions/accuracy
curl http://localhost:8000/api/predictions/accuracy?sport=afl
curl "http://localhost:8000/api/predictions/accuracy/trend?sport=afl&days=30"
```

Ingest completed AFL and NBA results from the configured data sources and settle any matching logged predictions:

```bash
curl -X POST http://localhost:8000/api/predictions/results/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "sports": ["afl", "nba"],
    "max_results": 50
  }'
```

Metrics include settled event count, top-pick hit rate, fair-odds paper ROI, Brier score, log loss, winner probability, and calibration buckets.

## Paper Bets

Paper bets are local tracking records tied to prediction events. They do not place wagers or handle money.

```bash
curl -X POST http://localhost:8000/api/paper-bets \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "afl",
    "event_id": "12345",
    "event_name": "Collingwood vs Carlton",
    "selection": "Collingwood",
    "stake": 10,
    "odds": 1.9
  }'
```

When `/api/predictions/results` or `/api/predictions/results/ingest` settles the matching prediction event, pending paper bets for the same sport, event ID, and selection are settled automatically.

```bash
curl http://localhost:8000/api/paper-bets
curl http://localhost:8000/api/paper-bets/summary
curl "http://localhost:8000/api/paper-bets/trend?sport=afl&days=30"
```

Paper bet endpoints are authenticated and require a bearer token in `Authorization`.

## Persistence Hardening and Beta -> Paid Cutover

Immediate hardening (phase 1):

- Enable `BETMATE_REQUIRE_PERSISTENT_STORAGE=true` to fail fast if SQLite is in-memory or in a temp directory.
- Persist backups with `BETMATE_SQLITE_BACKUP_DIR` and keep regular off-host copies.

Postgres migration path (phase 2):

1. Stand up managed Postgres and set `DATABASE_URL`.
2. Backfill historical SQLite data into Postgres (predictions, results, strategy runs, paper bets, tuning logs).
3. Run read parity checks for core aggregates (`/api/predictions/summary`, `/api/paper-bets/summary`, strategy cards).
4. Shift write traffic to Postgres and monitor parity for at least one weekly retrain cycle.
5. Keep SQLite backups for rollback window, then decommission fallback writes once stable.

## Rollout Checklist & Environment Matrix

Before deploying to staging or production, ensure the following environment variables are properly set:

- `JWT_SECRET`: Must match exactly between the Express API (`apps/api/`) and the Prediction Engine (`services/prediction-engine/`). Keep secure.
- `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true`: Enable to run daily ML tasks.
- `BETMATE_NIGHTLY_SCHEDULER_TIME=05:00`: Schedule time for nightly script.
- `BETMATE_SQLITE_BACKUP_DIR`: Directory path for automated backups to persist daily snapshots.
- `BETMATE_WEEKLY_RETRAIN_ENABLED=true`: Keep ML models tuned on current data.
- `DATABASE_URL`: Ensure database availability limits.

### Bankroll Baseline Reset

Express allows users to reset their bankroll baseline without clearing analytics history.

**Explicit rule:** Bankroll resets affect display and accounting baselines ONLY. They never modify or delete ML model datasets, prediction history, or alter retrain eligibility windows. ML learning continuity is fully protected.
