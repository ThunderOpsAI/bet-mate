# BetMate Ops Log

## 2026-04-12 — Production scheduler enablement check

Checked Railway project `bet-mate`, environment `production`, service `@bet-mate/prediction-engine`.

Outcome:
- `BETMATE_NIGHTLY_SCHEDULER_ENABLED=true` is set.
- `BETMATE_NIGHTLY_SCHEDULER_TIME=05:00` is set.
- Production health endpoint returned `{"status":"ok","service":"advanced-ml-engine"}`.
- Active successful deployment is `cdfd99c9-b05e-4592-bce2-9303f882e5d4`, running one replica in `europe-west4-drams3a`.
- Latest deployment record is `2310b0ee-43ca-443e-bf0c-eb91d9a53e98` and is failed because Railway rejected the configured `asia-southeast1` region. This did not replace the active successful deployment.
- Scheduler logs show:
  - `2026-04-11`: nightly cycle failed with `connection already closed`.
  - `2026-04-12`: nightly cycle completed for `2026-04-12` at `2026-04-12 05:41:54 AEST`, then scheduled the next run for `2026-04-13 05:00:00 AEST`.
- The `2026-04-12` strategy cards exist in production and were created starting at `2026-04-12 05:00:13 AEST`.

Follow-up:
- Investigate the failed `2026-04-11` nightly attempt if it repeats.
- Fix or remove the Railway multi-region setting that still includes inaccessible `asia-southeast1`, because it leaves the newest deployment status failed even while production remains healthy on the previous successful deployment.
