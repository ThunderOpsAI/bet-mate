# NFL Sports Data API Options — BetMate Research

> **Research date:** 2026-09-12
> **Branch at research time:** feature/ui-prototype-exploration
> **Note on sources:** Live web search was unavailable during this session. API characteristics are sourced from (a) direct codebase analysis (fully authoritative) and (b) training-knowledge of each provider's documented developer portal (accurate as of mid-2025). Pricing and endpoint availability should be re-verified at each provider's live portal before committing to any integration.

---

## Executive Summary

BetMate already integrates with the **Betfair Exchange API** (certificate auth, Australian endpoint `api.betfair.com.au`) for racing, NRL, AFL, NBA, MMA, Soccer, and Golf. The existing `betfair_sports_odds.py` and sport-specific scrapers establish a clear, reusable pattern. For NFL, the best approach is a two-source architecture mirroring the NBA implementation: a free fixture/stats API for game data + Betfair Exchange for live odds.

| Option | Fixtures | Odds | Historical Stats | AU Access | Cost |
|---|---|---|---|---|---|
| **Betfair Exchange** | ✅ via event type `6423` | ✅ live exchange odds | ❌ | ✅ already configured | Free |
| **The Odds API** | ✅ `americanfootball_nfl` | ✅ 40+ bookmakers | ❌ (paid tier) | ✅ global | Free 500/mo; $79+/mo |
| **ESPN unofficial API** | ✅ fixtures + scores | ⚠️ single book only | ✅ current + historical | ✅ global | Free, no auth |
| **Sportradar NFL** | ✅ | ✅ | ✅ play-by-play | ✅ global | Free trial; $$$+ prod |
| **TAB / Sportsbet** | ❌ no public API | ❌ | ❌ | N/A | N/A |
| **Stats Perform / Opta** | ✅ | ❌ | ✅ | ✅ | Enterprise only |

**Recommended:** ESPN unofficial API (fixtures + results, free) + Betfair Exchange (odds, already integrated), with Sportradar trial for ML training data.

---

## 1. Betfair Exchange API

**Source:** https://developer.betfair.com/exchange-api/

### NFL Coverage

Betfair Exchange offers NFL markets under **Event Type ID `6423`** (American Football). This is the same exchange already used by BetMate for all other sports. The Australian endpoint (`https://api.betfair.com.au`) is operative and the credentials in `.env` are already valid.

Known NFL market types on Betfair Exchange:
- `MATCH_ODDS` / `MATCH_WINNER` — head-to-head moneyline
- `HANDICAP` — point-spread markets
- `CORRECT_SCORE` — final-score markets
- Futures: `OUTRIGHT_WINNER` (Super Bowl winner, conference champions, division winners)

### Data Fields (via `listMarketCatalogue` + `listMarketBook`)

```json
{
  "marketId": "1.12345678",
  "marketStartTime": "2025-09-14T17:00:00.000Z",
  "event": {
    "id": "28901234",
    "name": "Kansas City Chiefs v Baltimore Ravens",
    "openDate": "2025-09-14T17:00:00.000Z",
    "countryCode": "US"
  },
  "runners": [
    { "selectionId": 12345, "runnerName": "Kansas City Chiefs" },
    { "selectionId": 12346, "runnerName": "Baltimore Ravens" }
  ]
}
```

Back/lay prices and order book depth available via `listMarketBook`.

**Does NOT provide:** Team statistics, historical scores, standings, injuries, or player data.

### Australian Access

✅ **Already integrated.** The project uses `https://api.betfair.com.au` with certificate auth (`BETFAIR_AUTH_MODE=certificate`). No new account or credentials required.

### Authentication

Certificate auth via `BETFAIR_CERT_PEM_B64` / `BETFAIR_KEY_PEM_B64` env vars (already set). The `_get_api_headers()` helper in `scraper.py` handles token refresh transparently.

### Pricing

**Free.** Data API access has no subscription cost. Commission applies only on winning bets placed through the exchange.

