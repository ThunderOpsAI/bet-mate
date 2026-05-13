# Railway Inventory And ML Contract Freeze

## Runtime Services

- `apps/web`: Next.js frontend, currently configured to proxy API and ML traffic through same-origin `/api/*` routes.
- `apps/api`: Express API for auth, bets, races, and user/profile flows.
- `services/prediction-engine`: Python FastAPI ML service. Out of scope for code changes in this session.
- `Neon/Postgres`: shared database and persistence layer. No migration changes in this phase.

## Railway URLs And Deployment Hosts Found

- `https://railway.com/railway.schema.json`
  - Found in `services/prediction-engine/railway.json`.

## Deployment-Related Env Var Names Found In Repo

- `DATABASE_URL`
  - Shared Neon/Postgres connection string used by Prisma and the API layer.
- `NEXT_PUBLIC_ML_API`
  - Browser-visible ML base path. Now expected to stay `/api/ml-proxy`.
- `ML_API_PROXY_TARGET`
  - Server-side rewrite destination for `/api/ml-proxy/:path*`.
- `API_PROXY_TARGET`
  - Server-side rewrite destination for Node API routes under `/api/*`.
- `NEXT_PUBLIC_API_URL`
  - Browser-visible API base path. Current expected value is `/api`.
- `BETMATE_CORS_ORIGINS`
  - Prediction-engine allowed origins list.
- `JWT_SECRET`
  - Used by the API auth route and auth middleware.
- `PORT`
  - Used by the local Node API server entrypoint.

## Raw `grep -Rni "railway" .` Findings

The command is self-referential once this inventory file exists, so the normalized authored-repo findings below exclude `node_modules`, `.next`, and this inventory document itself:

```text
./services/prediction-engine/tests/test_vercel_modal_contract.py:26:        self.assertNotIn("railway.app", source)
./services/prediction-engine/tests/test_vercel_modal_contract.py:47:        self.assertNotIn("railway.app", source)
./services/prediction-engine/tests/test_vercel_modal_contract.py:63:            self.assertNotIn("Railway for the prediction engine", source)
./services/prediction-engine/railway.json:2:  "$schema": "https://railway.com/railway.schema.json",
```

## Additional Deployment Host Findings

- No authored Railway deployment host remains in `apps/web` or `apps/api`.
- The remaining direct ML/API hosts in app code are local-development defaults only:
  - `http://127.0.0.1:8000` in `apps/web/next.config.mjs`
  - `http://127.0.0.1:3001` in `apps/web/next.config.mjs`
  - `http://127.0.0.1:3001` in `.env.example` as a commented local example

## Frontend ML Contract Freeze

All frontend ML traffic is expected to remain same-origin and flow through `apps/web` rewrites:

- Browser/request base: `/api/ml-proxy`
- Browser/request descendants: `/api/ml-proxy/*`
- Rewrite source: `/api/ml-proxy/:path*`
- Rewrite destination: `${ML_API_PROXY_TARGET}/:path*`

Next.js rewrites preserve the request method, query string, headers, and body when proxying, so:

- Query params continue to pass through.
- `POST` request bodies continue to pass through.
- Auth headers such as `Authorization` continue to pass through.

## ML Endpoints Called By Frontend

### Health And Fixtures

- `GET /health`
  - Called from `apps/web/app/page.tsx`.
  - Request body: none.
  - Response shape used by frontend: only `response.ok` is checked to determine `online` vs `offline`.

- `GET /api/races/today`
  - Called from `apps/web/app/page.tsx` and `apps/web/app/racing/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ races: Race[] }`
    - `Race`: `{ race_id, venue, race_number, distance, start_time?, meeting_type?, meeting_region?, meeting_date?, data_source?, horses: HorseData[] }`
    - `HorseData`: `{ horse_id, name, barrier, weight, past_win_rate, jockey_win_rate, track_condition, days_since_last_race, betfair_back_price?, betfair_implied_prob?, jockey_name?, data_source? }`

- `GET /api/afl/games/upcoming`
  - Called from `apps/web/app/page.tsx` and `apps/web/app/afl/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ games: AFLGame[] }`
    - `AFLGame`: `{ game_id, home_team, away_team, features, round?, venue?, date?, complete?, hscore?, ascore?, squiggle_tip?, squiggle_confidence? }`

- `GET /api/afl/games/live`
  - Called from `apps/web/app/afl/page.tsx` through `EventSource`.
  - Request body: none.
  - Response shape consumed by frontend per event payload:
    - `{ id?, game_id?, gameid?, hscore?, ascore?, complete?, status? }`

- `GET /api/nba/games/today`
  - Called from `apps/web/app/page.tsx` and `apps/web/app/nba/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ games: NBAGame[] }`
    - `NBAGame`: `{ game_id, home_team, away_team, features, date? }`

### Prediction Endpoints

- `POST /api/predict/racing`
  - Called from `apps/web/app/page.tsx` and `apps/web/app/racing/page.tsx`.
  - Request body:
    - `Race`
  - Response shape:
    - `{ race_id, predictions: Prediction[], feature_impact?, ai_insights_context?, model_metadata? }`
    - `Prediction`: `{ horse_id, name, win_probability, fair_odds }`

- `POST /api/predict/afl`
  - Called from `apps/web/app/page.tsx` and `apps/web/app/afl/page.tsx`.
  - Request body:
    - `AFLGame`
  - Response shape:
    - `{ game_id, predictions: { home_team, away_team, home_win_probability, away_win_probability, fair_odds_home, fair_odds_away }, feature_impact?, ai_insights_context?, model_metadata? }`

