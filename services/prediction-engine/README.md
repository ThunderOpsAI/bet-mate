# BetMate Prediction Engine

FastAPI service for racing, AFL, and NBA model predictions.

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
```
