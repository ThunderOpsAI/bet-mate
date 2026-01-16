# Betting Prediction Application - Technical Blueprint & SRS (Part 2)

*Continued from Part 1*

## Table of Contents - Part 2

6. [API Specifications](#api-specifications)
7. [Security & Compliance](#security--compliance)
8. [Deployment & DevOps](#deployment--devops)
9. [Testing Strategy](#testing-strategy)
10. [Performance Optimization](#performance-optimization)
11. [Future Enhancements](#future-enhancements)

---

## 6. API Specifications

### 6.1 Authentication Endpoints

#### POST `/api/auth/register`
- **Description**: Create new user account
- **Request**:
```typescript
{
  email: string;
  username: string;
  password: string;
  fullName?: string;
  startingBankroll: number;
  preferredSports: ('racing' | 'basketball' | 'afl')[];
}
```
- **Response**:
```typescript
{
  user: {
    id: string;
    email: string;
    username: string;
    fullName?: string;
    currentBankroll: number;
  };
  accessToken: string;
  refreshToken: string;
}
```
- **Errors**: 400 (validation), 409 (email/username taken)

#### POST `/api/auth/login`
- **Description**: Authenticate user
- **Request**:
```typescript
{
  emailOrUsername: string;
  password: string;
  rememberMe?: boolean;
}
```
- **Response**: Same as register
- **Errors**: 401 (invalid credentials), 429 (rate limited)

#### POST `/api/auth/refresh`
- **Description**: Refresh access token
- **Request**: `{ refreshToken: string }`
- **Response**: `{ accessToken: string; refreshToken: string }`

#### POST `/api/auth/logout`
- **Description**: Invalidate tokens
- **Response**: `{ success: true }`

### 6.2 Racing Endpoints

#### GET `/api/races/today`
- **Description**: Fetch today's race meetings
- **Query Params**:
  - `date?: string` (YYYY-MM-DD)
  - `venue?: string`
  - `includeCompleted?: boolean`
- **Response**:
```typescript
{
  meetings: [
    {
      venueId: string;
      venueName: string;
      location: string;
      races: [
        {
          id: string;
          raceNumber: number;
          postTime: string;
          distance: number;
          trackCondition: string;
          topPicks: [
            {
              horseId: string;
              horseName: string;
              barrier: number;
              winProbability: number;
              winOdds: number;
              valueRating: string;
              aiRating: number;
            }
          ];
          exoticSuggestion?: {
            betType: string;
            horses: string[];
            cost: number;
          };
          isLive: boolean;
        }
      ];
    }
  ];
}
```

#### GET `/api/races/:raceId`
- **Description**: Fetch detailed race card
- **Response**: Complete race data with all horses, predictions, exotic suggestions

#### GET `/api/races/:raceId/results`
- **Description**: Fetch race results (after completion)

### 6.3 Basketball Endpoints

#### GET `/api/basketball/games/today`
- **Query Params**: `date?: string`, `league?: 'nba' | 'nbl'`

#### GET `/api/basketball/games/:gameId`
- **Description**: Detailed game predictions

#### GET `/api/basketball/games/:gameId/player-props`
- **Description**: Player prop predictions

### 6.4 AFL Endpoints

#### GET `/api/afl/games/round/:roundNumber`
#### GET `/api/afl/games/:gameId`
#### GET `/api/afl/games/:gameId/player-props`

### 6.5 Betting Tracker Endpoints

#### POST `/api/bets`
- **Description**: Log a new bet
- **Request**:
```typescript
{
  eventType: 'race' | 'nba_game' | 'afl_game';
  eventId: string;
  eventName: string;
  eventTime: string;
  betType: string;
  selection: string;
  odds: number;
  stake: number;
  exoticDetails?: object;
  wasAIRecommended: boolean;
  notes?: string;
}
```

#### GET `/api/bets`
- **Query Params**: `status?`, `eventType?`, `startDate?`, `endDate?`, `limit?`, `offset?`

#### PATCH `/api/bets/:betId/settle`
- **Request**: `{ status: 'won' | 'lost' | 'void'; payout?: number }`

#### DELETE `/api/bets/:betId`

### 6.6 Performance Analytics Endpoints

#### GET `/api/analytics/performance`
- **Query Params**: `period: '7d' | '30d' | '90d' | 'all'`
- **Response**: Comprehensive performance stats, charts data

#### GET `/api/analytics/export`
- **Query Params**: `format: 'csv' | 'pdf'`, `startDate`, `endDate`
- **Response**: File download

### 6.7 AI Chat Endpoints

#### POST `/api/ai/chat`
- **Description**: Send message to AI assistant
- **Request**:
```typescript
{
  conversationId?: string;
  message: string;
  context?: {
    type: 'race' | 'game';
    id: string;
  };
}
```
- **Response**: Server-Sent Events (streaming)

#### GET `/api/ai/conversations`
- **Description**: Fetch conversation history

#### GET `/api/ai/conversations/:conversationId`
- **Description**: Fetch messages in a conversation

#### DELETE `/api/ai/conversations/:conversationId`

### 6.8 User Endpoints

#### GET `/api/user/profile`
- **Description**: Get current user profile

#### PATCH `/api/user/profile`
- **Description**: Update user profile

#### GET `/api/user/bankroll`
- **Description**: Get bankroll details and history

#### POST `/api/user/bankroll/adjust`
- **Request**: `{ amount: number; reason: string }`

#### PATCH `/api/user/preferences`
- **Request**: `{ key: string; value: any }`

---

## 7. Security & Compliance

### 7.1 Authentication & Authorization

#### JWT Implementation
```typescript
// Token structure
{
  sub: userId,
  email: string,
  username: string,
  iat: number,
  exp: number, // 30 days
  type: 'access' | 'refresh'
}
```

**Security Measures**:
- Access tokens: 30 days expiry
- Refresh tokens: 90 days expiry, stored securely
- Password hashing: bcrypt with 12 rounds
- Rate limiting: 5 failed login attempts → 15min lockout

#### Authorization Levels
- **Public**: Registration, login
- **Authenticated**: All app features
- **Admin** (future): User management, system monitoring

### 7.2 Data Protection

#### Encryption
- **At Rest**: Database encryption enabled (PostgreSQL native)
- **In Transit**: TLS 1.3 for all API calls
- **Sensitive Data**: Passwords hashed (bcrypt), refresh tokens hashed

#### Privacy
- **GDPR Compliance**:
  - User data export (JSON format)
  - Right to deletion (cascade delete on user account)
  - Clear privacy policy
  - Cookie consent (web)

- **Data Retention**:
  - User data: Indefinite (until account deletion)
  - Bet history: Indefinite
  - AI chat history: 90 days (then archived)
  - Analytics snapshots: Indefinite

#### PII Handling
- **Stored**: Email, username, full name (optional)
- **Not Stored**: Credit cards, payment info (app doesn't handle payments)
- **Logging**: No PII in application logs

### 7.3 API Security

#### Rate Limiting
```typescript
const rateLimits = {
  auth: {
    login: '5 requests / 15 minutes',
    register: '3 requests / hour',
  },
  api: {
    default: '100 requests / minute',
    predictions: '30 requests / minute',
    ai_chat: '10 requests / minute',
  },
  dataSyncJobs: {
    racingAPI: '120 requests / hour',
  }
}
```

#### Input Validation
- All inputs validated using Zod schemas
- SQL injection prevention (Prisma ORM parameterized queries)
- XSS prevention (sanitize user inputs, CSP headers)

#### CORS Configuration
```typescript
const corsOptions = {
  origin: [
    'https://predictedge.com',
    'https://www.predictedge.com',
    'http://localhost:3000', // dev only
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}
```

### 7.4 Legal & Compliance

#### Disclaimers
**Required on all pages**:
- "This app is for information and tracking purposes only. We do not facilitate betting or handle payments."
- "Please gamble responsibly. If you need help, visit [gambling help resources]."
- "Predictions are not guarantees. Past performance does not indicate future results."

#### Age Verification
- Users must confirm they are 18+ during registration
- Display prominent "18+" badge

#### Responsible Gambling
- Link to gambling help resources (Gambling Help Online AU)
- Option to set betting limits (future feature)
- Self-exclusion feature (future)

#### Terms of Service
Key points:
- App is for personal, non-commercial use
- No warranty on prediction accuracy
- Users responsible for their own betting decisions
- Intellectual property owned by app creator

#### Data Policy
- Clearly state: "We collect email, username, and betting performance data"
- "We use Anthropic AI for chatbot (data sent to third party)"
- "We do not sell your data"

---

## 8. Deployment & DevOps

### 8.1 Hosting Architecture

#### Production Stack
```
Frontend (Web):
- Platform: Vercel
- Region: Sydney, Australia (closest to users)
- Features: Edge functions, ISR, CDN

Frontend (Mobile):
- Platform: Expo EAS
- Build: iOS (App Store), Android (Play Store)
- OTA Updates: Enabled for minor updates

Backend (API Gateway):
- Platform: Railway / Fly.io
- Region: Sydney, Australia
- Scaling: Horizontal (auto-scale based on CPU/memory)
- Instances: 2 minimum, 10 maximum

Backend (Prediction Engine):
- Platform: AWS ECS / Google Cloud Run
- Region: Sydney
- Scaling: On-demand (spin up for predictions, spin down)

Database:
- Platform: Supabase / Neon (managed Postgres)
- Region: Sydney
- Backups: Daily snapshots, 30-day retention
- Read Replicas: 1 for analytics queries

Cache:
- Platform: Upstash Redis
- Region: Sydney
- Persistence: AOF enabled

Object Storage:
- Platform: AWS S3
- Region: ap-southeast-2 (Sydney)
- Buckets: assets, exports, backups
```

### 8.2 CI/CD Pipeline

#### GitHub Actions Workflow

**On Pull Request**:
```yaml
name: PR Checks
on: pull_request

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
  
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
  
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
```

**On Merge to Main**:
```yaml
name: Deploy Production
on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - uses: vercel/action@v1
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          prod: true
  
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v3
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
  
  deploy-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: expo/expo-github-action@v8
      - run: eas build --platform all --non-interactive
      - run: eas submit --platform all
```

### 8.3 Environment Configuration

#### Environment Variables

**Web (.env.production)**:
```
NEXT_PUBLIC_API_URL=https://api.predictedge.com
NEXT_PUBLIC_WS_URL=wss://api.predictedge.com
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

**API (.env.production)**:
```
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/predictedge
REDIS_URL=redis://default:pass@redis.upstash.io:6379
JWT_SECRET=<strong-secret-key>
ANTHROPIC_API_KEY=sk-ant-xxxxx
RACING_API_KEY=xxxxx
NBA_API_KEY=xxxxx
AFL_API_KEY=xxxxx
AWS_S3_BUCKET=predictedge-assets
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
SENTRY_DSN=https://xxx@sentry.io/xxx
NODE_ENV=production
PORT=3001
```

**Prediction Engine (.env.production)**:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
RACING_API_URL=https://api.racing.com
NBA_API_URL=https://stats.nba.com
AFL_API_URL=https://api.afl.com.au
MODEL_PATH=/app/models
PYTHON_ENV=production
```

#### Secrets Management
- Use Doppler or GitHub Secrets for secret storage
- Never commit secrets to git
- Rotate secrets every 90 days
- Use different keys for dev/staging/prod

### 8.4 Monitoring & Observability

#### Error Tracking
```typescript
// Sentry configuration
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter out PII
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  },
});
```

#### Application Metrics
```typescript
// Custom metrics to track
const metrics = {
  // User engagement
  'user.login': counter,
  'user.registration': counter,
  'user.retention.d7': gauge,
  'user.retention.d30': gauge,
  
  // Predictions
  'predictions.generated': counter,
  'predictions.accuracy': gauge,
  'predictions.cache_hit_rate': gauge,
  
  // Bets
  'bets.logged': counter,
  'bets.settled.won': counter,
  'bets.settled.lost': counter,
  'bets.total_staked': sum,
  'bets.total_returned': sum,
  
  // AI
  'ai.chat.messages': counter,
  'ai.chat.avg_response_time': histogram,
  'ai.chat.errors': counter,
  
  // Performance
  'api.response_time': histogram,
  'api.errors': counter,
  'database.query_time': histogram,
};
```

#### Logging
```typescript
// Structured logging with pino
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ['email', 'password', 'token'], // Redact PII
});

// Usage
logger.info({ userId, raceId }, 'User viewed race');
logger.error({ err, userId }, 'Failed to generate predictions');
```

#### Uptime Monitoring
- Use UptimeRobot or similar
- Monitor endpoints:
  - Web: `https://predictedge.com`
  - API Health: `https://api.predictedge.com/health`
  - Database: Connection check
- Alert on downtime > 1 minute

### 8.5 Backup & Disaster Recovery

#### Database Backups
- **Automated**: Daily snapshots at 2 AM AEST
- **Retention**: 30 days
- **Storage**: S3 (separate bucket)
- **Encryption**: At rest and in transit
- **Testing**: Monthly restore test

#### Recovery Procedures
- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 24 hours

**Disaster Scenarios**:
1. **Database Failure**: Restore from latest snapshot
2. **API Server Failure**: Auto-scale spins up new instances
3. **Data Corruption**: Roll back to previous snapshot
4. **Complete Outage**: Restore full system from backups

---

## 9. Testing Strategy

### 9.1 Unit Tests

#### Coverage Goals
- **Target**: 80% code coverage
- **Critical Paths**: 100% coverage
  - Authentication logic
  - Bankroll calculations
  - Prediction algorithms
  - Bet settlement logic

#### Testing Framework
```typescript
// Vitest configuration
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
```

#### Example Unit Tests
```typescript
// packages/utils/src/kelly-criterion.test.ts
import { describe, it, expect } from 'vitest';
import { calculateKellyBetSize } from './kelly-criterion';

describe('Kelly Criterion', () => {
  it('should recommend 0 bet when no edge', () => {
    const result = calculateKellyBetSize(1000, 0.4, 2.5, 1);
    expect(result).toBe(0);
  });

  it('should recommend appropriate bet size with edge', () => {
    const result = calculateKellyBetSize(1000, 0.5, 2.5, 1);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(50); // Max 5%
  });

  it('should scale with risk multiplier', () => {
    const conservative = calculateKellyBetSize(1000, 0.5, 2.5, 0.5);
    const aggressive = calculateKellyBetSize(1000, 0.5, 2.5, 1.5);
    expect(aggressive).toBeGreaterThan(conservative);
  });
});
```

### 9.2 Integration Tests

#### API Integration Tests
```typescript
// apps/api/src/routes/bets.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

describe('Bet API', () => {
  let authToken: string;

  beforeAll(async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    authToken = response.json().accessToken;
  });

  it('should log a new bet', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/bets',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        eventType: 'race',
        eventId: 'race-123',
        betType: 'win',
        selection: 'Horse #5',
        odds: 4.5,
        stake: 20,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('bet');
  });

  it('should fetch user bets', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/bets',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('bets');
  });
});
```

### 9.3 End-to-End Tests

#### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
});
```

#### Example E2E Test
```typescript
// tests/e2e/racing-flow.spec.ts
import { test, expect } from '@playwright/test';

test('user can view race and build exotic bet', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Navigate to racing feed
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1')).toContainText('Racing');

  // Click on race card
  await page.click('[data-testid="race-card-0"]');

  // Should see race details
  await expect(page.locator('[data-testid="race-title"]')).toBeVisible();

  // Open exotic bet builder
  await page.click('button:has-text("Build Exotic")');

  // Select horses
  await page.check('[data-testid="horse-checkbox-2"]');
  await page.check('[data-testid="horse-checkbox-5"]');
  await page.check('[data-testid="horse-checkbox-7"]');

  // Should see cost
  const cost = page.locator('[data-testid="exotic-cost"]');
  await expect(cost).toContainText('$6.00');

  // Copy to clipboard
  await page.click('button:has-text("Copy to Clipboard")');
  await expect(page.locator('.toast')).toContainText('Copied');
});
```

### 9.4 Performance Tests

#### Load Testing with k6
```javascript
// tests/load/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.01'],   // <1% failures
  },
};

export default function () {
  const res = http.get('https://api.predictedge.com/api/races/today');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

### 9.5 Testing Checklist

**Before Each Release**:
- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] Critical E2E flows tested
- [ ] Load testing completed (API can handle 100 concurrent users)
- [ ] Security scan (npm audit, OWASP check)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile responsiveness tested (iOS, Android)
- [ ] Database migrations tested (up and down)
- [ ] Backup restore tested

---

## 10. Performance Optimization

### 10.1 Frontend Optimization

#### Code Splitting
```typescript
// Dynamic imports for large components
const ExoticBetBuilder = dynamic(() => import('@/components/ExoticBetBuilder'), {
  loading: () => <LoadingSkeleton />,
  ssr: false,
});

const PerformanceCharts = dynamic(() => import('@/components/PerformanceCharts'), {
  loading: () => <ChartSkeleton />,
});
```

#### Image Optimization
```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/horse-racing.jpg"
  alt="Horse racing"
  width={800}
  height={600}
  quality={80}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

#### Caching Strategy
```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Cache predictions for 30 minutes
useQuery({
  queryKey: ['race', raceId],
  queryFn: () => fetchRace(raceId),
  staleTime: 30 * 60 * 1000,
});
```

#### Bundle Size Optimization
- **Target**: <200KB initial load (gzipped)
- **Techniques**:
  - Tree shaking
  - Code splitting by route
  - Lazy load modals and overlays
  - Use lighter alternatives (e.g., date-fns over moment)

### 10.2 Backend Optimization

#### Database Optimization
```sql
-- Essential indexes
CREATE INDEX idx_races_date_venue ON races(race_date, venue_id);
CREATE INDEX idx_race_horses_race ON race_horses(race_id);
CREATE INDEX idx_predictions_race ON race_predictions(race_id);
CREATE INDEX idx_bets_user_status ON bets(user_id, status);
CREATE INDEX idx_bets_event ON bets(event_type, event_id);

-- Query optimization example
EXPLAIN ANALYZE
SELECT r.*, rp.*
FROM races r
JOIN race_predictions rp ON r.id = rp.race_id
WHERE r.race_date = CURRENT_DATE
  AND r.venue_id = 'venue-123'
ORDER BY r.post_time;
```

#### Caching Layers
```typescript
// Redis caching middleware
async function getCachedPredictions(raceId: string) {
  const cached = await redis.get(`predictions:race:${raceId}`);
  if (cached) return JSON.parse(cached);
  
  const predictions = await generatePredictions(raceId);
  await redis.setex(
    `predictions:race:${raceId}`,
    30 * 60, // 30 minutes
    JSON.stringify(predictions)
  );
  
  return predictions;
}
```

#### Connection Pooling
```typescript
// Prisma connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  connectionTimeout: 10000,
  pool: {
    min: 2,
    max: 10,
  },
});
```

### 10.3 API Response Optimization

#### Pagination
```typescript
// Paginated responses
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