### Integration Complexity

**Minimal.** Add `"nfl": "6423"` to `SPORT_EVENT_TYPE_IDS` in `betfair_sports_odds.py` (line 14–22). Create `nfl_scraper.py` following the `nrl_scraper.py` pattern verbatim.

### Key Limitation

No historical results → ML model cannot be trained on Betfair data alone. Requires a second source for fixture results and team statistics.

---

## 2. TAB (tab.com.au) and Sportsbet (sportsbet.com.au)

**Sources:** https://www.tab.com.au, https://www.sportsbet.com.au

### Developer API Availability

❌ **Neither exposes a public developer API.**

- **TAB:** Consumer SPA calling undocumented proprietary endpoints. No API key programme. ToS explicitly prohibits scraping.
- **Sportsbet:** Same situation — internal data contract, no developer access, ToS bars scraping.
- Note: **Betfair AU** (betfair.com.au) is a separate entity from TAB/Sportsbet and *does* have a public Exchange API (see Section 1).

### Verdict

🚫 **Do not use.** Legal/ToS risk and brittle integrations with no reliability guarantees.

---

## 3. The Odds API

**Source:** https://the-odds-api.com/liveapi/guides/v4/

### NFL Coverage

✅ **Full NFL support.** Sport key: `americanfootball_nfl`

**Available markets:**
- `h2h` — moneyline (home/away winner)
- `spreads` — point spread
- `totals` — over/under points
- `outrights` — Super Bowl / playoff futures

**Bookmakers aggregated:** 40+ including DraftKings, FanDuel, BetMGM, PointsBet, TAB (AU), bet365, Unibet.

### Response Format

```json
{
  "id": "a3f8c1b2d4e5f6a7",
  "sport_key": "americanfootball_nfl",
  "sport_title": "NFL",
  "commence_time": "2025-09-14T17:00:00Z",
  "home_team": "Baltimore Ravens",
  "away_team": "Kansas City Chiefs",
  "bookmakers": [
    {
      "key": "draftkings",
      "title": "DraftKings",
      "last_update": "2025-09-14T14:32:00Z",
      "markets": [
        {
          "key": "h2h",
          "outcomes": [
            { "name": "Baltimore Ravens", "price": 2.00 },
            { "name": "Kansas City Chiefs", "price": 1.83 }
          ]
        }
      ]
    }
  ]
}
```

Odds are decimal format by default — matches BetMate's existing Betfair convention.

### Pricing Tiers (as of mid-2025 — verify at https://the-odds-api.com/#pricing)

| Tier | Price | Monthly Requests | Key Features |
|---|---|---|---|
| **Free** | $0/mo | 500 | Upcoming odds, h2h only |
| **Starter** | ~$79/mo | 10,000 | Spreads, totals, some historical |
| **Pro** | ~$249/mo | 100,000 | In-play, all markets, historical snapshots |
| **Enterprise** | Custom | Unlimited | SLA, dedicated support |

> ⚠️ Verify current pricing at: https://the-odds-api.com/#pricing

### Authentication

API key in query string:
```
GET https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=YOUR_KEY&regions=us&markets=h2h
```

Response headers include `X-Requests-Remaining` and `X-Requests-Used` for quota tracking.

### Australian Access

✅ **Globally accessible.** No geo-restrictions.

### Free Tier Sufficiency

NFL regular season = 18 weeks × ~16 games = 288 games. Fetching odds once daily during the week of each game ≈ 150–200 requests per season. **Free tier (500/mo) is sufficient for regular season coverage.**

### Verdict

**High value, low risk.** Free tier covers MVP season. Pattern: `requests.get()` with `params` dict — identical to Ball Don't Lie pattern in `nba_scraper.py`.

---

## 4. Sportradar NFL API

**Source:** https://developer.sportradar.com/football/reference/nfl-v7

### NFL Coverage

Sportradar is the **official data partner of the NFL**. Products include:

