# Data Sources Audit & Integration Proposal

**BetMate Prediction Engine & API**  
**Date:** October 2026  
**Status:** PROPOSAL ONLY (Awaiting Written Approval)

---

## 1. Summary Table

| Source | Sport | Status | Key Needed | Rate Limit / Quota | License / Terms | Seasons Covered | Primary Data Types |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BallDontLie** | NBA | ⚠️ Config Missing in repo | Yes (`BALLDONTLIE_API_KEY` / tier dependent) | Free tier: 30 req/min; Paid: higher | Commercial / Proprietary API TOS | 1946–present | Player game logs, team stats, box scores, schedules, injuries |
| **Betfair Exchange API** | AU Racing & Sports | ✅ Working (via `api.betfair.com.au`) | Yes (AU App Key, Cert PEM, Key PEM) | 5 req/sec (non-heavy), delayed stream limits | Proprietary Betfair Developer TOS | Live / Upcoming (~24-48 hrs forward) | Exchange market catalogue, back/lay prices, volume, traded runners |
| **nba_api** (swar/nba_api) | NBA | ❌ Broken / Blocked (from AU IP) | No | Akamai bot-defense / strict rate limits (~1 req/3s) | MIT License | 1946–present (when reachable) | Player & team box scores, shot charts, advanced lineups |
| **nflreadpy** (nflverse) | NFL | ✅ Working (Fast & Stable) | No | GitHub releases / parquet cache (fair use) | MIT License | 1999–present (schedules from 1920) | PBP, weekly player stats, rosters, snap counts, depth charts, injuries, lines |
| **Squiggle API** | AFL | ✅ Working | No | Friendly/Fair use (User-Agent requested) | CC BY-NC 4.0 / Public Sports Data | 1897–present | Fixtures, live scores, computer model tips, margins, simulated odds |
| **AFL Tables** | AFL | ✅ Working (HTML) | No | Polite scraping (1 req/sec) | Non-commercial research / attribution | 1897–present | Detailed player match logs, Brownlow votes, attendance, team totals |
| **Footywire** | AFL | ❌ Blocked (Cloudflare Turnstile) | No | Cloudflare Turnstile CAPTCHA (HTTP 503) | Proprietary Web TOS | 1965–present (behind CAPTCHA) | Fantasy scores, advanced disposals, player match-ups |
| **soccerdata / FBref** | Soccer | ❌ Broken / Blocked (Cloudflare CAPTCHA) | No | FBref rate limits (20 req/min) + Cloudflare CAPTCHA | GNU GPLv3 / FBref TOS | 1888–present (behind CAPTCHA) | Detailed xG, shot creation, progressive passes, player match logs |
| **soccerdata / MatchHistory** | Soccer | ✅ Working | No | Polite downloading | Football-Data.co.uk free usage | 1993–present | Match results, basic shots/fouls/corners, closing match odds (bet365, etc.) |
| **NRL.com Match-Centre** | NRL | ✅ Working | No | Public JSON API (~2 req/sec fair use) | NRL Digital Media TOS | 2018–present (Draw & Match Centre) | Live & historical draw, player stats (metres, tackles, kicks, errors), ground conditions, referee appointments |
| **Rugby League Project** | NRL | ✅ Working (HTML) | No | Polite scraping (1 req/sec) | CC / Open Historical Archive | 1908–present | Career player logs, historical club head-to-heads, coaching records |
| **ESPN Public API** | NBA, NFL, Soccer | ✅ Working | No | CDN cached / fair use | Public ESPN Developer CDN | Current & recent seasons | Official injury reports (designation, notes, return timeline), live scoreboards |
| **Betfair SP & Historical Hub** | AU & UK Racing | ✅ Working | Partial (Free CSVs on hub; bulk files via login) | Daily archives download | Betfair Community TOS | 2016–present | Official Betfair SP, pre-race vs actual traded prices, volume, place prices |

---

## 2. Source-by-Source Verification & Research

