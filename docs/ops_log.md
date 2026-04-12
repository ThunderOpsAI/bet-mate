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

## 2026-04-12 — Railway deployment region cleanup

Checked Railway project `bet-mate`, environment `production`, service `@bet-mate/prediction-engine`.

Outcome:
- Railway CLI is linked to project `bet-mate`, environment `production`, service `@bet-mate/prediction-engine`.
- Direct `railway service scale` is still unusable in this session: the CLI panics while fetching regions with `UnauthorizedLogin`.
- Direct Railway dashboard/environment config writes were not available through this CLI session. `railway environment edit` returned no applied changes, and the committed dashboard service config still reports the inaccessible `asia-southeast1`/`ap-southeast1-drams3a` multi-region entries when read back.
- Added service-local Railway config-as-code at `services/prediction-engine/railway.json`. Railway picked it up as `configFile=services/prediction-engine/railway.json` on the next deployment.
- A first test deployment using a repo-root `railway.json` was not picked up by Railway and failed as `40d2c27e-dce7-4fb6-bb76-e5265bf1c399` with the same `User does not have access to region asia-southeast1` config error.
- Fresh deployment `e58263c9-954f-4098-bda8-246b3e0d7d56` succeeded. Its service manifest uses:
  - `builder=DOCKERFILE`
  - `dockerfilePath=Dockerfile`
  - `multiRegionConfig={"europe-west4-drams3a":{"numReplicas":1}}`
  - `numReplicas=1`
- Production health endpoint returned `{"status":"ok","service":"advanced-ml-engine"}` after container startup completed.
- Production strategy card endpoint for James on `2026-04-12` returned the existing card with `selected_count=3`, confirming the deployed service can still read production data.
- New deployment logs show `Nightly scheduler sleeping until 2026-04-13T05:00:00+10:00`.
- No `connection already closed` log entries were found in the new deployment logs since deploy.

Follow-up:
- Keep `services/prediction-engine/railway.json` committed so future deployments override the stale dashboard multi-region config.
- If Railway dashboard write access becomes available, remove the stale dashboard `asia-southeast1` and `ap-southeast1-drams3a` entries to avoid confusion in `railway environment config`.
- Re-check the scheduler after the `2026-04-13 05:00 AEST` run window.
