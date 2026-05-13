# BetMate Owner Instructions

This runbook is for the human owner/operator of the BetMate monorepo after the Vercel + Modal migration.

Active production target:

- `apps/web` -> Vercel
- `apps/api` -> Vercel
- `services/prediction-engine` -> Modal
- Shared database -> Neon/Postgres

## 1. Accounts And Services You Must Control

Required:

- Vercel account with permission to create two projects
- Modal account with CLI access and permission to create one Secret and one Volume
- Neon account with permission to create or manage the production Postgres database

Required third-party data/API providers:

- Betfair developer credentials for racing data:
  - `BETFAIR_APP_KEY`
  - `BETFAIR_USERNAME`
  - `BETFAIR_PASSWORD`
  - optional certificate auth material
- Ball Don't Lie API key for NBA:
  - `BDL_API_KEY`

Required if you want Ask Bob / Gemini-backed explanations:

- Google AI / Gemini API key:
  - `GEMINI_API_KEY`

Optional notification providers:

- Twilio for SMS notifications
- Resend for email notifications
- Pushover for push notifications

## 2. Is Supabase Required?

No, Supabase is not required as a running production service for this migrated stack.

Important caveat:

- The checked-in Prisma schema still reflects a database that contains `auth` schema objects that look like a Supabase-shaped schema.
- The deployed target in this migration is still Neon/Postgres, not Supabase hosting.
- If you are reusing the existing production database, this is fine.
- If you are creating a brand-new empty Neon database, you must restore/import the existing schema and data first, or repair the Prisma schema/migrations before relying on the API auth and bet tables.

## 3. Neon / Postgres Setup

Required outcome:

- One reachable Postgres database with SSL enabled
- One `DATABASE_URL` connection string that works for:
  - `apps/api`
  - `services/prediction-engine`

Manual owner actions in Neon:

1. Create or identify the production project/database.
2. Create a database user with read/write permissions.
3. Copy the pooled or direct connection string.
4. Ensure the connection string includes `sslmode=require`.
5. Confirm the existing application schema/data is present if you are reusing production.
6. If starting from a fresh database, restore/import the existing schema/data before cutover.

Required env var:

- `DATABASE_URL=postgresql://...?...sslmode=require`

## 4. Vercel Setup For `apps/web`

Create one Vercel project for the web app.

Recommended project settings:

- Root Directory: `apps/web`
- Framework Preset: `Next.js`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: default Next.js build is fine, or `pnpm --filter @bet-mate/web build`
- Output Directory: leave default

Required Vercel env vars for `apps/web`:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `API_PROXY_TARGET` | `https://<your-api-project>.vercel.app` |
| `NEXT_PUBLIC_ML_API` | `/api/ml-proxy` |
| `ML_API_PROXY_TARGET` | `https://<your-modal-web-endpoint>.modal.run` |

Manual owner actions in Vercel UI:

1. Create/import the project.
2. Set the Root Directory to `apps/web`.
3. Add the four env vars above for Preview and Production.
4. Deploy once the API and Modal endpoint URLs are known.
5. Attach the production custom domain if you use one.
6. Redeploy after any env var change.

## 5. Vercel Setup For `apps/api`

Create one separate Vercel project for the API.

Important repo detail:

- `apps/api/vercel.json` is already committed and should be honored.
- It rewrites all traffic to `src/index.ts`, which exports the Express app as a Vercel serverless handler.

Recommended project settings:

- Root Directory: `apps/api`
- Framework Preset: `Other`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: leave `vercel.json` in control

Required Vercel env vars for `apps/api`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | your Neon/Postgres connection string |
| `JWT_SECRET` | same exact value used by Modal |

Manual owner actions in Vercel UI:

1. Create/import the API project separately from the web project.
2. Set the Root Directory to `apps/api`.
3. Add `DATABASE_URL` and `JWT_SECRET` to Preview and Production.
4. Deploy and confirm `https://<api-domain>/health` returns `200`.
5. Attach a custom domain only if you explicitly want a dedicated API hostname.

## 6. Modal Setup For `services/prediction-engine`

The production entrypoint is:

- `services/prediction-engine/modal_app.py`

Committed Modal resource names:

- Modal App: `betmate-prediction-engine`
- Modal Secret: `betmate-prediction-engine-secrets`
- Modal Volume: `betmate-prediction-engine-models`