- `POST /api/predict/nba`
  - Called from `apps/web/app/page.tsx` and `apps/web/app/nba/page.tsx`.
  - Request body:
    - `NBAGame`
  - Response shape:
    - `{ game_id, predictions: { home_team, away_team, home_win_probability, away_win_probability, fair_odds_home, fair_odds_away }, feature_impact?, ai_insights_context?, model_metadata? }`

### Analytics And Model Metadata

- `GET /api/models/metadata`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ models: ModelMetadata[] }`

- `GET /api/predictions/summary`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ summary: PredictionSummary[] }`

- `GET /api/predictions/accuracy`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Optional query params:
    - `sport=<afl|nba|racing>`
  - Request body: none.
  - Response shape:
    - `{ accuracy: AccuracyMetrics }`

- `GET /api/predictions/accuracy/trend`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Optional query params:
    - `sport=<afl|nba|racing>`
  - Request body: none.
  - Response shape:
    - `{ trend: AccuracyTrendPoint[] }`

- `GET /api/predictions/results/recent?limit=100`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ results: RecentPrediction[] }`

- `POST /api/predictions/results/ingest`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Request body:
    - `{ sports: ["afl", "nba", "racing"] }`
  - Response shape:
    - `{ ingestion: { fetched, settled, errors? } }`

### Paper Bets

- `GET /api/paper-bets?limit=200`
  - Called from `apps/web/app/bets/page.tsx` and `apps/web/app/analytics/page.tsx`.
  - Headers:
    - `Authorization: Bearer <token|guest>`
  - Request body: none.
  - Response shape:
    - `{ bets: UserPaperBet[] }`

- `GET /api/paper-bets/summary`
  - Called from `apps/web/app/bets/page.tsx` and `apps/web/app/analytics/page.tsx`.
  - Headers:
    - `Authorization: Bearer <token|guest>`
  - Request body: none.
  - Response shape:
    - `{ summary: PaperBetSummary }`

- `GET /api/paper-bets/trend?days=30`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Headers:
    - `Authorization: Bearer <token|guest>`
  - Request body: none.
  - Response shape:
    - `{ trend: PaperBetTrendPoint[] }`

- `POST /api/paper-bets`
  - Called from `apps/web/app/bets/new/page.tsx`.
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer <token|guest>`
  - Request body:
    - `{ sport, event_id, event_name, bet_type, selection, odds?, stake, notes? }`
  - Response shape:
    - success body is not strongly typed by the frontend; only `res.ok` is required
    - error body may include `{ detail }`

- `POST /api/paper-bets/batch`
  - Called from `apps/web/app/providers/PaperBetslipProvider.tsx`.
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer <token|guest>`
  - Request body:
    - `Array<{ sport, event_id, event_name, selection, stake, odds, bet_type, notes }>`
  - Response shape:
    - `{ count?, bets? }`

- `PATCH /api/paper-bets/:betId/settle`
  - Called from `apps/web/app/bets/page.tsx`.
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer <token|guest>`
  - Request body:
    - `{ status }`
  - Response shape used by frontend: none; the page refetches after completion.

- `DELETE /api/paper-bets/:betId`
  - Called from `apps/web/app/bets/page.tsx`.
  - Headers:
    - `Authorization: Bearer <token|guest>`
  - Request body: none.
  - Response shape used by frontend: none; the page refetches after completion.

### Strategy And Bob

- `GET /api/strategy-cards`
  - Called from `apps/web/app/strategy/page.tsx` and `apps/web/app/analytics/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ cards: StrategyCard[] }`

- `GET /api/system-bets?limit=500`
  - Called from `apps/web/app/analytics/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ bets: StrategyBet[] }`

- `GET /api/strategy-profiles/james`
  - Called from `apps/web/app/settings/page.tsx`.
  - Request body: none.
  - Response shape:
    - `{ rule_set }`

- `PATCH /api/strategy-profiles/james`
  - Called from `apps/web/app/settings/page.tsx`.
  - Headers:
    - `Content-Type: application/json`
  - Request body:
    - `JamesRuleSet`
  - Response shape:
    - `{ rule_set }`
  - Note:
    - current frontend does not attach an auth header to this request.

- `POST /api/bob/chat`
  - Called from `apps/web/app/strategy/page.tsx`.
  - Headers:
    - `Content-Type: application/json`
  - Request body:
    - `{ messages: [{ role: "user", content: string }] }`
  - Response shape:
    - `{ message }`

### Blackbook

- `GET /blackbook`
  - Called from `apps/web/app/blackbook/page.tsx`.
  - Headers:
    - `Authorization: Bearer <token>`
  - Request body: none.
  - Response shape:
    - `{ configs: BlackbookConfig[] }`

- `PUT /blackbook/:runner/auto-bet`
  - Called from `apps/web/app/blackbook/page.tsx` and `apps/web/app/racing/page.tsx`.
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer <token>`
  - Request body:
    - `{ user_id?, sport, bet_type, stake, enabled, probability_threshold, notify_phone, notify_email, notify_pushover_key }`
  - Response shape:
    - `BlackbookConfig`

- `DELETE /blackbook/:runner/auto-bet`
  - Called from `apps/web/app/blackbook/page.tsx` and `apps/web/app/racing/page.tsx`.
  - Headers:
    - `Authorization: Bearer <token>`
  - Request body: none.
  - Response shape used by frontend: none.
