# Master Prompt for Claude Code: Betting Prediction Application

## Project Overview
You are building **PredictEdge**, a multi-sport prediction and betting analytics application. This is a full-stack TypeScript/Python monorepo with web (Next.js), mobile (React Native), and backend services (Node.js/Python).

**Critical Context**: This app does NOT facilitate betting transactions. Users use it for predictions and tracking, then place bets through their own bookmaker apps.

## Your Role
You are the full-stack developer responsible for implementing the entire application according to the Technical Blueprint and SRS provided. You should:
1. Set up the monorepo structure
2. Implement all frontend and backend services
3. Integrate external APIs (racing, NBA, AFL)
4. Build the prediction engine
5. Create the UI according to design specifications
6. Implement the AI chatbot integration
7. Set up deployment pipelines

## Reference Documents
- **Technical Blueprint**: `/mnt/user-data/outputs/TECHNICAL_BLUEPRINT_AND_SRS.md`
- **UI/UX Specifications**: See Section 6 of the blueprint
- **API Specifications**: See Section 7 of the blueprint

## Project Structure

```
predictedge/
├── apps/
│   ├── web/                 # Next.js web application
│   ├── mobile/              # React Native + Expo
│   └── api/                 # Node.js API gateway
├── services/
│   ├── prediction-engine/   # Python FastAPI service
│   └── ai-service/          # Node.js AI chatbot service
├── packages/
│   ├── ui/                  # Shared React components
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Shared utilities
│   ├── prisma/              # Database schema and client
│   └── config/              # Shared configs (ESLint, TS, etc.)
├── scripts/
│   ├── seed-database.ts
│   └── generate-test-data.ts
├── .github/
│   └── workflows/           # CI/CD pipelines
├── package.json             # Root package.json
├── turbo.json              # Turborepo config
├── pnpm-workspace.yaml
└── README.md
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router), React Native + Expo 50+
- **Language**: TypeScript 5.0+
- **Styling**: Tailwind CSS 3.4+
- **State**: Zustand + React Query (TanStack Query)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts (web), Victory Native (mobile)
- **UI Components**: Radix UI + custom design system
- **Icons**: Lucide React

### Backend
- **API Gateway**: Node.js 20 + Express + tRPC
- **Prediction Engine**: Python 3.11+ + FastAPI
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+
- **Queue**: BullMQ
- **Auth**: JWT (jose library)
- **AI**: Anthropic Claude API

### DevOps
- **Monorepo**: Turborepo + pnpm
- **Hosting**: Vercel (web), Expo EAS (mobile), Railway (backend)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up infrastructure and core authentication

**Tasks**:
1. Initialize monorepo with Turborepo
2. Set up PostgreSQL + Prisma schema
3. Create shared packages (types, utils, UI)
4. Implement authentication (register, login, JWT)
5. Set up Redis for caching
6. Create basic Next.js app with routing
7. Create basic React Native app with navigation

**Acceptance Criteria**:
- Users can register and login
- JWT tokens working
- Database schema created and migrated
- Shared component library started
- Both web and mobile apps running locally

**Commands to Run**:
```bash
# Initialize
pnpm create turbo@latest
cd predictedge

# Setup packages
pnpm add -w prisma @prisma/client
pnpm add -w zod zustand @tanstack/react-query

# Init Prisma
cd packages/prisma
npx prisma init

# Run dev
pnpm dev
```

**Key Files to Create**:
- `packages/prisma/schema.prisma` - Database schema (see Section 4.1 of blueprint)
- `packages/types/src/index.ts` - Shared TypeScript types
- `apps/api/src/routes/auth.ts` - Auth endpoints
- `apps/web/src/app/login/page.tsx` - Login page
- `apps/mobile/src/screens/LoginScreen.tsx` - Mobile login

---

### Phase 2: Racing Data Pipeline (Week 3-4)
**Goal**: Fetch, store, and display racing data

**Tasks**:
1. Implement racing data sync service (external API integration)
2. Set up BullMQ for scheduled jobs (every 30min, Wed-Sun 12-7pm AEST)
3. Create database tables for races, horses, venues, jockeys, trainers
4. Build basic prediction engine (statistical model)
5. Implement Redis caching for predictions (30min TTL)
6. Create racing feed UI (hero page)
7. Create race detail view UI

**External APIs to Integrate**:
- Racing.com API or Punters API (primary)
- Web scraping as fallback (Playwright/Scrapy)

**Acceptance Criteria**:
- Racing data syncs automatically on schedule
- Predictions generated for all races
- Racing feed displays today's races
- Users can drill down into race details
- Top 3 picks shown on each race card

**Key Files to Create**:
- `services/prediction-engine/src/racing/data_sync.py` - Data fetching
- `services/prediction-engine/src/racing/predictions.py` - ML model
- `apps/api/src/routes/races.ts` - Racing API endpoints
- `apps/api/src/jobs/data-sync.ts` - BullMQ job scheduler
- `apps/web/src/app/page.tsx` - Racing feed (default page)
- `apps/web/src/components/RaceCard.tsx` - Race card component
- `apps/mobile/src/screens/RacingFeedScreen.tsx`

**Example Racing Data Sync**:
```python
# services/prediction-engine/src/racing/data_sync.py
import httpx
from datetime import datetime, timezone
from models import Race, Horse, RaceHorse

