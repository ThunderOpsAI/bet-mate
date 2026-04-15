# Deploy `apps/api` To Railway

This service is separate from the AU-hosted prediction engine.

- Keep `services/prediction-engine` on Lightsail for Betfair AU access.
- Deploy `apps/api` on Railway.
- Keep `apps/web` on Vercel.

## Why

`apps/api` handles:

- `/api/auth/*`
- `/api/user/*`
- `/api/bets/*`
- `/api/races/*`

It does not call Betfair directly. Betfair access lives in `services/prediction-engine`.

## Railway Service Setup

Create a new Railway service from this repo.

Use these commands:

- Root Directory: repo root
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm api:build:prod`
- Start Command: `pnpm api:start:prod`

## Railway Environment Variables

Set these on the Railway `apps/api` service:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=replace-with-a-strong-shared-secret
API_PORT=$PORT
```

Notes:

- `JWT_SECRET` must match the value used by `services/prediction-engine`.
- Railway provides `PORT` automatically. Setting `API_PORT=$PORT` lets the Express app bind to the correct runtime port.

## Database Bootstrap

This repo does not currently include committed Prisma migrations, so use schema push for first deploy:

```bash
pnpm db:push
```

Run that in a Railway shell for the API service after `DATABASE_URL` is set, or run it locally against the same Postgres database before the first deploy.

## Vercel Environment Variables

Once Railway gives you a public domain for the API service, set these on the Vercel web project:

```env
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=https://your-railway-api-domain.up.railway.app
NEXT_PUBLIC_ML_API=/api/ml-proxy
ML_API_PROXY_TARGET=http://54.79.12.88
```

Redeploy Vercel after updating the variables.

## Smoke Tests

After Railway deploys, these should no longer return `404`:

```bash
curl -i https://your-railway-api-domain.up.railway.app/health
curl -i -X POST https://your-railway-api-domain.up.railway.app/api/auth/register
curl -i -X POST https://your-railway-api-domain.up.railway.app/api/auth/login
```

Expected for the auth routes on an empty POST:

- `400` is acceptable
- `404` means the service or route is still wrong

## Current Split Architecture

- Vercel: Next.js frontend
- Railway: Express API (`apps/api`)
- Lightsail Sydney: prediction engine (`services/prediction-engine`)
