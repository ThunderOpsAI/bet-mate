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
```

Metrics include settled event count, top-pick hit rate, Brier score, log loss, winner probability, and calibration buckets.
