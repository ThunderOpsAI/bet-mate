# @bet-mate/prisma

Prisma ORM schema definition and database client package for BetMate, targeting Neon Serverless PostgreSQL.

## Commands

### Generate Prisma Client
Generates the TypeScript client definitions in `@prisma/client`:

```bash
pnpm --filter @bet-mate/prisma prisma:generate
```

### Run Database Migrations
Applies pending schema migrations in development:

```bash
pnpm --filter @bet-mate/prisma prisma:migrate
```

### Push Schema Changes
Pushes schema state directly to target PostgreSQL without creating migration files:

```bash
pnpm --filter @bet-mate/prisma prisma:push
```

## Note on Schema Updates

Whenever modifying `./prisma/schema.prisma`, you MUST re-generate the Prisma client:

```bash
pnpm db:generate
```
