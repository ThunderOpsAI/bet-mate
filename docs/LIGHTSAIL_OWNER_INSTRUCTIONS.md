# Prediction Engine Owner Instructions

This file keeps its historical path, but the active production flow is no longer AWS Lightsail.

The current deploy authority for the prediction engine is Modal. Use this document for owner-operated deploys, smoke checks, and cron verification after the Vercel/Modal migration.

## Current Production Shape

- Frontend: Vercel
- API gateway: Vercel serverless handler
- Prediction engine: Modal ASGI app from `services/prediction-engine/modal_app.py`
- Persistence: managed Postgres via `DATABASE_URL`
- Model artifacts: Modal Volume mounted at `/vol/betmate-models`

## Preconditions

- Modal CLI is authenticated.
- The Modal Secret `betmate-prediction-engine-secrets` exists with the production env vars.
- The Modal Volume `betmate-prediction-engine-models` exists or can be created by deploy.
- `DATABASE_URL` is present in Modal secrets.
- `JWT_SECRET` matches the value used by `apps/api`.

## Deploy Commands

```bash
cd services/prediction-engine
modal deploy modal_app.py
```

## Manual Smoke Commands

Use these commands after deploy to verify the service and each scheduled function entrypoint:

```bash
cd services/prediction-engine
modal run modal_app.py::nightly_strategy_refresh
modal run modal_app.py::race_data_refresh
modal run modal_app.py::afl_model_refresh
modal run modal_app.py::nba_model_refresh
```

## What Success Looks Like

### 1. Deploy succeeds

`modal deploy modal_app.py` completes without missing-secret or import errors.

### 2. Health check succeeds through the web origin

The frontend keeps the same-origin ML contract:

```bash
curl -i https://<your-web-origin>/api/ml-proxy/health
```

Expected result:

```text
HTTP/2 200
```

And the JSON body should include:

```json
{"status":"ok","service":"advanced-ml-engine"}
```

### 3. Production startup rejects missing `DATABASE_URL`

If the Modal Secret is missing `DATABASE_URL`, deploys or runs should fail fast unless `BETMATE_ALLOW_SQLITE=1` is intentionally set for test-only execution.

### 4. Manual job runs complete

Each `modal run modal_app.py::<job>` command should log a start line and a completed summary.

## Failure Guidance

### Missing secret or env var

Update the Modal Secret:

```bash
modal secret create betmate-prediction-engine-secrets \
  DATABASE_URL=... \
  JWT_SECRET=...
```

Re-run the deploy after updating the full secret payload required by `modal_app.py`.

### Health check fails from `/api/ml-proxy/health`

Check both layers:

1. `apps/web` rewrite target:
   - `ML_API_PROXY_TARGET` must point at the deployed Modal web endpoint.
2. Modal app status:
   - redeploy `modal_app.py`
   - confirm the web function starts cleanly

### Job run fails during model load

Check:

- the Modal Volume mount at `/vol/betmate-models`
- database connectivity from `DATABASE_URL`
- upstream provider secrets such as Betfair, BDL, and Gemini

## Final Verification Checklist

Do not consider the deploy healthy until all of these are true:

- `modal deploy modal_app.py` succeeds
- `GET /api/ml-proxy/health` returns `200`
- the response body includes `{"status":"ok","service":"advanced-ml-engine"}`
- each Modal cron entrypoint can run manually without startup errors
- production secrets include `DATABASE_URL`