### 2.1 BallDontLie (NBA)
- **Repository / Service:** BallDontLie API ([balldontlie.io](https://balldontlie.io))
- **Key Verification:** Checked `services/prediction-engine/.env`, `apps/api/.env`, and `.env`.
  - Result: No BallDontLie API key or environment variable exists in any `.env` file across the repository.
- **Gotchas & Availability:**
  - In 2024, BallDontLie transitioned from a completely unauthenticated free API to requiring an API key (`Authorization: <api_key>`).
  - The free tier provides 30 requests per minute with access to `/v1/players`, `/v1/teams`, `/v1/games`, and `/v1/stats`. Advanced endpoints (e.g., live play-by-play, active injuries, boxscores) require the `GOAT` / paid tiers ($4.99–$29.99/mo).

---

### 2.2 Betfair Exchange (AU Sports & Racing)
- **Status:** ✅ Fully authenticated and functional via client SSL certificate.
- **Verification Details:**
  - Credentials in `services/prediction-engine/.env` verified: `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD`, `BETFAIR_CERT_PEM_B64`, `BETFAIR_KEY_PEM_B64`.
  - Auth Mode: `certificate`.
  - Live Certificate Login: Succeeded on `https://identitysso-cert.betfair.com/api/certlogin`.
  - Keepalive: Responded HTTP 200.
  - Endpoint Insight: Global routing `https://api.betfair.com` responds with HTTP 403 (Cloudflare geo/origin protection on direct HTTP client requests), but routing to the Australian regional exchange endpoint **`https://api.betfair.com.au/exchange/betting/rest/v1.0/`** connects cleanly with HTTP 200.
- **Reachable AU Markets:**
  - Event types active: 21 categories (Soccer: 13,924 markets, Tennis: 3,693, Greyhound Racing: 791, Horse Racing: 713, Basketball: 341, Cricket: 303, American Football: 280, Australian Rules: 21, Rugby League: 2).
  - Australian Market Samples: Australian Rules (AFLW / AFL Futures), Australian NBL (Outright / Match Winner), AU Horse Racing (Kilmore, Canterbury, etc. Win/Place), AU Greyhounds (Casino, Richmond).
- **Working Snippet:**
```python
import os, requests
from app.data.scraper import _get_api_headers

headers = _get_api_headers()
headers["User-Agent"] = "BetMate/1.0"

# Note: Always query api.betfair.com.au for AU servers
url = "https://api.betfair.com.au/exchange/betting/rest/v1.0/listMarketCatalogue/"
payload = {
    "filter": {"eventTypeIds": ["7", "61420"], "marketCountries": ["AU"]},
    "maxResults": "5",
    "marketProjection": ["EVENT", "RUNNER_DESCRIPTION"]
}
res = requests.post(url, json=payload, headers=headers, timeout=10)
markets = res.json()
```
- **Sample Fields:** `marketId`, `marketName`, `totalMatched`, `runners` (`selectionId`, `runnerName`, `handicap`, `sortPriority`).

---

### 2.3 NBA — `swar/nba_api`
- **GitHub Status:** [swar/nba_api](https://github.com/swar/nba_api)
  - Not archived. Last commit: August 2026. Latest release: `v1.11.4` (Feb 2026). License: MIT.
- **Live Test Result:** ❌ **BLOCKED / ReadTimeout**.
  - Requests to `stats.nba.com/stats/*` time out consistently (15s to 30s) or respond with 403 Access Denied from Akamai bot-defense when called from standard cloud and Australian residential IPs.
  - The live scoreboard endpoint (`cdn.nba.com/static/json/liveData/scoreboard/...`) returns HTTP 403 Access Denied.
- **Product Implication & Solution:** Direct live calls to `stats.nba.com` cannot be used in a production container/Modal pipeline without rotating US residential proxies. Instead, NBA fixtures, scores, team stats, and injury updates should be fetched via the ESPN public API (Section 2.7), which is fast and completely free of IP blocks.

---

### 2.4 NFL — `nflverse` (`nflreadpy`)
- **Library Check:**
  - `nfl_data_py` is **ARCHIVED** (`isArchived: true`, archived in Sept 2025).
  - Successor is **`nflreadpy`** (`nflverse/nflreadpy`): Active, MIT License, latest release `v0.1.5` (Nov 2025), commits in Oct 2026.
- **Install & Live Call:** ✅ Succeeded in 1.16s!
- **Data Sets Offered:**
  - `load_schedules()` (1920–present): Game dates, kickoff times, home/away rest days, spread lines, over/under lines, moneyline, stadium info, referee, weather.
  - `load_player_stats()` (1999–present): 18,600+ player-week records per season with passes, completions, rush/rec yards, air yards, EPA, fantasy points.
  - `load_injuries()`: Practice status, injury designation (Questionable, Out, IR).
  - `load_snap_counts()`, `load_depth_charts()`, `load_nextgen_stats()`, `load_pbp()`.
- **Minimal Working Snippet:**
```python
import nflreadpy as nfl

# Load schedule & closing lines
sched = nfl.load_schedules([2024])

# Load weekly player box scores
player_stats = nfl.load_player_stats([2024])
```
- **Sample Fields:** `game_id`, `away_team`, `home_team`, `spread_line`, `total_line`, `away_moneyline`, `home_moneyline`, `completions`, `attempts`, `passing_yards`, `rushing_yards`, `receptions`.

---

### 2.5 AFL — Squiggle API, AFL Tables & Footywire
- **Squiggle API (`https://api.squiggle.com.au`):**
  - Status: ✅ Succeeded in 0.55s. No auth key required.
  - Endpoints: `?q=games;year=2024`, `?q=teams`, `?q=standings`, `?q=tips`, `?q=ladder`.
  - Rate limits: Generous, requests proper `User-Agent`.
  - Fields: `hscore`, `ascore`, `hgoals`, `agoals`, `hbehinds`, `abehinds`, `venue`, `round`, `date`, `winner`, `is_final`. Tips endpoint provides aggregate margin predictions and model confidence percentages.
- **AFL Tables (`https://afltables.com`):**
  - Status: ✅ Succeeded in 0.92s. Static HTML pages easily parsable with `BeautifulSoup` or `lxml`.
  - Historical coverage: Complete historical stats from 1897 to present.
  - Fields: Detailed player game logs (Kicks, Handballs, Disposals, Marks, Goals, Behinds, Hitouts, Tackles, Rebounds, Inside 50s, Clearances, Clangers, Free Kicks, Brownlow votes).
- **Footywire (`https://www.footywire.com`):**
  - Status: ❌ Blocked by Cloudflare Turnstile CAPTCHA (HTTP 503).
  - Unsuitable for serverless/Modal automated headless pipelines.
- **Minimal Working Snippet (Squiggle):**
```python
import requests

headers = {"User-Agent": "BetMate/1.0 (prediction-engine)"}
resp = requests.get("https://api.squiggle.com.au/?q=games;year=2024", headers=headers, timeout=10)
games = resp.json()["games"]
```

---

### 2.6 Soccer — `soccerdata` / FBref & Football-Data
- **FBref Scraper:**
  - Status: ❌ Blocked by Cloudflare Bot Management & CAPTCHAs. Automated execution triggers `Exception: CAPTCHA detected and could not be solved` or hangs indefinite browser sessions.
  - Scraping FBref at scale without residential proxy pools violates FBref terms and fails in automated headless environments.
- **ClubElo (`api.clubelo.com`):**
  - Status: ⚠️ Flaky (currently responding with HTTP 502 Bad Gateway).
- **MatchHistory (`Football-Data.co.uk` via `soccerdata.MatchHistory`):**
  - Status: ✅ Succeeded in 4.40s.
  - Coverage: 30+ European soccer leagues, 1993–present.
  - Fields: `date`, `home_team`, `away_team`, `FTHG` (full time home goals), `FTAG`, `FTR` (result), `HTHG`, `HTAG`, `HTR`, `referee`, `HS` (home shots), `AS`, `HST` (shots on target), `AST`, `HC` (corners), `AC`, `HF` (fouls), `AF`, plus opening/closing market odds (`B365H`, `B365D`, `B365A`).
- **Minimal Working Snippet:**
```python
import soccerdata as sd

# Fast, unblocked CSV match data with historical odds
mh = sd.MatchHistory(leagues=["ENG-Premier League"], seasons=["2023-2024"])
games_df = mh.read_games()
```

---

### 2.7 NRL — NRL.com Match Centre & Rugby League Project
- **NRL.com Match-Centre JSON API:**
  - Status: ✅ Succeeded in 0.40s. Clean, public JSON endpoints powering the NRL official site.
  - Fixtures Endpoint: `https://www.nrl.com/draw/data?competition=111&season={year}&round={round}`
  - Match Centre Endpoint: `https://www.nrl.com/draw/nrl-premiership/{year}/round-{round}/{home}-v-{away}/data`
  - Coverage: All NRL premiership matches (2018–present with full telemetry).
  - Fields: Team lineups, interchange, match clock, `groundConditions`, referee appointments, and comprehensive player game stats (`allRunMetres`, `allRuns`, `bombKicks`, `conversions`, `dummyHalfRuns`, `tackles`, `missedTackles`, `offloads`, `errors`, `tryAssists`, `tries`).
- **Rugby League Project (`https://www.rugbyleagueproject.org`):**
  - Status: ✅ Succeeded in 0.65s (HTTP 200).
  - Clean HTML tables for all seasons from 1908 to present for long-term historical Elo / team ratings.
- **Minimal Working Snippet:**
```python
import requests

headers = {"User-Agent": "Mozilla/5.0"}
url = "https://www.nrl.com/draw/nrl-premiership/2024/round-1/sea-eagles-v-rabbitohs/data"
res = requests.get(url, headers=headers, timeout=10)
match_data = res.json()
player_stats = match_data["stats"]["players"]
```

---

### 2.8 Injuries & Schedules — ESPN Public Endpoints
- **Status:** ✅ Succeeded in 0.25s. Completely free, high-speed CDN, unblocked.
- **Endpoints:**
  - NBA Injuries: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries`
  - NFL Injuries: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries`
  - NBA Scoreboard / Fixtures: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`
  - Soccer Injuries / Scoreboards: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard`
- **Fields:** `athlete.displayName`, `status` ("Day-To-Day", "Questionable", "Out"), `type.description`, `details.detail` (injury body part/nature), `details.returnDate`.
- **Minimal Working Snippet:**
```python
import requests

res = requests.get("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries", timeout=5)
for team in res.json().get("injuries", []):
    for inj in team.get("injuries", []):
        print(inj["athlete"]["displayName"], inj["status"], inj["details"]["detail"])
```

---

### 2.9 Racing — Betfair Historical Data & Data Scientists Hub
- **Betfair Data Scientists Hub:**
  - URL: [betfair-datascientists.github.io](https://betfair-datascientists.github.io)
  - Resources: Direct access to Betfair SP prices and Brownlow/Datathon repositories.
- **Betfair SP Archives:**
  - Daily/yearly CSV archives with Betfair Starting Price (BSP), pre-play maximum/minimum prices, in-play odds, and morning traded volume.
  - Unauthenticated, free downloads suitable for backtesting AU thoroughbred, harness, and greyhound models.
- **Betfair Historical Exchange (`historicdata.betfair.com`):**
  - Requires active Betfair login credentials to download bulk JSON/TAR tick data.

---

## 3. Sport × Data Type Coverage Matrix

| Sport | Player Logs | Team Stats | Injuries | Lineups | Fixtures | Odds / Lines | Primary Recommended Source |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **AFL** | ✅ Full | ✅ Full | ⚠️ Partial | ✅ Full | ✅ Full | ⚠️ Partial | Squiggle (fixtures, tips) + AFL Tables (player logs) |
| **NRL** | ✅ Full | ✅ Full | ⚠️ Partial | ✅ Full | ✅ Full | ❌ None | NRL.com Match Centre JSON + RLP |
| **NFL** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `nflreadpy` (full historical & closing odds) |
| **NBA** | ⚠️ Partial | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ None | ESPN API (live & injuries) + BallDontLie (once key supplied) |
| **Soccer** | ⚠️ Partial | ✅ Full | ⚠️ Partial | ⚠️ Partial | ✅ Full | ✅ Full | Football-Data.co.uk (MatchHistory) |
| **AU Racing** | N/A | N/A | N/A | ✅ Full | ✅ Full | ✅ Full | Betfair AU Live API + Betfair SP Hub |

**Legend:**
- ✅ **Full:** High-fidelity, reliable, structured data freely available without blockers.
- ⚠️ **Partial:** Match-level or basic status available; advanced prop statistics or real-time injury recovery reports require additional parsing or paid provider.
- ❌ **None:** Not provided by tested free endpoints.

---

## 4. Identified Gaps (Requiring Paid Feeds or Dedicated Scraping)

1. **AFL & NRL Player Prop Odds:**
   - Free sources (Squiggle, NRL.com) provide head-to-head match odds and expert tip margins, but **no player prop betting lines** (e.g. Any Time Tryscorer, 25+ Disposals, Player Goals). Betfair AU exchange has very low liquidity on Australian player prop markets compared to match odds. Live player props require a commercial odds aggregator (such as OddsJam, The Odds API paid tiers, or bespoke bookmaker feed).
2. **Detailed Soccer Player Telemetry (xG, Shot-Maps):**
   - FBref and WhoScored are heavily shielded by Cloudflare Turnstile/Akamai. While match scorelines, corners, shots, fouls, and 1X2 odds are free via Football-Data, advanced per-player xG tracking either requires residential proxy infrastructure or a paid StatsBomb/Opta/Sportmonks feed.
3. **NBA Official Box Scores without Proxy:**
   - `stats.nba.com` blocks data centers and overseas IPs. A reliable fallback requires either obtaining a BallDontLie paid key or routing NBA stats requests through a proxy pool.

---

## 5. PROPOSAL ONLY: Architecture & Integration Plan (Phase 0)

> [!IMPORTANT]
> **PROPOSAL ONLY:** The following design outlines how the verified data sources will plug into the BetMate prediction engine and database. In accordance with monorepo rules, no ingestion pipelines, schema changes, or background jobs will be executed without your explicit written approval.

### 5.1 Proposed Prediction Engine Ingestion Modules (`services/prediction-engine/app/data/`)

```
services/prediction-engine/app/data/
├── afl_squiggle.py        # Ingests AFL fixtures, team results, and consensus margin tips
├── afl_tables.py          # Scrapes AFL Tables for player match logs & Brownlow voting
├── nrl_client.py          # Fetches NRL.com Draw & Match Centre JSON telemetry
├── nfl_loader.py          # Ingests weekly rosters, player stats, and odds via nflreadpy
├── espn_client.py         # Ingests NBA/NFL injury status reports and live scoreboards
└── betfair_au_client.py   # Regional Betfair client tuned for api.betfair.com.au
```

### 5.2 Proposed Prisma Schema Extensions (`packages/prisma/schema.prisma`)

To store historical training and daily inference inputs without synthetic data fallbacks:

```prisma
// Example structural proposal
model Fixture {
  id            String    @id @default(cuid())
  sport         String    // 'AFL', 'NRL', 'NFL', 'NBA', 'SOCCER', 'RACING'
  externalId    String    @unique
  homeTeam      String
  awayTeam      String
  startTime     DateTime
  venue         String?
  status        String    // 'SCHEDULED', 'IN_PLAY', 'FINAL'
  homeScore     Int?
  awayScore     Int?
  spreadLine    Float?
  totalLine     Float?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  playerLogs    PlayerGameLog[]
  oddsSnapshots OddsSnapshot[]
}

model PlayerGameLog {
  id          String   @id @default(cuid())
  fixtureId   String
  fixture     Fixture  @relation(fields: [fixtureId], references: [id])
  sport       String
  playerId    String
  playerName  String
  team        String
  minutes     Float?
  statsJson   Json     // Dynamic JSON payload specific to sport (disposals, metres, passing_yards, etc.)
  createdAt   DateTime @default(now())
}

model InjuryReport {
  id          String   @id @default(cuid())
  sport       String
  athleteId   String
  athleteName String
  team        String
  status      String   // 'OUT', 'QUESTIONABLE', 'DAY_TO_DAY'
  detail      String?
  updatedAt   DateTime @updatedAt
}
```

### 5.3 Modal Ingestion & Cron Schedule (`services/prediction-engine/modal_app.py`)

- **Morning Lineup & Injury Refresh (08:00 AEST / 22:00 UTC):**
  - Run `espn_client.py` for latest NBA/NFL active injuries.
  - Run `afl_squiggle.py` & `nrl_client.py` for upcoming weekend fixture confirmations and late team changes.
- **Daily Post-Match Ingestion (04:00 AEST):**
  - Ingest completed game stats from NRL Match Centre, AFL Tables, and `nflreadpy` into Postgres to update rolling Elo/form features.
- **Hourly Betfair Odds Snapshot (Game Day):**
  - Poll `api.betfair.com.au` for updated back/lay prices and volume for active race meets and AFL/NRL matches.

### 5.4 Caching Strategy
- **File Cache:** Store downloaded parquet/json files in `/tmp/betmate_cache` or Modal volume storage with 24-hour TTL for historical files.
- **In-Memory Cache:** 60-second TTL for live odds snapshots to strictly respect Betfair's rate limits and prevent duplicate requests.