async function getBets(userId: string, page: number = 1, pageSize: number = 20) {
  const skip = (page - 1) * pageSize;
  
  const [bets, total] = await Promise.all([
    prisma.bet.findMany({
      where: { userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.bet.count({ where: { userId } }),
  ]);
  
  return {
    data: bets,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
```

#### Response Compression
```typescript
// Enable gzip compression
import compression from 'compression';

app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses > 1KB
}));
```

### 10.4 Mobile Optimization

#### Offline Support
```typescript
// React Query persistence
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const persister = createSyncStoragePersister({
  storage: AsyncStorage,
});

// Wrap app
<PersistQueryClientProvider
  client={queryClient}
  persister={persister}
  maxAge={24 * 60 * 60 * 1000} // 24 hours
>
  <App />
</PersistQueryClientProvider>
```

#### Image Caching
```typescript
// Expo image caching
import { Image } from 'expo-image';

<Image
  source={{ uri: horseImageUrl }}
  cachePolicy="memory-disk"
  contentFit="cover"
  transition={200}
/>
```

---

## 11. Future Enhancements

### Phase 2 Features (Q2 2026)

#### Live Betting Features
- **Live odds tracking**: Real-time odds updates during races
- **In-play betting suggestions**: AI recommendations as race progresses
- **Live race visualization**: Animated race tracker

#### Social Features
- **Friends/Groups**: Connect with other users
- **Leaderboards**: Compare performance with friends
- **Shared picks**: Share bet slips with friends
- **Copy betting**: Follow successful users' picks

#### Advanced Analytics
- **Predictive modeling**: Show how different scenarios affect outcomes
- **Variance analysis**: Understand betting volatility
- **ROI optimization**: AI suggests optimal betting strategy
- **Performance attribution**: Break down what's working

### Phase 3 Features (Q3 2026)

#### Premium Subscription
- **Pricing**: $9.99/month or $99/year
- **Features**:
  - Advanced analytics
  - Priority AI responses
  - Export unlimited reports
  - Early access to new features
  - Custom notifications

#### API Access
- **Developer API**: Allow third parties to access predictions
- **Pricing**: Tiered based on usage
- **Use Cases**: Other betting apps, research

#### Multi-Currency Support
- Support USD, EUR, GBP in addition to AUD
- Automatic conversion for international users

### Phase 4 Features (Q4 2026)

#### Machine Learning Improvements
- **Model retraining**: Continuous learning from results
- **Ensemble models**: Combine multiple prediction models
- **Feature importance**: Show which factors matter most
- **Confidence intervals**: Better uncertainty quantification

#### Betting Syndicate Tools
- **Group bankroll management**: Pool funds with friends
- **Voting on bets**: Democratic decision making
- **Performance tracking**: Individual and group stats
- **Profit distribution**: Auto-calculate shares

#### International Expansion
- **UK racing**: Add UK race tracks
- **US racing**: Add US tracks
- **Other sports**: Add NFL, NHL, EPL

---

## Conclusion

This technical blueprint provides a comprehensive roadmap for building PredictEdge, a sophisticated multi-sport betting prediction application. Key takeaways:

1. **Racing-First Design**: Horse racing is the hero feature with detailed predictions and exotic bet builders
2. **AI-Powered**: Anthropic Claude integration provides conversational assistance and explanations
3. **No Betting Transactions**: App is strictly for predictions and tracking - users place bets elsewhere
4. **Mobile-First**: Responsive design with native mobile apps for iOS and Android
5. **Scalable Architecture**: Microservices with independent scaling, caching, and queue systems
6. **Data-Driven**: Comprehensive analytics comparing user performance vs AI recommendations

### Next Steps

1. **Review & Approve**: Stakeholders review this blueprint
2. **Setup Development Environment**: Initialize monorepo, set up databases
3. **Phase 1 Implementation**: Begin with authentication and core infrastructure
4. **Iterative Development**: Follow the 14-week implementation plan
5. **Testing & QA**: Comprehensive testing before each release
6. **Beta Launch**: Limited release to gather feedback
7. **Production Launch**: Full public release

### Success Criteria

- **User Engagement**: >70% D7 retention, >40% D30 retention
- **Prediction Accuracy**: >60% win rate on recommended bets
- **User Profitability**: Average user ROI >10%
- **Performance**: <500ms API response time (p95)
- **Reliability**: 99.9% uptime

**This document is a living blueprint and should be updated as the project evolves.**

---

*End of Technical Blueprint & SRS*
