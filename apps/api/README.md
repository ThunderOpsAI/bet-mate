# @bet-mate/api

Express backend API for BetMate, packaged for Vercel Serverless deployment and Neon PostgreSQL integration via Prisma.

## Key Features

- **Authentication (`/api/auth`):** User registration, login, JWT token issuance, password hashing.
- **User Profile (`/api/user`):** Profile settings and bankroll baseline reset accounting.
- **Bets & Tracking (`/api/bets`):** Bet record tracking, history, and analytics aggregations.
- **Racing & Calculators (`/api/races`):** Race card caching and exotic bet calculators.
- **Health Verification (`/health`):** Live server health endpoint.

## Local Development

Start the Express API development server (listens on port 3001):

```bash
pnpm --filter @bet-mate/api dev
```

Build for production:

```bash
pnpm --filter @bet-mate/api build
```

## Environment Variables

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `JWT_SECRET`: Secret key for JWT signing (must match `services/prediction-engine`).
- `PORT`: Local API port (defaults to `3001`).