- **Trial (free):** Developer sandbox, ~5-minute delayed data, 1,000 API calls/month
- **NFL Official Restricted Distribution (ORD):** Real-time play-by-play, push feeds, commercial licence required

### Key Endpoints (Trial)

| Endpoint | Description |
|---|---|
| `/nfl/trial/v7/en/games/{year}/{nfl_week}/schedule.json` | Weekly schedule |
| `/nfl/trial/v7/en/games/{game_id}/boxscore.json` | Box score |
| `/nfl/trial/v7/en/games/{game_id}/pbp.json` | Play-by-play |
| `/nfl/trial/v7/en/seasons/{year}/REG/standings.json` | Standings |
| `/nfl/trial/v7/en/teams/{team_id}/profile.json` | Team roster + stats |

### Data Fields

Per-quarter scores, passing yards, rushing yards, receiving yards, turnovers, penalties, third-down conversion rate, red zone efficiency, sack count, weather conditions.

### Authentication

API key in query string: `?api_key=YOUR_KEY`
New env var needed: `SPORTRADAR_API_KEY`

### Australian Access

✅ **Globally available.** Register at https://developer.sportradar.com

### Pricing

- **Trial:** Free (1,000 calls/month, delayed data) — sufficient for building ML training datasets
- **Production:** Custom; betting-grade feeds typically $5,000–$20,000+/season

### Verdict

**Excellent data quality. Use trial for ML model training only.** Not viable for production at MVP stage.

---

## 5. ESPN Unofficial / Hidden API

**Source:** https://site.api.espn.com/apis/site/v2/sports/football/nfl/
**Community docs:** https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c

### Status

✅ **Active as of mid-2025.** Widely used by open-source projects; stable for several years despite being undocumented and unsupported.

### Key Endpoints

```
# Current week scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard

# Specific week
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=1&season=2025

# All 32 teams
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams

# Full game summary (box score, play-by-play, injuries)
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event_id}

# Division standings
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings
```

### Authentication

**None.** No API key, no registration. Include a descriptive `User-Agent` header as a courtesy.

### Australian Access

✅ **Fully accessible.** No geo-restriction.

### Caveats

- Unsupported: ESPN can change or remove endpoints without notice
- No documented rate limits — be conservative (~1 req/10 sec)
- Odds: Single bookmaker (ESPN BET) only — not suitable as a primary odds source
- Historical data: Requires iterating over past seasons by week parameter

### Verdict

**Best free fixture/results feed for NFL.** Mirrors Squiggle API's role for AFL. Use for: upcoming schedules, team records, final scores, venue data. Pair with Betfair Exchange for live odds.

---

## 6. Stats Perform / Opta

**Source:** https://www.statsperform.com/opta-data/american-football/

❌ **Enterprise only.** No self-serve trial. Six-figure annual contracts. Not viable for MVP. Document as long-term roadmap only.

---

## 7. Existing BetMate Integration Patterns

### Current Sport Event Type IDs (`betfair_sports_odds.py`)

```python
SPORT_EVENT_TYPE_IDS = {
    "afl":     "61420",
    "nrl":     "1477",
    "nba":     "7522",
    "mma":     "26420387",
    "soccer":  "1",
    "cricket": "4",
    "golf":    "3",
    # To add for NFL:
    # "nfl":   "6423",
}
```

### Two-Source NBA Pattern (target model for NFL)

```
Primary: Ball Don't Lie API (api.balldontlie.io/nba/v1)
  Auth: Authorization: BDL_API_KEY header
  Fixtures: GET /games?dates[]=YYYY-MM-DD
  Historical: GET /games?seasons[]=YEAR (paginated with cursor)

Secondary: betfair_sports_odds.py
  Sport: "nba" (event type "7522")
  Provides: live odds overlay → live_odds_signal feature
```

**NFL maps exactly to this pattern:** ESPN unofficial → fixtures/results; Betfair `"6423"` → odds overlay.

---

## 8. Recommended Integration Architecture

