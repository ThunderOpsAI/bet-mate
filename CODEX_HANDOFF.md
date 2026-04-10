# BetMate — Codex Handoff (8 Apr 2026)

## Update — 10 Apr 2026 (Production Stability + Daily Race Scope)

### What was done today

- Ran full browser E2E checks with Playwright against key web routes and reproduced runtime issues.
- Fixed an AFL UI runtime crash where `squiggle_confidence` could be a string:
  - `apps/web/app/afl/page.tsx`
  - Added numeric coercion/guarding before `.toFixed()`.
- Implemented date-scoped racing fetch so weekday cards do not load Saturday races:
  - `services/prediction-engine/app/data/scraper.py`
  - `fetch_today_races(run_date=...)` now scopes to a Melbourne date.
  - Betfair query now includes `marketStartTime` `from/to` UTC bounds for the target Melbourne day.
  - Final race list is filtered to the target `meeting_date`.
- Adjusted race filtering to keep non-allowlisted venues (not just metro allowlist meetings):
  - Known venues still get metro metadata from allowlist.
  - Unknown venues are retained so daily cards include broader race coverage.
- Wired strategy racing candidates to the strategy run date:
  - `services/prediction-engine/app/strategy.py`
  - `_racing_candidates(run_date)` now calls `fetch_today_races(run_date=run_date)`.
- Extended racing endpoint date support:
  - `GET /api/races/today?date=YYYY-MM-DD`
  - Invalid date returns HTTP 400.

### Test verification completed

- `services/prediction-engine/tests/test_racing_scraper.py` → **6 passed**
- `services/prediction-engine/tests/test_api.py` → **27 passed**
- `services/prediction-engine/tests/test_strategy.py` → **3 passed**

### v1.5 leftovers (still open)

- `allow_multis` / `max_multi_legs` are present in rule sets but not yet integrated into card allocation (multi candidate builder exists but is not used in final selection path).
- AFL/NBA candidate collection is still “current window” based, not strictly `run_date` scoped like Racing.
- Nightly strategy cycle exists (`app/nightly.py`) and is tested, but production scheduling/orchestration is still an ops task.

## What This App Is
BetMate is an ML-powered sports prediction platform. It uses XGBoost models to generate win probabilities for Racing, AFL, and NBA, served via a FastAPI backend and rendered in a premium Next.js dashboard.

---

## What Was Built Today

### Backend — `services/prediction-engine/` (Python, FastAPI, port 8000)

**3 XGBoost ML models** trained on synthetic data at startup, serving predictions via REST:

| Model | File | Features Used |
|-------|------|--------------|
| Racing | `app/ml/racing.py` | barrier, weight, past_win_rate, jockey_win_rate, track_condition, days_since_last_race |
| AFL | `app/ml/afl.py` | home/away win_streak, avg_points_for/against, rest_days, weather, travel_distance |
| NBA | `app/ml/nba.py` | home/away b2b, win_pct, ORTG, DRTG, injuries_impact |

**3 live API data scrapers:**

| Scraper | File | API | Auth |
|---------|------|-----|------|
| Racing | `app/data/scraper.py` | Betfair Exchange AU | Session token via `.env` (BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD) |
| AFL | `app/data/afl_scraper.py` | Squiggle (api.squiggle.com.au) | None (public). User-Agent: `BetMate - james.jones2086@gmail.com` |
| NBA | `app/data/nba_scraper.py` | Ball Don't Lie (api.balldontlie.io) | API key via `.env` (BDL_API_KEY) |

All scrapers **gracefully fall back to mock data** if credentials are missing or APIs are down.

**API endpoints:**

```
GET  /health                    → Status check
GET  /api/races/today           → Fetch live racing fields from Betfair
POST /api/predict/racing        → Predict win probabilities for a race
GET  /api/afl/games/upcoming    → Fetch AFL games from Squiggle
POST /api/predict/afl           → Predict AFL game outcome
GET  /api/nba/games/today       → Fetch NBA games from Ball Don't Lie
POST /api/predict/nba           → Predict NBA game outcome
```

**CORS** is configured to allow `http://localhost:3000` and `http://127.0.0.1:3000`.

**Credentials** are in `services/prediction-engine/.env` (gitignored). Contains Betfair login and BDL API key.

### Frontend — `apps/web/` (Next.js, port 3000)

- **Dashboard** (`app/page.tsx`) — Overview with stat cards (races, AFL games, NBA games, models), top prediction cards for each sport
- **Racing** (`app/racing/page.tsx`) — Venue filter tabs, expandable race cards with full field tables, feature importance bars, AI insights
- **AFL** (`app/afl/page.tsx`) — Matchup cards with home/away probability bars, fair odds, weather/rest/travel context
- **NBA** (`app/nba/page.tsx`) — Matchup cards with ORTG/DRTG badges, B2B status, probability visualization
- **CSS** (`app/globals.css`) — 700+ lines of premium dark-mode styling with glassmorphism, gradients, animations