async def sync_races_for_date(date: str):
    """Fetch and sync race data from external API"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.racing.com/races?date={date}",
            headers={"Authorization": f"Bearer {API_KEY}"}
        )
        data = response.json()
        
        for meeting in data["meetings"]:
            for race_data in meeting["races"]:
                # Upsert race
                race = await Race.upsert(
                    venue_id=race_data["venue_id"],
                    race_number=race_data["race_number"],
                    race_date=date,
                    data=race_data
                )
                
                # Upsert horses for this race
                for horse_data in race_data["horses"]:
                    await RaceHorse.upsert(
                        race_id=race.id,
                        horse_id=horse_data["id"],
                        data=horse_data
                    )
        
        return len(data["meetings"])
```

---

### Phase 3: Basketball & AFL (Week 5)
**Goal**: Add basketball and AFL predictions

**Tasks**:
1. Integrate NBA API and AFL APIs
2. Create database tables for games, teams, players
3. Build prediction models for basketball and AFL
4. Create tabbed navigation (Racing, Basketball, AFL)
5. Implement basketball and AFL feed UIs
6. Implement game detail views
7. Implement player props predictions

**Acceptance Criteria**:
- NBA and AFL data syncs on schedule
- Game predictions generated
- Users can switch between sports via tabs
- Game detail views show predictions and player props

**Key Files to Create**:
- `services/prediction-engine/src/basketball/data_sync.py`
- `services/prediction-engine/src/basketball/predictions.py`
- `services/prediction-engine/src/afl/data_sync.py`
- `services/prediction-engine/src/afl/predictions.py`
- `apps/web/src/app/basketball/page.tsx`
- `apps/web/src/app/afl/page.tsx`
- `apps/web/src/components/GameCard.tsx`

---

### Phase 4: Exotic Bet Builder (Week 6)
**Goal**: Interactive exotic bet calculator

**Tasks**:
1. Build exotic bet suggestion algorithm (Python)
2. Create exotic bet builder UI component
3. Implement live cost calculator
4. Add strategies: Box, Banker, Roving Banker
5. Generate AI recommendations for exotic bets
6. Add "Copy to clipboard" functionality

**Acceptance Criteria**:
- Users can select horses and see live cost updates
- Multiple exotic bet types supported (Exacta, Trifecta, First 4, Quinella)
- Cost calculator shows combinations, total cost, potential return
- AI suggestions appear when value exists
- Users can copy formatted bet string to clipboard

**Key Files to Create**:
- `services/prediction-engine/src/racing/exotic_suggestions.py`
- `apps/web/src/components/ExoticBetBuilder.tsx`
- `packages/utils/src/exotic-calculator.ts`

**Example Exotic Calculator**:
```typescript
// packages/utils/src/exotic-calculator.ts
export function calculateTrifectaCost(
  horses: string[],
  strategy: 'box' | 'banker' | 'rovingBanker',
  banker?: string
): { combinations: number; cost: number } {
  const n = horses.length;
  
  if (strategy === 'box') {
    // Permutations: n! / (n-3)!
    const combinations = n * (n - 1) * (n - 2);
    return { combinations, cost: combinations };
  }
  
  if (strategy === 'banker' && banker) {
    // Banker in first position, remaining horses in 2nd and 3rd
    const remaining = horses.filter(h => h !== banker);
    const combinations = remaining.length * (remaining.length - 1);
    return { combinations, cost: combinations };
  }
  
  // Add roving banker logic...
  
  return { combinations: 0, cost: 0 };
}
```

---

### Phase 5: AI Chat Assistant (Week 7)
**Goal**: Integrate Anthropic Claude for conversational AI

**Tasks**:
1. Set up AI service with Anthropic SDK
2. Implement streaming chat endpoint
3. Create floating chat bubble UI
4. Build conversation history storage
5. Add context-awareness (current race/game)
6. Implement quick actions (navigate, open bet builder)

**Acceptance Criteria**:
- Chat bubble visible on all screens
- Users can ask questions and get streaming responses
- AI has access to prediction data and can explain reasoning
- Conversation history maintained within session
- Context-aware (knows what page user is on)

**Key Files to Create**:
- `services/ai-service/src/index.ts` - AI service with Anthropic client
- `apps/api/src/routes/ai.ts` - Chat API endpoints (SSE)
- `apps/web/src/components/AIChatBubble.tsx`
- `apps/mobile/src/components/AIChatOverlay.tsx`

**Example AI Service**:
```typescript
// services/ai-service/src/index.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function* streamChatResponse(
  message: string,
  context?: { type: 'race' | 'game'; id: string; data: any }
) {
  const systemPrompt = `You are an AI assistant for a betting prediction app.
${context ? `Current context: ${context.type} ${context.id}` : ''}
Help users understand predictions, explain reasoning, and answer questions.`;

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: message }],
    system: systemPrompt,
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      yield chunk.delta.text;
    }
  }
}
```

---

### Phase 6: Bet Tracking & Analytics (Week 8-9)
**Goal**: Manual bet logging and performance tracking

**Tasks**:
1. Create bet logging form UI
2. Implement bet CRUD endpoints
3. Build automatic settlement logic
4. Create performance dashboard
5. Implement AI comparison analytics
6. Add charts (bankroll over time, profit by sport)
7. Build export functionality (CSV, PDF)

**Acceptance Criteria**:
- Users can manually log bets
- Bets auto-settle when results available
- Dashboard shows key stats (P&L, win rate, ROI)
- Charts visualize performance over time
- AI comparison shows "followed vs ignored" performance
- Users can export reports

**Key Files to Create**:
- `apps/api/src/routes/bets.ts` - Bet tracking endpoints
- `apps/web/src/components/BetLoggingModal.tsx`
- `apps/web/src/app/analytics/page.tsx` - Performance dashboard
- `packages/utils/src/bet-settlement.ts`
- `packages/utils/src/report-generator.ts`

---

### Phase 7: Bankroll Management (Week 10)
**Goal**: Kelly Criterion bet sizing and bankroll tracking

**Tasks**:
1. Implement Kelly Criterion calculator
2. Add bankroll setup during onboarding
3. Create bankroll history tracking
4. Build bet sizing recommendation UI
5. Add warnings for oversized bets
6. Implement manual bankroll adjustments

**Acceptance Criteria**:
- Users set starting bankroll during registration
- System suggests bet sizes using Kelly Criterion
- Bankroll updates automatically when bets settle
- Users can manually add/withdraw funds
- Warnings shown if bet exceeds recommended size

**Key Files to Create**:
- `packages/utils/src/kelly-criterion.ts`
- `apps/web/src/components/BankrollManager.tsx`
- `apps/api/src/routes/bankroll.ts`

**Example Kelly Criterion**:
```typescript
// packages/utils/src/kelly-criterion.ts
export function calculateKellyBetSize(
  bankroll: number,
  winProbability: number,
  odds: number,
  riskMultiplier: number = 1 // 0.5 = conservative, 1 = moderate, 1.5 = aggressive
): number {
  // Kelly formula: (bp - q) / b
  // b = decimal odds - 1
  // p = win probability
  // q = 1 - p
  
  const b = odds - 1;
  const p = winProbability;
  const q = 1 - p;
  
  const kellyFraction = (b * p - q) / b;
  
  // Never bet negative Kelly (no edge)
  if (kellyFraction <= 0) return 0;
  
  // Apply risk multiplier and bankroll
  const recommendedBet = bankroll * kellyFraction * riskMultiplier;
  
  // Cap at 5% of bankroll for safety
  return Math.min(recommendedBet, bankroll * 0.05);
}
```

---

### Phase 8: Onboarding & Polish (Week 11)
**Goal**: Smooth user onboarding and UI refinement

**Tasks**:
1. Create multi-step onboarding flow
2. Add tooltips and coach marks
3. Implement feature discovery
4. Polish all UI components (animations, transitions)
5. Add loading states and skeleton screens
6. Implement error handling and empty states
7. Add dark mode support

**Acceptance Criteria**:
- New users see onboarding flow
- Tooltips appear for first-time actions
- All pages have proper loading states
- Error messages are clear and helpful
- Dark mode works throughout app
- Animations feel smooth and professional

**Key Files to Create**:
- `apps/web/src/components/Onboarding.tsx`
- `apps/web/src/components/FeatureTooltip.tsx`
- `packages/ui/src/LoadingSkeleton.tsx`
- `packages/ui/src/EmptyState.tsx`

---

### Phase 9: Mobile App (Week 12)
**Goal**: Complete React Native mobile app

**Tasks**:
1. Port all web components to React Native
2. Implement native navigation
3. Add biometric authentication
4. Set up push notifications
5. Optimize for performance
6. Add offline support (cached predictions)
7. Test on iOS and Android

**Acceptance Criteria**:
- Mobile app feature parity with web
- Biometric login works
- Push notifications configured
- App performs smoothly (60fps)
- Offline mode shows cached data

---

### Phase 10: Testing & Deployment (Week 13-14)
**Goal**: Comprehensive testing and production deployment

**Tasks**:
1. Write unit tests (Vitest)
2. Write integration tests
3. Write E2E tests (Playwright)
4. Set up CI/CD pipelines (GitHub Actions)
5. Deploy to production (Vercel, Railway, Expo EAS)
6. Set up monitoring (Sentry)
7. Performance testing and optimization

**Acceptance Criteria**:
- >80% code coverage
- All E2E tests passing
- CI/CD automatically deploys on merge to main
- Production apps running smoothly
- Monitoring and error tracking active

---

## Design System Implementation

### Colors (Tailwind Config)
```typescript
// apps/web/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        secondary: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        accent: {
          orange: '#f97316',
          red: '#ef4444',
          purple: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '1rem',
      },
    },
  },
  plugins: [],
};
```

### Component Examples

**Race Card Component**:
```typescript
// apps/web/src/components/RaceCard.tsx
import { Clock, Star, TrendingUp } from 'lucide-react';

interface RaceCardProps {
  race: {
    id: string;
    venue: string;
    raceNumber: number;
    postTime: string;
    distance: number;
    trackCondition: string;
    prizeMoney: number;
    topPicks: Array<{
      horseName: string;
      barrier: number;
      winProbability: number;
      winOdds: number;
      valueRating: string;
      aiRating: number;
    }>;
    exoticSuggestion?: {
      betType: string;
      cost: number;
    };
  };
}

export function RaceCard({ race }: RaceCardProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold">
            🏇 {race.venue} R{race.raceNumber}
          </span>
          <Clock className="w-4 h-4 text-neutral-500" />
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {formatTime(race.postTime)}
          </span>
        </div>
        {race.isLive && (
          <span className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full animate-pulse">
            LIVE
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        {race.distance}m • {race.trackCondition} • ${race.prizeMoney.toLocaleString()}
      </div>

      {/* Top 3 Picks */}
      <div className="space-y-3">
        {race.topPicks.map((pick, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </span>
              <div>
                <div className="font-semibold">
                  #{pick.barrier} {pick.horseName}
                </div>
                <div className="text-xs text-neutral-500">
                  {pick.winProbability}% Win • {pick.placeProbability}% Place
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-semibold">${pick.winOdds.toFixed(2)}</div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < pick.aiRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-neutral-300'
                    }`}
                  />
                ))}
              </div>
              {pick.valueRating === 'high' && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                  💰 Value
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Exotic Suggestion */}
      {race.exoticSuggestion && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            <span className="font-medium">
              AI Suggestion: {race.exoticSuggestion.betType} (${race.exoticSuggestion.cost})
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
          View Full Card
        </button>
        <button className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition">
          Ask AI
        </button>
        <button className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition">
          + Track Bet
        </button>
      </div>
    </div>
  );
}
```

---

## API Integration Guidelines

### Racing Data
```typescript
// Example: Fetching from racing.com API
async function fetchRacesForDate(date: string): Promise<RaceMeeting[]> {
  const response = await fetch(`https://api.racing.com/v1/races?date=${date}`, {
    headers: {
      'Authorization': `Bearer ${process.env.RACING_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch races: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.meetings;
}
```

### NBA Data
```typescript
// Example: Fetching from NBA API
async function fetchNBAGames(date: string): Promise<NBAGame[]> {
  const response = await fetch(
    `https://stats.nba.com/stats/scoreboardv2?GameDate=${date}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://stats.nba.com/',
      },
    }
  );
  
  const data = await response.json();
  return data.resultSets[0].rowSet.map(parseNBAGame);
}
```

### Anthropic AI
```typescript
// Example: Streaming chat with context
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function streamChatWithContext(
  message: string,
  raceId?: string
): Promise<ReadableStream> {
  // Fetch race context if provided
  let contextData = '';
  if (raceId) {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { horses: true, predictions: true },
    });
    contextData = `\n\nContext: User is viewing ${race.venue} Race ${race.raceNumber}. Top picks: ${race.predictions.slice(0, 3).map(p => p.horseName).join(', ')}`;
  }

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: message + contextData,
    }],
    system: 'You are an AI assistant for a betting prediction app. Provide helpful, concise explanations about predictions and strategies.',
  });

  return stream.toReadableStream();
}
```

---

## Database Migrations

Use Prisma Migrate for all schema changes:

```bash
# Create a migration
npx prisma migrate dev --name add_exotic_suggestions

# Apply migrations in production
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

**Example Migration Workflow**:
1. Update `packages/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Prisma generates SQL and applies it
4. Commit both schema.prisma and migration files

---

## Testing Strategy

### Unit Tests (Vitest)
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
    expect(result).toBeLessThanOrEqual(50); // Max 5% of bankroll
  });

  it('should scale with risk multiplier', () => {
    const conservative = calculateKellyBetSize(1000, 0.5, 2.5, 0.5);
    const aggressive = calculateKellyBetSize(1000, 0.5, 2.5, 1.5);
    expect(aggressive).toBeGreaterThan(conservative);
  });
});
```

### Integration Tests
```typescript
// apps/api/src/routes/bets.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

describe('Bet API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Create test user and get token
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
});
```

### E2E Tests (Playwright)
```typescript
// apps/web/tests/racing-flow.spec.ts
import { test, expect } from '@playwright/test';

test('user can view race and build exotic bet', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Should navigate to racing feed
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1')).toContainText('Racing');

  // Click on a race card
  await page.click('[data-testid="race-card-0"]');

  // Should see race details
  await expect(page.locator('[data-testid="race-title"]')).toBeVisible();

  // Open exotic bet builder
  await page.click('button:has-text("Build Exotic")');

  // Select horses
  await page.check('[data-testid="horse-checkbox-2"]');
  await page.check('[data-testid="horse-checkbox-5"]');
  await page.check('[data-testid="horse-checkbox-7"]');

  // Should see live cost update
  const costDisplay = page.locator('[data-testid="exotic-cost"]');
  await expect(costDisplay).toContainText('$6.00');

  // Copy to clipboard
  await page.click('button:has-text("Copy to Clipboard")');
  
  // Should show success message
  await expect(page.locator('.toast')).toContainText('Copied');
});
```

---

## Deployment Configuration

### Vercel (Web App)
```json
// vercel.json
{
  "buildCommand": "pnpm turbo build --filter=web",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "env": {
    "DATABASE_URL": "@database-url",
    "REDIS_URL": "@redis-url",
    "ANTHROPIC_API_KEY": "@anthropic-api-key"
  }
}
```

### Railway (Backend Services)
```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm turbo build --filter=api"

[deploy]
startCommand = "pnpm --filter=api start"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[[services]]
name = "api"
port = 3001

[[services]]
name = "prediction-engine"
port = 8000
```

### Expo EAS (Mobile App)
```json
// apps/mobile/eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json"
      }
    }
  }
}
```

---

## Environment Variables

Create `.env` files for each app/service:

### API Service (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/predictedge
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
ANTHROPIC_API_KEY=sk-ant-xxxxx
RACING_API_KEY=xxxxx
NBA_API_KEY=xxxxx
AFL_API_KEY=xxxxx
NODE_ENV=development
PORT=3001
```

### Prediction Engine (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/predictedge
REDIS_URL=redis://localhost:6379
RACING_API_URL=https://api.racing.com
NBA_API_URL=https://stats.nba.com
AFL_API_URL=https://api.afl.com.au
MODEL_PATH=./models
```

### Web App (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Performance Optimization

### Caching Strategy
- **Redis TTLs**:
  - Predictions: 30 minutes
  - Odds: 5 minutes
  - User sessions: 30 days
  - API responses: 1 minute

### Database Optimization
- Index on `(race_date, venue_id)` for fast race lookups
- Index on `(user_id, created_at)` for bet history
- Use read replicas for analytics queries
- Batch insert race data (use transactions)

### Frontend Optimization
- Code splitting by route
- Lazy load charts (only when visible)
- Optimize images (next/image, WebP format)
- Virtual scrolling for long lists (react-window)
- Debounce search inputs

---

## Monitoring & Debugging

### Sentry Integration
```typescript
// apps/web/src/app/layout.tsx
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

### Logging
```typescript
// packages/utils/src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Usage
logger.info({ raceId: '123' }, 'Generating predictions for race');
logger.error({ err }, 'Failed to sync race data');
```

---

## Important Notes & Constraints

### Legal & Compliance
- **DO NOT**: Implement actual betting/payment functionality
- **DO NOT**: Store credit card or payment information
- **DO**: Include disclaimers about responsible gambling
- **DO**: Make it clear the app is for information/tracking only

### Data Sync Schedule
- **Active Hours**: Wednesday-Sunday, 12pm-7pm AEST only
- **Frequency**: Every 30 minutes
- **Reason**: Racing events primarily on weekends, saves API costs

### AI Rate Limits
- Anthropic Claude: 50 requests/min (tier 1)
- Implement exponential backoff for retries
- Cache common questions/answers

### Mobile Considerations
- Optimize bundle size (use React Native's new architecture)
- Minimize background syncs (battery life)
- Graceful offline handling (show cached data)

---

## Skills & Tools Available

Based on the Technical Blueprint, you have access to Claude Code's skills for:

1. **Document Creation**: Use the `docx` skill for generating reports (e.g., performance reports, export functionality)
2. **Spreadsheet Creation**: Use the `xlsx` skill if you need to generate CSV/Excel exports
3. **PDF Generation**: Use the `pdf` skill for PDF reports
4. **Frontend Design**: Use the `frontend-design` skill for creating polished UI components that match the design system

**Example Usage**:
```bash
# When creating the performance export feature:
# 1. First, read the xlsx skill documentation
view /mnt/skills/public/xlsx/SKILL.md

# 2. Then implement the export using the guidelines
```

---

## Getting Started Checklist

Before you begin coding:

- [ ] Read the complete Technical Blueprint (Section 1-11)
- [ ] Review UI/UX specifications (Section 6)
- [ ] Study the database schema (Section 4.1)
- [ ] Understand the API endpoints (Section 7)
- [ ] Set up your development environment (Node 20, Python 3.11, PostgreSQL, Redis)
- [ ] Clone a starter monorepo or initialize from scratch
- [ ] Create `.env` files with dummy keys for local dev
- [ ] Install dependencies: `pnpm install`

---

## First Commands to Run

```bash
# Initialize monorepo
pnpm create turbo@latest predictedge
cd predictedge

# Install core dependencies
pnpm add -w @prisma/client prisma zod zustand @tanstack/react-query
pnpm add -w -D typescript @types/node vitest

# Set up Prisma
mkdir packages/prisma
cd packages/prisma
npx prisma init

# Copy the database schema from the blueprint into schema.prisma
# Then generate the client
npx prisma generate

# Start development
pnpm dev
```

---

## Success Criteria

By the end of this project, you should have:

1. ✅ A fully functional web app (Next.js) deployed to Vercel
2. ✅ A fully functional mobile app (React Native) deployed via Expo EAS
3. ✅ Backend API services running on Railway
4. ✅ Prediction engine generating accurate predictions
5. ✅ AI chatbot providing helpful explanations
6. ✅ Complete bet tracking and analytics
7. ✅ Polished UI matching the design specifications
8. ✅ >80% test coverage
9. ✅ CI/CD pipelines automating deployments
10. ✅ Monitoring and error tracking active

---

## Questions & Support

If you encounter blockers:
1. Refer back to the Technical Blueprint
2. Check the API specifications
3. Review example code snippets in this document
4. Test in isolation (unit tests)

Remember: **The app does NOT facilitate betting.** Users track their predictions and performance, but place actual bets through their own bookmaker apps.

Good luck building PredictEdge! 🚀
