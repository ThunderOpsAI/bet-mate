# Competitive landscape: tipping & betting-analytics apps

Research for [#71](https://github.com/ThunderOpsAI/bet-mate/issues/71) (map [#59](https://github.com/ThunderOpsAI/bet-mate/issues/59)).
Sources: vendor sites/help centres (actionnetwork.com, pikkit.com, tipstrr.com, betfair.com.au Hub, betfair-datascientists.github.io), App Store listings. Claims are product-level as publicly described in Oct 2026; verify pricing before quoting.

## What BetMate already has (apps/web)
Track record page (ROI, CLV, drawdown), strategy page, high-EV, blackbook + rule builder, bankroll, bets, mates, achievements, Ask Bob explainer, ExplainDrawer/EducationTooltip, per-sport pages (racing, AFL, NRL, NBA, soccer, golf, MMA).

## Products surveyed

| Product | Market | Strategy transparency | Track record / CLV | Writeups | Engagement / trust levers |
|---|---|---|---|---|---|
| Betfair Hub models (Kash racing, Iggy greyhounds) | AU | Model ratings published openly; methodology tutorials + open-source code on betfair-datascientists GitHub | Historical ratings downloadable for backtest | Daily expert previews alongside model prices | "Rated price vs market" framing; education-first |
| Punters.com.au | AU | Expert tips, speed maps, form filters | Tipster strike-rate tables | Race previews | Blackbook alerts, free form guide |
| Racing.com form | AU | Form, sectionals, speed maps | Limited | Video + race previews | Video replays, official data |
| Timeform | UK/AU | Proprietary ratings with published rating scale/explainers | Ratings history per horse | Analyst comments per runner ("flags") | Short per-runner verdicts, icons (e.g. horse in form) |
| Action Network PRO | US | Model projections with edge % and letter grades; "Systems" with historical record | Auto CLV % in My Action tracker | Expert articles tied to each pick | Sharp-money signals, alerts, bet sync |
| OddsJam | US | +EV / arbitrage screens, fair-odds devig method stated | Bet tracker with CLV | Education academy | Real-time alerts, price-at-time logging |
| Unabated | US | Explicit "Unabated Line" (sharp-weighted fair price) | Beat-the-close emphasis | Methodology docs | Pro tools, transparency of fair-line source |
| Rithmm | US | User-built custom models (choose weights on factors) | Model backtest shown on build | AI pick explanations | "Build your own model" ownership |
| Pikkit | US | n/a (tracker) | Auto CLV, verified leaderboards, segment by sport/market/book | — | Book sync, tail friends, unit-only privacy |
| Juice Reel | US | Social picks | Verified records | — | Follow/tail, social feed |
| Tipstrr | UK/global | Tipster marketplace | Immutable, every-tip records: ROI, strike rate, avg odds, monthly P/L at level stakes | Tipster notes | Paywall only after transparent history |

## Patterns that drive trust
1. **Immutable, timestamped records** (Tipstrr, Pikkit verified): tips locked pre-event, losers can't be deleted.
2. **CLV as the headline skill metric**, not just ROI (Action, Pikkit, Unabated, OddsJam).
3. **Show the fair price vs market** with edge % (Betfair Hub rated prices, Action grades, Unabated line).
4. **Per-pick short rationale** (Timeform flags, Action write-ups) — 1–3 lines, not essays.
5. **Segmented performance** (by sport, market, odds band, strategy) so users see where it works.
6. **Systems/strategies with historical record + live forward record shown separately** (Action Systems).
7. **User ownership** — build/tweak your model (Rithmm), blackbook alerts (Punters).

## Ranked ideas for BetMate
1. **Per-strategy live "forward" record with locked timestamps** — separate backtest vs live, every pick immutable, CLV + ROI + n + drawdown per strategy.
2. **Fair price vs market + edge grade on every pick** (e.g. A/B/C by edge % and confidence), consistent across sports.
3. **One-line "why" writeup per pick** generated from model features (Timeform-style flags) with ExplainDrawer for depth.
4. **Segmented track record filters** (sport, strategy, odds band, market, time window).
5. **Strategy alerts** — notify when a strategy/blackbook rule fires (Action Signals / Punters blackbook).
6. **Custom strategy builder with instant backtest** (Rithmm) — extend blackbook rule builder.
7. **Mates tail + leaderboard in units only** (Pikkit privacy model).
8. **Open methodology page** (Betfair Hub/Unabated) — how fair prices/devig are computed.

## Implementation spec — top 3

### 1. Per-strategy forward record
- Data: each published pick stores `strategyId`, `publishedAt`, `oddsAtPublish`, `closingOdds`, `result`, `stake units`; rows write-once (no update after `publishedAt` except settlement/closing fields).
- API: `GET /strategies/:id/record?window=` → `{n, roi, strikeRate, avgClvPct, maxDrawdown, sinceDate, series[]}`; backtest returned separately, labelled.
- UI: strategy card shows "Live since <date> · n picks · ROI · CLV" badge; track-record page tab per strategy; empty state "No settled live picks yet" (no placeholder numbers).
- Accept: a pick cannot be edited/deleted after publish; backtest and live never merged in one number.

### 2. Fair price vs market + edge grade
- Compute `fairOdds = 1/modelProb`, `edgePct = modelProb*marketOdds − 1`; grade A ≥ X%, B, C (thresholds set via config, documented on methodology page).
- Display on pick cards across all sports: market odds, fair odds, edge %, grade chip; hide grade when market price stale (> N min) and show "price stale".
- Accept: grade calibration report (realised ROI/CLV by grade) appears in track record.

### 3. One-line pick rationale
- Prediction engine returns top-3 feature contributions per selection; API maps to templated phrases ("Drops in class", "Strong recent sectionals", "Market drifting").
- UI: one line under each pick; tap opens existing ExplainDrawer with full factor list.
- Accept: rationale only from real model output; if unavailable, show nothing (no generic text).