### Phase 1 — Zero cost, immediate

```
services/prediction-engine/app/data/nfl_scraper.py (new file)
  ├── _fetch_espn_schedule(week, season)
  │     GET https://site.api.espn.com/.../nfl/scoreboard?week=N&season=YYYY
  │     Returns: home_team, away_team, date, venue, records, espn_event_id
  │     Auth: None
  │
  ├── _fetch_betfair_nfl_odds()
  │     betfair_sports_odds.fetch_sport_market_odds("nfl")
  │     Uses existing auth — no change needed
  │     Returns: event_name → {odds: {team: back_price}}
  │
  └── fetch_upcoming_nfl(run_date=None)  [public API]
        Merge ESPN fixtures with Betfair odds
        Build features: home_win_pct, away_win_pct, live_odds_signal
        Return: list of canonical game dicts

New env vars: NONE
Betfair change: add "nfl": "6423" to SPORT_EVENT_TYPE_IDS (one line)
```

### Phase 2 — Historical ML training (free Sportradar trial)

```
Register: https://developer.sportradar.com
New env var: SPORTRADAR_API_KEY
Use: Build 2020–2025 historical training dataset
NOT in live production path
```

### Phase 3 — Multi-bookmaker odds (optional)

```
Register: https://the-odds-api.com
New env var: THE_ODDS_API_KEY
Free tier (500 req/mo) sufficient for one full NFL regular season
```

---

## 9. Suggested NFL Features

| Feature | Source | Notes |
|---|---|---|
| `home_win_pct` | ESPN records | Season W-L → float |
| `away_win_pct` | ESPN records | Season W-L → float |
| `home_pts_per_game` | ESPN / Sportradar | Offensive proxy |
| `away_pts_allowed` | ESPN / Sportradar | Defensive proxy |
| `home_rest_days` | Schedule delta | Days since last game |
| `away_rest_days` | Schedule delta | Days since last game |
| `is_dome_game` | Venue lookup dict | Eliminates weather variable |
| `home_is_divisional` | Team division map | Rivalry context |
| `live_odds_signal` | Betfair Exchange | `1.0 / home_back_price` |
| `home_qb_injured` | ESPN `/summary` injuries | High-impact categorical |

---

## 10. Action Items

1. **`betfair_sports_odds.py`** — Add `"nfl": "6423"` to `SPORT_EVENT_TYPE_IDS` (one line)
2. **Create `app/data/nfl_scraper.py`** — ESPN for fixtures; Betfair for odds; follow `nrl_scraper.py` structure
3. **Register Sportradar trial** at https://developer.sportradar.com → add `SPORTRADAR_API_KEY` to `.env`
4. *(Optional)* **Register The Odds API free tier** at https://the-odds-api.com → `THE_ODDS_API_KEY`
5. **Create NFL ML model** — extend `app/ml/` mirroring NBA model pattern
6. **Update `modal_app.py`** — add `nfl_model_refresh` cron (season-scoped: September–February)
7. **Update `nightly.py`** — include `"nfl"` in results ingestion and settlement loop
8. **Update `main.py`** — add `/api/nfl/games/upcoming` endpoint

---

## Appendix: Primary Source URLs

| Provider | URL |
|---|---|
| Betfair Exchange API docs | https://developer.betfair.com/exchange-api/ |
| Betfair AU endpoint | https://api.betfair.com.au/exchange/betting/rest/v1.0/ |
| The Odds API docs | https://the-odds-api.com/liveapi/guides/v4/ |
| The Odds API pricing | https://the-odds-api.com/#pricing |
| Sportradar NFL v7 reference | https://developer.sportradar.com/football/reference/nfl-v7 |
| Sportradar trial signup | https://developer.sportradar.com |
| ESPN unofficial API — NFL | https://site.api.espn.com/apis/site/v2/sports/football/nfl/ |
| ESPN API community docs | https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c |
| Stats Perform / Opta NFL | https://www.statsperform.com/opta-data/american-football/ |