Required Modal secret/env payload:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | same Neon connection string used by API |
| `JWT_SECRET` | yes | must exactly match `apps/api` |
| `BETMATE_CORS_ORIGINS` | yes | include your web origin, for example `https://app.example.com` |
| `BETMATE_WEEKLY_RETRAIN_DAY` | yes | typically `sun` |
| `BETMATE_BOB_MODEL` | no | default is `gemini-2.5-flash` |
| `BETMATE_BOB_TIMEOUT_SECONDS` | no | default is `30` |
| `LOG_LEVEL` | no | default `INFO` is reasonable |
| `BETFAIR_APP_KEY` | yes for racing | required for live racing data |
| `BETFAIR_USERNAME` | yes for racing | required for live racing data |
| `BETFAIR_PASSWORD` | yes for racing | required for live racing data |
| `BETFAIR_AUTH_MODE` | recommended | `auto`, `interactive`, or `certificate` |
| `BETFAIR_CERT_PATH` | optional | only if you use mounted cert files |
| `BETFAIR_KEY_PATH` | optional | only if you use mounted key files |
| `BETFAIR_CERT_PEM` | optional | certificate PEM content |
| `BETFAIR_KEY_PEM` | optional | key PEM content |
| `BETFAIR_CERT_PEM_B64` | optional | base64 cert PEM |
| `BETFAIR_KEY_PEM_B64` | optional | base64 key PEM |
| `BDL_API_KEY` | yes for NBA | required for live NBA data |
| `GEMINI_API_KEY` | required for Gemini Bob | omit only if local fallback behavior is acceptable |
| `TWILIO_ACCOUNT_SID` | optional | SMS notifications |
| `TWILIO_AUTH_TOKEN` | optional | SMS notifications |
| `TWILIO_FROM_NUMBER` | optional | SMS notifications |
| `RESEND_API_KEY` | optional | email notifications |
| `NOTIFY_EMAIL_FROM` | optional | email from address |
| `PUSHOVER_APP_TOKEN` | optional | push notifications |
| `BETMATE_SQLITE_BACKUP_DIR` | optional | only relevant for explicit SQLite backup runs, not normal Postgres production |

Manual owner actions in Modal:

1. Install/auth the Modal CLI.
2. Create the secret:

```bash
cd services/prediction-engine
modal secret create betmate-prediction-engine-secrets \
  DATABASE_URL='postgresql://...' \
  JWT_SECRET='replace-me' \
  BETMATE_CORS_ORIGINS='https://<your-web-domain>' \
  BETMATE_WEEKLY_RETRAIN_DAY='sun' \
  BETFAIR_APP_KEY='...' \
  BETFAIR_USERNAME='...' \
  BETFAIR_PASSWORD='...' \
  BETFAIR_AUTH_MODE='auto' \
  BDL_API_KEY='...' \
  GEMINI_API_KEY='...'
```

3. Deploy the app:

```bash
cd services/prediction-engine
modal deploy modal_app.py
```

4. Copy the resulting Modal web endpoint URL.
5. Put that URL into the Vercel web env var `ML_API_PROXY_TARGET`.
6. In the Modal dashboard, confirm the cron functions exist:
   - `nightly_strategy_refresh`
   - `race_data_refresh`
   - `afl_model_refresh`
   - `nba_model_refresh`

## 7. Local Development

### 7.1 Initial Local Setup

From the repo root:

```bash
pnpm install
cp .env.example .env
```

Python setup for the prediction engine:

```bash
cd services/prediction-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

Generate Prisma client:

```bash
pnpm --filter @bet-mate/prisma prisma:generate
```

### 7.2 Backend Local Dev (`apps/api`)

Required local env:

- `DATABASE_URL`
- `JWT_SECRET`

Run:

```bash
pnpm --filter @bet-mate/prisma prisma:generate
pnpm --filter @bet-mate/api dev
```

Health check:

```bash
curl -i http://127.0.0.1:3001/health
```

### 7.3 Frontend Local Dev (`apps/web`)

For web-only local development:

```bash
pnpm --filter @bet-mate/web dev
```

Recommended local env for same-origin proxying:

- `NEXT_PUBLIC_API_URL=/api`
- `API_PROXY_TARGET=http://127.0.0.1:3001`
- `NEXT_PUBLIC_ML_API=/api/ml-proxy`
- `ML_API_PROXY_TARGET=http://127.0.0.1:8000`

