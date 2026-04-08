"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Zap, CircleDot, ChevronRight, Activity, Brain, TrendingUp, BarChart3 } from "lucide-react";
import Link from "next/link";
import { ML_API } from "./lib/mlApi";

type RaceSummary = {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  horses: any[];
};

type AFLGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
};

type NBAGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
};

type PredictionEntry = readonly [string, any];

function isPredictionEntry(entry: PredictionEntry | null): entry is PredictionEntry {
  return entry !== null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [aflGames, setAFLGames] = useState<AFLGame[]>([]);
  const [nbaGames, setNBAGames] = useState<NBAGame[]>([]);
  const [racePredictions, setRacePredictions] = useState<Record<string, any>>({});
  const [aflPredictions, setAFLPredictions] = useState<Record<string, any>>({});
  const [nbaPredictions, setNBAPredictions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [engineStatus, setEngineStatus] = useState<"online" | "offline">("offline");

  useEffect(() => {
    let cancelled = false;

    const loadRacePredictions = async (fetchedRaces: RaceSummary[]) => {
      const entries = await Promise.all(
        fetchedRaces.slice(0, 3).map(async (race) => {
          try {
            const res = await fetch(`${ML_API}/api/predict/racing`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(race),
            });
            if (!res.ok) return null;
            return [race.race_id, await res.json()] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setRacePredictions(Object.fromEntries(entries.filter(isPredictionEntry)));
      }
    };

    const loadAFLPredictions = async (fetchedAFL: AFLGame[]) => {
      const entries = await Promise.all(
        fetchedAFL.slice(0, 3).map(async (game) => {
          try {
            const res = await fetch(`${ML_API}/api/predict/afl`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(game),
            });
            if (!res.ok) return null;
            return [game.game_id, await res.json()] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setAFLPredictions(Object.fromEntries(entries.filter(isPredictionEntry)));
      }
    };

    const loadNBAPredictions = async (fetchedNBA: NBAGame[]) => {
      const entries = await Promise.all(
        fetchedNBA.slice(0, 3).map(async (game) => {
          try {
            const res = await fetch(`${ML_API}/api/predict/nba`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(game),
            });
            if (!res.ok) return null;
            return [game.game_id, await res.json()] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setNBAPredictions(Object.fromEntries(entries.filter(isPredictionEntry)));
      }
    };

    const load = async () => {
      try {
        const [healthRes, racesRes, aflRes, nbaRes] = await Promise.all([
          fetch(`${ML_API}/health`).catch(() => null),
          fetch(`${ML_API}/api/races/today`).then(r => r.json()),
          fetch(`${ML_API}/api/afl/games/upcoming`).then(r => r.json()),
          fetch(`${ML_API}/api/nba/games/today`).then(r => r.json()),
        ]);

        if (!cancelled) {
          setEngineStatus(healthRes?.ok ? "online" : "offline");
        }

        const fetchedRaces: RaceSummary[] = racesRes?.races ?? [];
        const fetchedAFL: AFLGame[] = aflRes?.games ?? [];
        const fetchedNBA: NBAGame[] = nbaRes?.games ?? [];

        if (!cancelled) {
          setRaces(fetchedRaces);
          setAFLGames(fetchedAFL);
          setNBAGames(fetchedNBA);
          setLoading(false);
        }

        void loadRacePredictions(fetchedRaces);
        void loadAFLPredictions(fetchedAFL);
        void loadNBAPredictions(fetchedNBA);
      } catch (e) {
        console.error("Failed to load ML data:", e);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Brain size={48} />
          <p>Training ML Models & Loading Predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Engine Status Banner */}
      <div className={`engine-banner ${engineStatus}`}>
        <Activity size={16} />
        <span>ML Prediction Engine: <strong>{engineStatus === "online" ? "Online" : "Offline"}</strong></span>
        {engineStatus === "online" && <span className="engine-models">3 XGBoost Models Active</span>}
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label"><Trophy size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Races Today</div>
          <div className="stat-value">{races.length}</div>
          <div className="stat-sub">{new Set(races.map(r => r.venue)).size} venues</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label"><CircleDot size={14} style={{ display: "inline", verticalAlign: "middle" }} /> AFL Games</div>
          <div className="stat-value">{aflGames.length}</div>
          <div className="stat-sub">This round</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label"><Zap size={14} style={{ display: "inline", verticalAlign: "middle" }} /> NBA Games</div>
          <div className="stat-value">{nbaGames.length}</div>
          <div className="stat-sub">Tonight</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label"><Brain size={14} style={{ display: "inline", verticalAlign: "middle" }} /> ML Models</div>
          <div className="stat-value">3</div>
          <div className="stat-sub">XGBoost Ensemble</div>
        </div>
      </div>

      {/* Racing Section */}
      <div className="section-header">
        <h3>🏇 Top Racing Predictions</h3>
        <Link href="/racing" className="btn btn-sm btn-secondary">View All <ChevronRight size={14} /></Link>
      </div>
      <div className="predictions-grid">
        {races.slice(0, 3).map(race => {
          const pred = racePredictions[race.race_id];
          const top3 = pred?.predictions?.slice(0, 3) ?? [];
          return (
            <div key={race.race_id} className="prediction-card" onClick={() => router.push("/racing")}>
              <div className="prediction-card-header">
                <div>
                  <span className="prediction-venue">{race.venue}</span>
                  <span className="prediction-race">Race {race.race_number}</span>
                </div>
                <span className="badge badge-accent">{race.distance}m</span>
              </div>
              <div className="prediction-picks">
                {top3.map((p: any, i: number) => (
                  <div key={p.horse_id} className="prediction-pick-row">
                    <div className="prediction-pick-left">
                      <span className={`pick-rank rank-${i + 1}`}>{i + 1}</span>
                      <span className="prediction-horse-name">{p.name}</span>
                    </div>
                    <div className="prediction-pick-right">
                      <span className="prediction-prob">{p.win_probability}%</span>
                      <span className="prediction-odds">${p.fair_odds}</span>
                      <Link
                        className="btn btn-sm btn-secondary"
                        href={paperBetHref({
                          sport: "racing",
                          eventId: race.race_id,
                          eventName: `${race.venue} R${race.race_number}`,
                          selection: p.name,
                          odds: p.fair_odds,
                          betType: "win",
                        })}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Paper
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {pred?.ai_insights_context && (
                <div className="ai-insight-badge">
                  <Brain size={12} /> {pred.ai_insights_context}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AFL Section */}
      <div className="section-header" style={{ marginTop: "2rem" }}>
        <h3>🏈 AFL Predictions</h3>
        <Link href="/afl" className="btn btn-sm btn-secondary">View All <ChevronRight size={14} /></Link>
      </div>
      <div className="predictions-grid">
        {aflGames.slice(0, 3).map(game => {
          const pred = aflPredictions[game.game_id];
          const homePct = pred?.predictions?.home_win_probability ?? 50;
          const awayPct = pred?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;
          return (
            <div key={game.game_id} className="prediction-card game-card-variant" onClick={() => router.push("/afl")}>
              <div className="game-matchup">
                <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.home_team}</span>
                  <span className="team-prob">{homePct}%</span>
                </div>
                <div className="game-vs">VS</div>
                <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.away_team}</span>
                  <span className="team-prob">{awayPct}%</span>
                </div>
              </div>
              <div className="game-prob-bar">
                <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
              </div>
              {pred && (
                <div className="game-context-row" style={{ marginTop: "0.75rem" }}>
                  <Link
                    className="btn btn-sm btn-secondary"
                    href={paperBetHref({
                      sport: "afl",
                      eventId: game.game_id,
                      eventName: `${game.home_team} vs ${game.away_team}`,
                      selection: game.home_team,
                      odds: pred.predictions.fair_odds_home,
                      betType: "head_to_head",
                    })}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Paper Home
                  </Link>
                  <Link
                    className="btn btn-sm btn-secondary"
                    href={paperBetHref({
                      sport: "afl",
                      eventId: game.game_id,
                      eventName: `${game.home_team} vs ${game.away_team}`,
                      selection: game.away_team,
                      odds: pred.predictions.fair_odds_away,
                      betType: "head_to_head",
                    })}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Paper Away
                  </Link>
                </div>
              )}
              {pred?.ai_insights_context && (
                <div className="ai-insight-badge">
                  <Brain size={12} /> {pred.ai_insights_context}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* NBA Section */}
      <div className="section-header" style={{ marginTop: "2rem" }}>
        <h3>🏀 NBA Predictions</h3>
        <Link href="/nba" className="btn btn-sm btn-secondary">View All <ChevronRight size={14} /></Link>
      </div>
      <div className="predictions-grid">
        {nbaGames.slice(0, 3).map(game => {
          const pred = nbaPredictions[game.game_id];
          const homePct = pred?.predictions?.home_win_probability ?? 50;
          const awayPct = pred?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;
          return (
            <div key={game.game_id} className="prediction-card game-card-variant" onClick={() => router.push("/nba")}>
              <div className="game-matchup">
                <div className={`game-team ${homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.home_team}</span>
                  <span className="team-prob">{homePct}%</span>
                </div>
                <div className="game-vs">VS</div>
                <div className={`game-team ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-name">{game.away_team}</span>
                  <span className="team-prob">{awayPct}%</span>
                </div>
              </div>
              <div className="game-prob-bar">
                <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
              </div>
              {pred && (
                <div className="game-context-row" style={{ marginTop: "0.75rem" }}>
                  <Link
                    className="btn btn-sm btn-secondary"
                    href={paperBetHref({
                      sport: "nba",
                      eventId: game.game_id,
                      eventName: `${game.home_team} vs ${game.away_team}`,
                      selection: game.home_team,
                      odds: pred.predictions.fair_odds_home,
                      betType: "head_to_head",
                    })}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Paper Home
                  </Link>
                  <Link
                    className="btn btn-sm btn-secondary"
                    href={paperBetHref({
                      sport: "nba",
                      eventId: game.game_id,
                      eventName: `${game.home_team} vs ${game.away_team}`,
                      selection: game.away_team,
                      odds: pred.predictions.fair_odds_away,
                      betType: "head_to_head",
                    })}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Paper Away
                  </Link>
                </div>
              )}
              {pred?.ai_insights_context && (
                <div className="ai-insight-badge">
                  <Brain size={12} /> {pred.ai_insights_context}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> This app is for information and tracking purposes only. We do not facilitate betting or handle payments. Predictions are generated by machine learning models and are not guarantees. Past performance does not indicate future results. Please gamble responsibly. If you need help, visit <a href="https://www.gamblinghelponline.org.au/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--yellow)", textDecoration: "underline" }}>Gambling Help Online</a>.
      </div>
    </div>
  );
}

function paperBetHref(params: {
  sport: string;
  eventId: string;
  eventName: string;
  selection: string;
  odds: number;
  betType: string;
}): string {
  const search = new URLSearchParams({
    sport: params.sport,
    event_id: params.eventId,
    event_name: params.eventName,
    selection: params.selection,
    odds: String(params.odds),
    bet_type: params.betType,
  });

  return `/bets/new?${search.toString()}`;
}