Auth has been **bypassed** (AppShell renders children directly, no AuthProvider in layout) to allow ML dashboard access without login.

---

## Current State — What Works Right Now

| Feature | Status |
|---------|--------|
| Betfair live racing data (30+ races from AU venues) | ✅ Working |
| Squiggle live AFL data (Round 5 fixtures with real teams) | ✅ Working |
| Ball Don't Lie NBA data | ✅ Key added, should be live |
| XGBoost predictions for all 3 sports | ✅ Working |
| CORS between frontend and backend | ✅ Fixed |
| Dashboard rendering all prediction cards | ✅ Working |
| Feature importance / explainability | ✅ Working |

---

## What Should Be Next (Priority Order)

### 1. Train Models on Real Historical Data (HIGH)
Right now the XGBoost models are trained on **synthetic/random data** generated at startup. They produce plausible-looking predictions but aren't accurate. Next step:
- **Racing:** Use Betfair historical settlement data or scrape racing results to build a real training dataset. Key features: barrier stats by track, jockey/trainer combos, class ratings, distance preferences.
- **AFL:** Use Squiggle's historical games endpoint (`?q=games;year=2025`) to pull actual results. Build features from real win streaks, scoring averages, home/away splits.
- **NBA:** Use Ball Don't Lie historical games to build real team performance profiles.
- Store trained models to disk (currently saved as `.pkl` but re-trained on each startup).

### 2. Incorporate Squiggle Tips as an Ensemble Signal (HIGH)
Squiggle already aggregates predictions from multiple computer models. The `afl_scraper.py` fetches these as `squiggle_tip` and `squiggle_confidence` but they're **not yet fed into the ML model**. They could be used as:
- A feature input to XGBoost (the aggregate confidence score)
- A comparison/validation against our own predictions
- Displayed in the UI as "market consensus"

### 3. Betfair Implied Probabilities as Features (HIGH)
The racing scraper already fetches `betfair_back_price` and `betfair_implied_prob` for each horse but these are **not yet used as XGBoost features**. Market-implied probabilities are extremely strong signals. Wire them into the racing model.

### 4. Live Score Tracking via Squiggle SSE (MEDIUM)
Squiggle has a Server-Sent Events API at `https://sse.squiggle.com.au/games` for real-time score updates. Could add a WebSocket/SSE bridge to show live scores on the dashboard during games.

### 5. Analytics Page (MEDIUM)
There's an empty Analytics tab in the sidebar. Could display:
- Model accuracy tracking (predicted vs actual over time)
- Feature importance trends
- ROI tracking if users log their bets

### 6. Data Persistence (MEDIUM)
Currently everything is in-memory. Adding a SQLite or PostgreSQL database would allow:
- Historical predictions storage
- Result tracking and model accuracy measurement
- User bet logging

### 7. AI Chat Integration (LOW)
The monorepo has an `ai-service` directory. Could connect to Anthropic/OpenAI to provide natural language explanations of predictions using the `feature_impact` data already returned by all endpoints.

### 8. Deployment (LOW)
- Backend could deploy to Railway/Fly.io
- Frontend to Vercel
- Would need to handle CORS for production domains

---

## How to Run Locally

```bash
# Terminal 1 — ML Engine
cd services/prediction-engine
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Dashboard
cd apps/web
pnpm install
pnpm dev
```

Open http://localhost:3000

---

## Key Files Quick Reference

```
services/prediction-engine/
├── .env                          # Betfair + BDL credentials (gitignored)
├── requirements.txt              # fastapi, xgboost, scikit-learn, requests, etc
├── app/
│   ├── main.py                   # FastAPI app, CORS, all endpoints
│   ├── ml/
│   │   ├── racing.py             # XGBoost racing predictor
│   │   ├── afl.py                # XGBoost AFL predictor
│   │   └── nba.py                # XGBoost NBA predictor
│   └── data/
│       ├── scraper.py            # Betfair Exchange AU integration
│       ├── afl_scraper.py        # Squiggle API integration
│       └── nba_scraper.py        # Ball Don't Lie API integration

apps/web/app/
├── page.tsx                      # Main dashboard
├── racing/page.tsx               # Racing predictions page
├── afl/page.tsx                  # AFL predictions page
├── nba/page.tsx                  # NBA predictions page
├── globals.css                   # All premium styling
├── layout.tsx                    # Root layout (no auth)
└── components/
    ├── AppShell.tsx               # Shell with ML Engine badge
    └── Sidebar.tsx                # Navigation sidebar
```