### 7.4 Prediction Engine Local Dev (`services/prediction-engine`)

Run:

```bash
cd services/prediction-engine
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl -i http://127.0.0.1:8000/health
```

### 7.5 Local Combined Flow

The repo includes a helper that starts the web app and prediction engine:

```bash
pnpm dev:local-stack
```

Important:

- `pnpm dev:local-stack` does not start `apps/api`.
- Run the API separately in another terminal if you need authenticated app flows.

## 8. Build And Deploy Commands

Web build:

```bash
pnpm --filter @bet-mate/web build
```

API build:

```bash
pnpm --filter @bet-mate/api build
```

Prediction engine deploy:

```bash
cd services/prediction-engine
modal deploy modal_app.py
```

Manual Modal cron smoke runs:

```bash
cd services/prediction-engine
modal run modal_app.py::nightly_strategy_refresh
modal run modal_app.py::race_data_refresh
modal run modal_app.py::afl_model_refresh
modal run modal_app.py::nba_model_refresh
```

## 9. Health Checks And Smoke Tests

Required HTTP health checks after deploy:

```bash
curl -i https://<api-domain>/health
curl -i https://<web-domain>/api/ml-proxy/health
```

Expected ML proxy response body:

```json
{"status":"ok","service":"advanced-ml-engine"}
```

Required manual browser smoke test:

1. Open the deployed web app.
2. Confirm the homepage loads.
3. Confirm authenticated login/register still works.
4. Confirm racing data loads.
5. Confirm strategy data loads.
6. Confirm blackbook loads.
7. Confirm a basic paper-bet logging flow works.
8. Confirm analytics/bankroll flows still load.
9. Confirm there are no obvious broken same-origin API calls in the browser network panel.

Required Modal smoke test:

1. Run each cron function manually once with `modal run`.
2. Confirm each job completes without missing-secret, DB, or model-volume errors.

## 10. Cutover Steps

Do not decommission Railway before this sequence succeeds.

1. Confirm Neon/Postgres is ready and the real `DATABASE_URL` works.
2. Deploy `apps/api` to Vercel.
3. Verify `https://<api-domain>/health`.
4. Deploy `services/prediction-engine` to Modal.
5. Copy the Modal web endpoint URL.
6. Set `ML_API_PROXY_TARGET` in the Vercel web project to that Modal URL.
7. Set `API_PROXY_TARGET` in the Vercel web project to the API Vercel URL.
8. Deploy `apps/web` to Vercel.
9. Verify `https://<web-domain>/api/ml-proxy/health`.
10. Run the browser smoke tests on the live web app.
11. Manually run each Modal cron function once.
12. Only after all checks pass, treat Vercel + Modal + Neon as the primary production stack.
13. Keep the Railway service alive briefly as rollback cover if you still control it.
14. After a stable verification window, decommission Railway manually in its dashboard.

## 11. Rollback

Fast rollback path if cutover fails:

1. Do not delete the old Railway deployment until the new stack is proven.
2. Repoint `apps/web` env vars back to the previous known-good API/ML targets if needed.
3. Redeploy the web project on Vercel after reverting env vars.
4. If the Vercel API project is the issue, roll back to the previous Vercel deployment in the Vercel UI.
5. If the Modal prediction engine is the issue, redeploy the previous known-good Modal revision or temporarily point the web proxy back to the prior ML backend if you still have it live.
6. Keep Neon data intact; do not run destructive database resets during rollback.

Operational reality:

- The repo no longer keeps Railway config as an active deployment target.
- Railway may still remain alive outside the repo for a short rollback window.

## 12. Manual Dashboard Actions Summary

Vercel:

- create/import two projects
- set Root Directory correctly for each
- add env vars in Preview and Production
- attach domains
- redeploy after env changes
- use deployment rollback if needed

Modal:

- authenticate CLI
- create/update the secret
- deploy `modal_app.py`
- confirm cron functions in dashboard
- inspect logs for manual cron runs

Neon:

- create/manage DB and user
- copy the real `DATABASE_URL`
- confirm SSL connection
- confirm schema/data exists before cutover

## 13. Railway Status

The repository no longer intentionally references Railway after this migration cleanup.

Owner instruction:

- keep the old Railway deployment running only until Vercel + Modal + Neon passes health checks and smoke tests
- after that, decommission Railway manually in the Railway UI
