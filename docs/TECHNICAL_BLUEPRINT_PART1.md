# Betting Prediction Application - Technical Blueprint & SRS (Part 1)

**Project Name**: PredictEdge (Working Title)  
**Version**: 1.0  
**Date**: January 2026  
**Document Type**: Technical Blueprint & Software Requirements Specification

---

## Table of Contents - Part 1

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Data Architecture](#data-architecture)
5. [Functional Requirements](#functional-requirements)

---

## 1. Executive Summary

### 1.1 Project Overview
PredictEdge is a multi-sport prediction and analysis application focused on horse racing, basketball (NBA/NBL), and AFL. The application provides AI-powered predictions, bankroll management, and detailed analytics to help users make informed betting decisions. **Critical**: The app does NOT facilitate betting transactions - users place bets through their own bookmaker apps.

### 1.2 Core Value Proposition
- **Racing-First Experience**: Horse racing is the hero feature, loaded by default
- **AI-Powered Insights**: Anthropic Claude integration for natural language analysis
- **Strategic Guidance**: Exotic bet recommendations with live cost calculators
- **Performance Tracking**: Detailed analytics comparing user decisions vs AI predictions
- **Multi-Sport Coverage**: Seamless navigation between racing, basketball, and AFL

### 1.3 Target Users
- **Primary**: Recreational punters betting $50-$500 per event
- **Secondary**: Serious bettors looking for data-driven edge
- **User Context**: 25-55 years old, mobile-first, time-constrained, value-conscious

### 1.4 Success Metrics
- User retention (D7, D30)
- Prediction accuracy (win rate, ROI)
- User profitability (tracked P&L)
- Feature engagement (AI chat, exotic builders)
- Time to value (seconds from open to actionable insight)

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Web App    │         │  Mobile App  │                 │
│  │  (Next.js)   │         │(React Native)│                 │
│  └──────────────┘         └──────────────┘                 │
└─────────────────┬───────────────┬──────────────────────────┘
                  │               │
                  │   REST/GraphQL API
                  │               │
┌─────────────────▼───────────────▼──────────────────────────┐
│                   API Gateway Layer                         │
│              (Node.js / Express / tRPC)                     │
└─────────────────┬──────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┬──────────┬────────────┐
        │                   │          │            │
┌───────▼────────┐  ┌──────▼──────┐  ┌▼──────────┐ ┌▼──────────┐
│ Prediction     │  │   User      │  │  Betting  │ │   AI      │
│ Engine Service │  │   Service   │  │  Tracker  │ │  Service  │
│   (Python/     │  │  (Node.js)  │  │ (Node.js) │ │ (Node.js) │
│    FastAPI)    │  │             │  │           │ │           │
└────────┬───────┘  └──────┬──────┘  └─────┬─────┘ └─────┬─────┘
         │                 │                │             │
         │                 │                │             │
┌────────▼─────────────────▼────────────────▼─────────────▼─────┐
│                    Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  PostgreSQL  │  │    Redis     │  │   S3/Blob    │        │
│  │  (Primary)   │  │   (Cache)    │  │  (Assets)    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────────────────────────────────────────┘
         │                 │                │
         │                 │                │
┌────────▼─────────────────▼────────────────▼─────────────┐
│              External Data Sources                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Racing   │  │   NBA    │  │   AFL    │  │ Weather │ │
│  │ APIs     │  │   API    │  │   API    │  │   API   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────┘
         │                 │                │
         │                 │                │
┌────────▼─────────────────▼────────────────▼─────────────┐
│           Background Jobs / Schedulers                   │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Data Sync    │  │  Prediction  │                     │
│  │ (Every 30min)│  │  Generator   │                     │
│  └──────────────┘  └──────────────┘                     │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

#### 2.2.1 Client Layer
- **Web App (Next.js 14+)**
  - Server-side rendering for SEO
  - Progressive Web App (PWA) capabilities
  - Responsive design (mobile-first)
  - Shared component library with mobile

- **Mobile App (React Native + Expo)**
  - Native iOS and Android
  - Push notifications
  - Biometric authentication
  - Offline-first architecture for viewing cached predictions

#### 2.2.2 API Gateway
- **Technology**: Node.js with tRPC for type-safe APIs
- **Responsibilities**:
  - Request routing
  - Authentication & authorization (JWT)
  - Rate limiting
  - API versioning
  - Request/response transformation

#### 2.2.3 Prediction Engine Service
- **Technology**: Python 3.11+ with FastAPI
- **Responsibilities**:
  - Machine learning model inference
  - Statistical analysis
  - Probability calculations
  - Exotic bet combination generation
  - Historical pattern matching

#### 2.2.4 User Service
- **Technology**: Node.js with Prisma ORM
- **Responsibilities**:
  - User authentication
  - Profile management
  - Bankroll tracking
  - Preferences storage
  - Notification settings

#### 2.2.5 Betting Tracker Service
- **Technology**: Node.js with Prisma ORM
- **Responsibilities**:
  - Bet logging and tracking
  - P&L calculations
  - Performance analytics
  - ROI reporting
  - Win/loss streak tracking

#### 2.2.6 AI Service
- **Technology**: Node.js with Anthropic SDK
- **Responsibilities**:
  - Chatbot interactions
  - Natural language query processing
  - Contextual explanations
  - Insight generation
  - Conversational bet recommendations

### 2.3 Data Flow Diagrams

#### 2.3.1 User Views Racing Predictions
```
User → Web/Mobile App
        ↓
    API Gateway (Auth check)
        ↓
    Check Redis Cache (30min TTL)
        ↓ (cache miss)
    Prediction Engine Service
        ↓
    Fetch from PostgreSQL (race data, historical)
        ↓
    Run ML models
        ↓
    Generate predictions + exotic recommendations
        ↓
    Cache in Redis
        ↓
    Return to client with confidence scores
```

#### 2.3.2 User Asks AI Question
```
User → "Why is horse #5 favored?"
        ↓
    AI Service
        ↓
    Fetch race context from PostgreSQL
        ↓
    Anthropic Claude API (with context)
        ↓
    Generate natural language explanation
        ↓
    Stream response to client
```

#### 2.3.3 Background Data Sync (Every 30min, Wed-Sun 12pm-7pm AEST)
```
Scheduler triggers job
        ↓
    Data Sync Service
        ↓
    Fetch from external APIs (racing.com, NBA, AFL)
        ↓
    Transform and validate data
        ↓
    Upsert into PostgreSQL
        ↓
    Invalidate relevant Redis cache
        ↓
    Trigger prediction regeneration
        ↓
    Send push notifications (if significant changes)
```

### 2.4 Scalability Considerations
- **Horizontal Scaling**: All services containerized, can scale independently
- **Database**: Read replicas for analytics queries
- **Caching**: Redis for frequently accessed predictions
- **CDN**: Static assets and images served via CDN
- **Rate Limiting**: Per-user and per-endpoint limits
- **Queue System**: BullMQ for background jobs (data sync, predictions)

---

## 3. Technology Stack

### 3.1 Frontend

#### 3.1.1 Web Application
```typescript
// Primary Stack
- Framework: Next.js 14+ (App Router)
- Language: TypeScript 5.0+
- Styling: Tailwind CSS 3.4+
- State Management: Zustand + React Query
- Forms: React Hook Form + Zod validation
- Charts: Recharts (for analytics)
- Animations: Framer Motion
- UI Components: Radix UI primitives + custom design system
- Icons: Lucide React
- Date/Time: date-fns (AEST timezone handling)
```

#### 3.1.2 Mobile Application
```typescript
// Primary Stack
- Framework: React Native 0.73+ with Expo 50+
- Language: TypeScript 5.0+
- Navigation: React Navigation 6
- State Management: Zustand + React Query
- UI Components: React Native Paper (themed) + custom components
- Charts: Victory Native
- Animations: Reanimated 3
- Local Storage: Expo SecureStore + MMKV
- Push Notifications: Expo Notifications
- Biometrics: Expo Local Authentication
```

### 3.2 Backend

#### 3.2.1 API Gateway & Services
```typescript
// Node.js Services
- Runtime: Node.js 20 LTS
- Framework: Express.js + tRPC
- Language: TypeScript 5.0+
- ORM: Prisma 5+
- Validation: Zod
- Authentication: JWT (jose library)
- Password Hashing: bcrypt
- Job Queue: BullMQ (Redis-backed)
- HTTP Client: axios
- Environment: dotenv + zod for validation
```

#### 3.2.2 Prediction Engine
```python
# Python Service
- Runtime: Python 3.11+
- Framework: FastAPI
- ML Libraries: scikit-learn, pandas, numpy
- Statistical: scipy, statsmodels
- Data Validation: pydantic
- HTTP Client: httpx
- Async: asyncio
- WSGI Server: uvicorn
```

### 3.3 Data Layer

#### 3.3.1 Primary Database
```
PostgreSQL 15+
- Extensions: pgvector (for embeddings), pg_stat_statements
- Connection Pooling: PgBouncer
- Backup: Automated daily snapshots
```

#### 3.3.2 Cache Layer
```
Redis 7+
- Use Cases:
  - Prediction caching (30min TTL)
  - Session storage
  - Rate limiting
  - Real-time odds updates
  - Job queue (BullMQ)
- Data Structures: Strings, Hashes, Sorted Sets, Lists
```

#### 3.3.3 Object Storage
```
AWS S3 / Azure Blob Storage
- Assets: Horse/player images, team logos
- Exports: User P&L reports (CSV/PDF)
- Backups: Database dumps
```

### 3.4 External APIs & Data Sources

#### 3.4.1 Racing Data
```
Primary: racing.com API / Punters API
Fallback: Web scraping (Scrapy/Playwright)
Data Points:
- Race cards (horses, barriers, weights, jockeys, trainers)
- Form guide (last 5 runs, track/distance stats)
- Odds (win, place, exotic)
- Results (finishing positions, margins, times)
- Track conditions (weather, rail position)
```

#### 3.4.2 Basketball Data
```
Primary: NBA API (official)
Secondary: basketball-reference.com (historical)
Data Points:
- Game schedule, scores, box scores
- Player stats (points, rebounds, assists, shooting %)
- Team stats (offensive/defensive ratings)
- Injury reports
- Advanced metrics (PER, TS%, usage rate)
```

#### 3.4.3 AFL Data
```
Primary: AFL Tables API / Squiggle API
Secondary: Official AFL API
Data Points:
- Game schedule, scores, statistics
- Player stats (disposals, kicks, marks, tackles)
- Team stats (scoring shots, inside 50s)
- Weather conditions
- Venue history
```

#### 3.4.4 AI Integration
```
Primary: Anthropic Claude API
- Model: claude-sonnet-4-20250514
- Use Cases: Chatbot, explanations, insights
- Context window: 200K tokens
- Streaming: Server-sent events

Future: OpenAI API (GPT-4)
- Easy migration path (same interface pattern)
```

### 3.5 DevOps & Infrastructure

#### 3.5.1 Hosting
```
Frontend:
- Web: Vercel (Next.js native, edge functions)
- Mobile: Expo EAS (build & deploy)

Backend:
- API Services: Railway / Fly.io (containerized)
- Python Service: AWS ECS / Cloud Run
- Database: Supabase (managed Postgres) or Neon
- Redis: Upstash or Redis Cloud
- Object Storage: AWS S3
```

#### 3.5.2 CI/CD
```
- Version Control: GitHub
- CI: GitHub Actions
  - Lint, test, build on PR
  - Deploy on merge to main
- Secrets Management: GitHub Secrets + Doppler
- Monitoring: Sentry (errors), Vercel Analytics (web), Posthog (product)
```

#### 3.5.3 Development Tools
```
- Package Manager: pnpm (monorepo with Turborepo)
- Code Quality: ESLint, Prettier, TypeScript strict mode
- Testing: Vitest (unit), Playwright (e2e), React Testing Library
- API Testing: Bruno or Postman
- Database Migrations: Prisma Migrate
- Documentation: Storybook (components), OpenAPI (API docs)
```

---

## 4. Data Architecture

### 4.1 Database Schema (PostgreSQL)

#### 4.1.1 User Management

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  starting_bankroll DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_bankroll DECIMAL(10,2) NOT NULL DEFAULT 0,
  risk_preference VARCHAR(20) DEFAULT 'moderate',
  preferred_sports JSONB DEFAULT '["racing"]',
  timezone VARCHAR(50) DEFAULT 'Australia/Sydney',
  notification_settings JSONB DEFAULT '{}',
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

#### 4.1.2 Horse Racing

```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  location VARCHAR(100),
  track_type VARCHAR(20),
  track_length INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  stable_location VARCHAR(100),
  win_rate DECIMAL(5,2),
  place_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jockeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  weight_kg DECIMAL(4,1),
  win_rate DECIMAL(5,2),
  place_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  age INTEGER,
  sex VARCHAR(10),
  color VARCHAR(50),
  sire VARCHAR(100),
  dam VARCHAR(100),
  trainer_id UUID REFERENCES trainers(id),
  owner VARCHAR(100),
  career_stats JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id),
  race_number INTEGER NOT NULL,
  race_name VARCHAR(200),
  race_date DATE NOT NULL,
  post_time TIME NOT NULL,
  distance INTEGER NOT NULL,
  track_condition VARCHAR(20),
  rail_position VARCHAR(20),
  prize_money DECIMAL(10,2),
  race_class VARCHAR(50),
  age_restriction VARCHAR(50),
  weight_conditions VARCHAR(100),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(venue_id, race_date, race_number)
);

CREATE TABLE race_horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID REFERENCES races(id) ON DELETE CASCADE,
  horse_id UUID REFERENCES horses(id),
  jockey_id UUID REFERENCES jockeys(id),
  barrier INTEGER NOT NULL,
  handicap_weight DECIMAL(4,1),
  last_5_form VARCHAR(20),
  career_track_distance JSONB,
  gear VARCHAR(100),
  emergency BOOLEAN DEFAULT FALSE,
  scratched BOOLEAN DEFAULT FALSE,
  scratched_reason TEXT,
  win_odds DECIMAL(6,2),
  place_odds DECIMAL(6,2),
  last_odds_update TIMESTAMP,
  finishing_position INTEGER,
  margin DECIMAL(5,2),
  finish_time DECIMAL(6,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(race_id, horse_id)
);

CREATE TABLE race_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID REFERENCES races(id) ON DELETE CASCADE,
  horse_id UUID REFERENCES horses(id),
  win_probability DECIMAL(5,2) NOT NULL,
  place_probability DECIMAL(5,2) NOT NULL,
  show_probability DECIMAL(5,2) NOT NULL,
  fair_win_odds DECIMAL(6,2),
  value_rating VARCHAR(20),
  confidence_score DECIMAL(5,2),
  factors JSONB,
  suggested_exotics JSONB,
  generated_at TIMESTAMP DEFAULT NOW(),
  model_version VARCHAR(20),
  UNIQUE(race_id, horse_id, generated_at)
);

CREATE TABLE exotic_bet_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID REFERENCES races(id) ON DELETE CASCADE,
  bet_type VARCHAR(20) NOT NULL,
  strategy VARCHAR(50),
  bankers JSONB,
  support JSONB,
  outsiders JSONB,
  total_combinations INTEGER,
  cost_per_dollar DECIMAL(10,2),
  estimated_roi DECIMAL(6,2),
  risk_level VARCHAR(20),
  recommendation_strength VARCHAR(20),
  reasoning TEXT,
  generated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_races_date_venue ON races(race_date, venue_id);
CREATE INDEX idx_race_horses_race ON race_horses(race_id);
CREATE INDEX idx_predictions_race ON race_predictions(race_id);
```

#### 4.1.3 Basketball (NBA/NBL)

```sql
CREATE TABLE nba_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  conference VARCHAR(20),
  division VARCHAR(50),
  venue VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nba_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  team_id UUID REFERENCES nba_teams(id),
  position VARCHAR(20),
  jersey_number INTEGER,
  height_cm INTEGER,
  weight_kg INTEGER,
  season_stats JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nba_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_date DATE NOT NULL,
  game_time TIME NOT NULL,
  home_team_id UUID REFERENCES nba_teams(id),
  away_team_id UUID REFERENCES nba_teams(id),
  venue VARCHAR(100),
  season VARCHAR(20),
  is_completed BOOLEAN DEFAULT FALSE,
  home_score INTEGER,
  away_score INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nba_game_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES nba_games(id) ON DELETE CASCADE,
  home_win_probability DECIMAL(5,2) NOT NULL,
  away_win_probability DECIMAL(5,2) NOT NULL,
  predicted_spread DECIMAL(4,1),
  spread_confidence DECIMAL(5,2),
  predicted_total DECIMAL(5,1),
  over_probability DECIMAL(5,2),
  under_probability DECIMAL(5,2),
  recommended_bets JSONB,
  generated_at TIMESTAMP DEFAULT NOW(),
  model_version VARCHAR(20),
  UNIQUE(game_id, generated_at)
);

CREATE TABLE nba_player_prop_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES nba_games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES nba_players(id),
  predicted_points DECIMAL(5,2),
  points_over_prob DECIMAL(5,2),
  predicted_rebounds DECIMAL(5,2),
  rebounds_over_prob DECIMAL(5,2),
  predicted_assists DECIMAL(5,2),
  assists_over_prob DECIMAL(5,2),
  pts_rebs_asts_total DECIMAL(5,2),
  confidence_score DECIMAL(5,2),
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, player_id, generated_at)
);

CREATE INDEX idx_nba_games_date ON nba_games(game_date);
CREATE INDEX idx_nba_predictions_game ON nba_game_predictions(game_id);
```

#### 4.1.4 AFL

```sql
CREATE TABLE afl_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  home_venue VARCHAR(100),
  colors JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE afl_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  team_id UUID REFERENCES afl_teams(id),
  position VARCHAR(50),
  jersey_number INTEGER,
  height_cm INTEGER,
  weight_kg INTEGER,
  season_stats JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE afl_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL,
  game_date DATE NOT NULL,
  game_time TIME NOT NULL,
  home_team_id UUID REFERENCES afl_teams(id),
  away_team_id UUID REFERENCES afl_teams(id),
  venue VARCHAR(100),
  weather_conditions JSONB,
  season INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  home_score INTEGER,
  away_score INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE afl_game_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES afl_games(id) ON DELETE CASCADE,
  home_win_probability DECIMAL(5,2) NOT NULL,
  away_win_probability DECIMAL(5,2) NOT NULL,
  predicted_margin DECIMAL(5,1),
  margin_confidence DECIMAL(5,2),
  predicted_total DECIMAL(5,1),
  over_probability DECIMAL(5,2),
  under_probability DECIMAL(5,2),
  weather_impact DECIMAL(5,2),
  venue_advantage DECIMAL(5,2),
  generated_at TIMESTAMP DEFAULT NOW(),
  model_version VARCHAR(20),
  UNIQUE(game_id, generated_at)
);

CREATE INDEX idx_afl_games_date ON afl_games(game_date);
```

#### 4.1.5 Betting & Tracking

```sql
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL,
  event_id UUID NOT NULL,
  event_name TEXT,
  event_time TIMESTAMP,
  bet_type VARCHAR(50) NOT NULL,
  selection TEXT NOT NULL,
  odds DECIMAL(6,2) NOT NULL,
  stake DECIMAL(10,2) NOT NULL,
  exotic_details JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  payout DECIMAL(10,2),
  settled_at TIMESTAMP,
  was_ai_recommended BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bet_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  total_bets INTEGER,
  total_staked DECIMAL(10,2),
  total_returned DECIMAL(10,2),
  net_profit DECIMAL(10,2),
  roi DECIMAL(6,2),
  wins INTEGER,
  losses INTEGER,
  pending INTEGER,
  win_rate DECIMAL(5,2),
  racing_profit DECIMAL(10,2),
  basketball_profit DECIMAL(10,2),
  afl_profit DECIMAL(10,2),
  straight_bets_profit DECIMAL(10,2),
  exotic_bets_profit DECIMAL(10,2),
  ai_followed_profit DECIMAL(10,2),
  ai_ignored_profit DECIMAL(10,2),
  current_streak INTEGER,
  longest_win_streak INTEGER,
  longest_loss_streak INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date, period_type)
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_event ON bets(event_type, event_id);
CREATE INDEX idx_bets_status ON bets(status);
```

#### 4.1.6 AI Chat History

```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  context_type VARCHAR(50),
  context_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_messages_conversation ON ai_messages(conversation_id);
```

### 4.2 Redis Cache Structure

```
# Prediction caching (30min TTL)
predictions:race:{race_id}                 → JSON
predictions:nba_game:{game_id}             → JSON
predictions:afl_game:{game_id}             → JSON

# Odds updates
odds:race:{race_id}                        → HASH {horse_id: {win, place}}
odds:last_update:{race_id}                 → STRING (timestamp)

# User sessions
session:{session_id}                       → JSON {user_id, expires_at}

# Rate limiting
rate_limit:api:{user_id}:{endpoint}        → STRING (counter)

# AI chat context (5min TTL)
ai:context:{user_id}                       → JSON

# Job queues (BullMQ)
bull:data-sync:*
bull:prediction-generation:*
bull:notification:*
```

### 4.3 Data Sync Schedule

```javascript
const SYNC_CONFIG = {
  timezone: 'Australia/Sydney',
  activeDays: [3, 4, 5, 6, 0], // Wed-Sun
  startHour: 12,
  endHour: 19,
  intervalMinutes: 30,
  
  sources: {
    racing: {
      endpoint: 'racing.com/api',
      priority: 1,
      timeout: 15000
    },
    nba: {
      endpoint: 'stats.nba.com/api',
      priority: 2,
      timeout: 10000
    },
    afl: {
      endpoint: 'afl.com.au/api',
      priority: 3,
      timeout: 10000
    }
  }
}
```

---

## 5. Functional Requirements

### 5.1 User Authentication & Profile (FR-001)

#### FR-001.1: User Registration
- **Description**: Users can create an account with email and password
- **Acceptance Criteria**:
  - Email validation (format, uniqueness)
  - Password requirements: min 8 chars, 1 uppercase, 1 number
  - Username uniqueness check
  - Set starting bankroll during registration
  - Select preferred sports (defaults to racing)

#### FR-001.2: User Login
- **Description**: Users can log in with email/username and password
- **Acceptance Criteria**:
  - Accept both email and username
  - JWT token generated on success (expires 30 days)
  - Refresh token for extended sessions
  - "Remember me" option
  - Failed login attempts tracked (max 5, then 15min lockout)

#### FR-001.3: Biometric Authentication (Mobile Only)
- **Description**: Users can enable Face ID / Touch ID
- **Acceptance Criteria**:
  - Opt-in during onboarding or in settings
  - Falls back to password if biometric fails
  - Secure storage of biometric preference

#### FR-001.4: Profile Management
- **Description**: Users can view and edit their profile
- **Acceptance Criteria**:
  - Edit: full name, avatar, preferred sports, timezone
  - View: total bets, win rate, ROI, current bankroll
  - Logout functionality

### 5.2 Bankroll Management (FR-002)

#### FR-002.1: Bankroll Setup
- **Description**: Users set their starting bankroll during onboarding
- **Acceptance Criteria**:
  - Input field with currency formatting
  - Minimum: $50, Maximum: $999,999
  - Option to adjust later in settings
  - Clear explanation: "This doesn't connect to your bookmaker"

#### FR-002.2: Bankroll Tracking
- **Description**: System tracks bankroll changes based on logged bets
- **Acceptance Criteria**:
  - Real-time balance updates when bets settle
  - History of all changes
  - Visualize balance over time (line chart)
  - Warning if balance drops below 20% of starting

#### FR-002.3: Bet Sizing Recommendations
- **Description**: System suggests bet sizes using Kelly Criterion
- **Acceptance Criteria**:
  - Calculate based on: bankroll, odds, win probability, risk preference
  - Display as percentage and dollar amount
  - User can override (with warning if too high)
  - Three risk levels: Conservative, Moderate, Aggressive

#### FR-002.4: Manual Adjustments
- **Description**: Users can manually adjust bankroll
- **Acceptance Criteria**:
  - "Add Funds" and "Withdraw Funds" buttons
  - Reason required (dropdown: deposit, withdrawal, correction)
  - Confirmation dialog
  - Recorded in history

### 5.3 Racing Predictions (FR-003)

#### FR-003.1: Daily Racing Feed (Hero Page)
- **Description**: Default page shows today's races, sorted by time
- **Acceptance Criteria**:
  - Card-based layout
  - Each card shows: venue, race number, time, top 3 picks, value rating
  - Filter by venue
  - "Past Races" toggle
  - Auto-refresh every 30min
  - Pull-to-refresh on mobile

#### FR-003.2: Race Detail View
- **Description**: Drill down into a specific race
- **Acceptance Criteria**:
  - Full race card (all horses)
  - Detailed stats for each horse (progressive disclosure)
  - Sort by: AI ranking, barrier, odds, horse name
  - Visual indicators for top picks, value bets, scratched horses
  - Track condition, rail position, prize money displayed

#### FR-003.3: Horse Detail Modal
- **Description**: Tap a horse to see comprehensive details
- **Acceptance Criteria**:
  - Win/place/show probabilities
  - Form guide (last 5 runs)
  - Career stats
  - Jockey/trainer combo stats
  - Track/distance record
  - "Why this pick?" AI explanation button
  - Add to exotic bet builder

#### FR-003.4: Value Bet Identification
- **Description**: System highlights horses with positive expected value
- **Acceptance Criteria**:
  - Compare predicted win probability to bookmaker odds
  - Highlight if EV > 10% (high value), 5-10% (medium)
  - Display fair odds vs actual odds
  - Value rating visible in lists

#### FR-003.5: Exotic Bet Builder
- **Description**: Users can build and analyze exotic bets
- **Acceptance Criteria**:
  - Bet types: Exacta, Trifecta, First 4, Quinella
  - Three modes: Box, Banker, Roving Banker
  - Interactive selection: tap horses to add/remove
  - Live cost calculator
  - Display: combinations, cost per $1, total cost
  - **Note**: User CANNOT place bet, only calculate
  - "Copy to clipboard" button

#### FR-003.6: AI Exotic Recommendations
- **Description**: System suggests strategic exotic bets
- **Acceptance Criteria**:
  - Display 1-3 suggestions per race (if value exists)
  - Show: bet type, strategy, cost, estimated ROI, risk level
  - Reasoning text
  - User can: accept, modify, dismiss

### 5.4 Basketball Predictions (FR-004)

#### FR-004.1: Daily Basketball Feed
- **Description**: Tab shows today's NBA/NBL games
- **Acceptance Criteria**:
  - Card-based layout
  - Filter by league (NBA, NBL)
  - Sort by: time, win probability, value rating

#### FR-004.2: Game Detail View
- **Description**: Drill down into specific game
- **Acceptance Criteria**:
  - Head-to-head display
  - Predictions: win probability, spread, total points
  - Recommended bets (if value exists)
  - Recent form, key injuries, venue info

#### FR-004.3: Player Props
- **Description**: View predictions for individual player stats
- **Acceptance Criteria**:
  - Stats: points, rebounds, assists, 3-pointers
  - Over/under lines with probability
  - Season averages for context
  - Filter by: all players, starters only

### 5.5 AFL Predictions (FR-005)

#### FR-005.1: Daily AFL Feed
- **Description**: Tab shows this week's AFL games
- **Acceptance Criteria**:
  - Card-based layout
  - Filter by: round, venue
  - Weather icons (if significant impact)

#### FR-005.2: Game Detail View
- **Description**: Drill down into specific game
- **Acceptance Criteria**:
  - Similar to basketball
  - Predictions: win probability, margin, total points
  - Venue advantage, weather impact
  - Team form

#### FR-005.3: Player Props
- **Description**: View predictions for AFL player stats
- **Acceptance Criteria**:
  - Stats: disposals, kicks, marks, goals, tackles
  - Over/under lines with probability
  - Season averages

### 5.6 AI Chat Assistant (FR-006)

#### FR-006.1: Floating Chat Interface
- **Description**: Persistent chat bubble accessible on all screens
- **Acceptance Criteria**:
  - Bottom-right corner
  - Opens overlay without leaving current page
  - Context-aware: knows which race/game user is viewing
  - Minimizes to bubble

#### FR-006.2: Natural Language Queries
- **Description**: Users can ask questions in plain English
- **Acceptance Criteria**:
  - Example queries supported
  - Streaming response (token by token)
  - "Thinking..." indicator

#### FR-006.3: Contextual Explanations
- **Description**: AI provides reasoning for predictions
- **Acceptance Criteria**:
  - Access to current prediction data
  - Explain: probabilities, value ratings, exotic suggestions
  - Natural, conversational tone

#### FR-006.4: Conversation History
- **Description**: Chat maintains context within session
- **Acceptance Criteria**:
  - Remember previous messages
  - Clear conversation button
  - History persists within session

#### FR-006.5: Quick Actions
- **Description**: AI can trigger app actions
- **Acceptance Criteria**:
  - "Show me this race" → navigate
  - "Add to my bets" → open bet tracking
  - "Calculate trifecta" → open builder

### 5.7 Bet Tracking (FR-007)

#### FR-007.1: Manual Bet Logging
- **Description**: Users manually log bets they've placed
- **Acceptance Criteria**:
  - Form fields: event, bet type, selection, odds, stake
  - For exotic bets: specify combination
  - Optional: notes field
  - Save as pending or completed

#### FR-007.2: Bet List View
- **Description**: View all logged bets
- **Acceptance Criteria**:
  - Filter by: status, sport, date range
  - Sort by: date, stake, odds
  - Quick actions: edit, delete, mark as settled

#### FR-007.3: Automatic Settlement
- **Description**: System auto-settles bets when results available
- **Acceptance Criteria**:
  - Check race/game results after completion
  - Match bet selection to result
  - Update bet status, calculate payout
  - Update bankroll, send notification

#### FR-007.4: Manual Settlement
- **Description**: Users can manually settle bets
- **Acceptance Criteria**:
  - For unsupported bet types
  - Input: result, payout amount
  - Confirmation dialog
  - Update bankroll

### 5.8 Performance Analytics (FR-008)

#### FR-008.1: Dashboard Overview
- **Description**: High-level stats visible on dashboard
- **Acceptance Criteria**:
  - Cards showing: today's P&L, this week, all-time, win rate, streak
  - Color-coded: green (profit), red (loss), gray (neutral)
  - Trend indicators

#### FR-008.2: Detailed Analytics Page
- **Description**: Comprehensive performance breakdown
- **Acceptance Criteria**:
  - Time period selector: 7d, 30d, 90d, all-time
  - Charts: bankroll over time, P&L by sport, win rate trend
  - Stats breakdown: total bets, staked, returned, ROI
  - Best/worst bets, streaks

#### FR-008.3: AI Comparison
- **Description**: Compare user's picks vs AI recommendations
- **Acceptance Criteria**:
  - Separate tracking for: AI followed vs AI ignored
  - Side-by-side comparison: win rate, ROI, profit
  - Insight text

#### FR-008.4: Export Reports
- **Description**: Users can download performance reports
- **Acceptance Criteria**:
  - Formats: CSV, PDF
  - Contents: bet list, summary stats, charts (PDF)
  - Date range selector

### 5.9 Notifications (FR-009)

#### FR-009.1: Push Notifications (Mobile)
- **Description**: App sends push notifications for key events
- **Acceptance Criteria**:
  - Types: race starting soon, bet settled, odds change, scratched, value opportunity
  - Settings: toggle each type, quiet hours
  - Deep links to relevant page

#### FR-009.2: In-App Notifications
- **Description**: Bell icon shows unread notifications
- **Acceptance Criteria**:
  - Badge count
  - List view with timestamp
  - Mark as read, clear all

### 5.10 Onboarding (FR-010)

#### FR-010.1: Welcome Flow
- **Description**: Educational onboarding for new users
- **Acceptance Criteria**:
  - 5 screens: welcome, bankroll, sports, tutorial, sample walkthrough
  - "Skip" button after screen 2
  - Never show again after completion

#### FR-010.2: Feature Discovery
- **Description**: Tooltips and coach marks for first-time actions
- **Acceptance Criteria**:
  - Show once per feature
  - Dismissible
  - "Don't show tips again" in settings

### 5.11 Settings (FR-011)

#### FR-011.1: Account Settings
- **Description**: Manage account details
- **Acceptance Criteria**:
  - Edit: name, avatar, email, password
  - View: account created date, last login
  - Danger zone: delete account

#### FR-011.2: Preferences
- **Description**: Customize app behavior
- **Acceptance Criteria**:
  - Preferred sports, default view, timezone
  - Notification settings per type
  - Risk preference
  - Currency format

#### FR-011.3: Appearance
- **Description**: Visual customization
- **Acceptance Criteria**:
  - Theme: Auto, Light, Dark
  - Colorblind mode

#### FR-011.4: Data Management
- **Description**: Control over user data
- **Acceptance Criteria**:
  - Export all data
  - Clear cache
  - Delete bet history
  - Reset bankroll

---

*End of Part 1. See Part 2 for API Specifications, Security, Deployment, and more.*
