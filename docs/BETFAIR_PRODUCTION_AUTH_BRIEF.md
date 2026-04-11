# Betfair Production Auth Brief

## Purpose

We are building a racing data and prediction analytics app called BetMate and need to confirm the correct Betfair setup for an AU-hosted automated backend.

The app needs to pull real AU racing data every day and use that data to generate paper-only strategy recommendations.

## NO BETTING Scope

BetMate does not place, accept, route, facilitate, or settle real-money wagers.

The app does not need transaction execution, order placement, account funds access, deposits, withdrawals, or wagering payment handling.

Any "bet", "stake", "bankroll", or "strategy card" wording in the product refers to paper/simulated tracking only.

We need:

- Today's AU races
- Venue, race number/name, and scheduled start time
- Real runners/horses, not mock data
- Betfair `marketId`
- Runner `selectionId`
- Current available prices/odds
- Market status/suspension status

## Current Setup

The backend is a Python/FastAPI service currently hosted on Railway.

It uses these Betfair credentials from server environment variables:

```text
BETFAIR_APP_KEY
BETFAIR_USERNAME
BETFAIR_PASSWORD
```

The code currently logs in using:

```text
POST https://identitysso.betfair.com.au/api/login
```

with:

```text
X-Application: <BETFAIR_APP_KEY>
Content-Type: application/x-www-form-urlencoded
Accept: application/json
username=<BETFAIR_USERNAME>
password=<BETFAIR_PASSWORD>
```

The current app key is the delayed/free key.

## Exact Production Error

When the backend runs on Railway, Betfair login fails before any race data is requested.

Railway production logs show:

```text
[Betfair] Login error (app_key=yes, username=yes, password=yes): 403 Client Error: Forbidden for url: https://identitysso.betfair.com.au/api/login
[Betfair] authentication unavailable, returning no races because mock data is disabled
```

This happened when hitting:

```text
GET https://bet-mateprediction-engine-production.up.railway.app/api/races/today?date=2026-04-10
```

The `app_key=yes, username=yes, password=yes` part means Railway has all three environment variables loaded. The backend is not missing credentials.

## Important Clarification

We do not have an explicit Betfair error saying "IP blocked".

The exact server-side error we see is:

```text
403 Forbidden
```

from:

```text
https://identitysso.betfair.com.au/api/login
```

The IP/environment issue is our inference because the same credentials work locally.

## Local Test Works

From a local Mac using the same credentials:

```bash
cd services/prediction-engine
venv/bin/python -c "import app.data.scraper as s; print(s._login())"
```

Output:

```text
[Betfair] Authenticated successfully
<valid session token returned>
```

A raw local `curl` to the same endpoint also returned:

```json
{
  "token": "<valid token>",
  "product": "<app key>",
  "status": "SUCCESS",
  "error": ""
}
```

So the username, password, and app key are valid locally.

## Questions For Betfair

1. Is `https://identitysso.betfair.com.au/api/login` expected to work from a cloud-hosted backend like Railway?
2. Would Betfair reject login attempts from cloud platforms, dynamic IPs, shared IPs, or unknown server environments with a plain `403 Forbidden`?
3. For an autonomous production bot, should we use certificate login instead of username/password login?
4. For an Australian Betfair account, what is the correct certificate login endpoint?
5. Is it `https://identitysso-cert.betfair.com/api/certlogin`?
6. Or is there an AU-specific certificate login endpoint?
7. Do we need a static outbound IP address registered or approved with Betfair?
8. Does the delayed/free app key allow us to retrieve real AU racing markets and runner data from a hosted backend?
9. What exact app-key type, login method, and account permissions are required to read AU racing markets, read runners/selection IDs, read prices, and market status for non-transactional analytics?
10. Are there any restrictions on using Betfair market data for paper-only predictions, simulated strategy cards, or non-wagering analytics?

## Potential Hosting Change

If Betfair needs a stable IP, we can move from Railway to AWS Lightsail Sydney and provide a fixed static IP.

Railway currently does not give us a simple guaranteed single outbound IP for this app. Lightsail would.

## Current App Behavior

We have disabled fake racing fallbacks in production.

When Betfair auth fails, the app now returns no races instead of showing imaginary horses. That is intentional until the real feed works.

## Main Ask

Can Betfair confirm the supported production architecture for this use case?

```text
AU racing app
server-side automated backend
daily race ingestion
market/runners/prices
paper-only recommendations
no real-money betting
hosted in cloud
```

The key point is:

```text
We are not asking why the credentials are wrong. They work locally.
We need to know why the same login gets 403 Forbidden from Railway
and what Betfair-supported production login method we should use.
```
