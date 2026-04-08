"use client";
import { useEffect, useState } from "react";
import { Brain, CircleDot, BarChart3 } from "lucide-react";
import Link from "next/link";
import { ML_API } from "../lib/mlApi";

type AFLGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
  round?: number;
  venue?: string;
  date?: string;
  complete?: number;
  hscore?: number | null;
  ascore?: number | null;
  squiggle_tip?: string;
  squiggle_confidence?: number;
};

type AFLScoreUpdate = {
  id?: string | number;
  game_id?: string | number;
  gameid?: string | number;
  hscore?: number | string | null;
  ascore?: number | string | null;
  complete?: number | string | null;
  status?: string;
};

type AFLPrediction = {
  game_id: string;
  predictions: {
    home_team: string;
    away_team: string;
    home_win_probability: number;
    away_win_probability: number;
    fair_odds_home: number;
    fair_odds_away: number;
  };
  feature_impact: Record<string, number>;
  ai_insights_context: string;
};

const weatherMap: Record<number, string> = { 1: "☀️ Clear", 2: "⛅ Cloudy", 3: "🌧️ Rain" };

export default function AFLPage() {
  const [games, setGames] = useState<AFLGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, AFLPrediction>>({});
  const [liveScores, setLiveScores] = useState<Record<string, AFLScoreUpdate>>({});
  const [liveStatus, setLiveStatus] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${ML_API}/api/afl/games/upcoming`);
        const data = await res.json();
        const fetchedGames: AFLGame[] = data?.games ?? [];
        setGames(fetchedGames);

        const predsMap: Record<string, AFLPrediction> = {};
        await Promise.all(
          fetchedGames.map(async (game) => {
            try {
              const predRes = await fetch(`${ML_API}/api/predict/afl`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(game),
              });
              if (predRes.ok) {
                predsMap[game.game_id] = await predRes.json();
              }
            } catch { /* skip */ }
          })
        );
        setPredictions(predsMap);
      } catch (e) {
        console.error("Failed to load AFL data:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`${ML_API}/api/afl/games/live`);

    const handleGamesEvent = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const updates = Array.isArray(parsed) ? parsed : [parsed];
        const nextScores: Record<string, AFLScoreUpdate> = {};

        for (const update of updates) {
          const key = getLiveScoreKey(update);
          if (key) {
            nextScores[key] = update;
          }
        }

        if (Object.keys(nextScores).length > 0) {
          setLiveScores((current) => ({ ...current, ...nextScores }));
        }
        setLiveStatus("connected");
      } catch {
        // Squiggle also sends a welcome message event; ignore anything that is not game JSON.
      }
    };

    eventSource.addEventListener("games", handleGamesEvent);
    eventSource.onopen = () => setLiveStatus("connected");
    eventSource.onerror = () => setLiveStatus("reconnecting");

    return () => {
      eventSource.removeEventListener("games", handleGamesEvent);
      eventSource.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <CircleDot size={48} />
          <p>Running XGBoost AFL Model...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="game-cards-list">
        {games.map(game => {
          const pred = predictions[game.game_id];
          const liveScore = liveScores[game.game_id];
          const homeScore = toScore(liveScore?.hscore ?? game.hscore);
          const awayScore = toScore(liveScore?.ascore ?? game.ascore);
          const gameComplete = toScore(liveScore?.complete ?? game.complete) ?? 0;
          const scoreLabel = formatScoreLabel(homeScore, awayScore, gameComplete);
          const homePct = pred?.predictions?.home_win_probability ?? 50;
          const awayPct = pred?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;
          const isExpanded = expandedGame === game.game_id;

          return (
            <div
              key={game.game_id}
              className={`game-prediction-card ${isExpanded ? "expanded" : ""}`}
              onClick={() => setExpandedGame(isExpanded ? null : game.game_id)}
            >
              {/* Matchup Header */}
              <div className="game-matchup-header">
                <div className={`team-block ${homeWins ? "favoured" : ""}`}>
                  <span className="team-label">HOME</span>
                  <span className="team-name-lg">{game.home_team}</span>
                  <span className="team-prob-lg">{homePct.toFixed(1)}%</span>
                  {pred && <span className="team-odds">Fair: ${pred.predictions.fair_odds_home}</span>}
                </div>

                <div className="vs-divider">
                  <span>VS</span>
                </div>

                <div className={`team-block ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-label">AWAY</span>
                  <span className="team-name-lg">{game.away_team}</span>
                  <span className="team-prob-lg">{awayPct.toFixed(1)}%</span>
                  {pred && <span className="team-odds">Fair: ${pred.predictions.fair_odds_away}</span>}
                </div>
              </div>

              {/* Probability Bar */}
              <div className="game-prob-bar large">
                <div className="prob-fill home" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away" style={{ width: `${awayPct}%` }} />
              </div>

              {/* Game Context */}
              <div className="game-context-row">
                <span className="context-chip">Live scores: {formatLiveStatus(liveStatus)}</span>
                {scoreLabel && <span className="context-chip">{scoreLabel}</span>}
                <span className="context-chip">{weatherMap[game.features.weather_condition] ?? "☀️ Clear"}</span>
                <span className="context-chip">🏠 {game.features.home_rest_days}d rest</span>
                <span className="context-chip">✈️ {game.features.travel_distance_away}km travel</span>
                <span className="context-chip">🔥 H:W{game.features.home_win_streak} / A:W{game.features.away_win_streak}</span>
                {game.squiggle_tip && (
                  <span className="context-chip">
                    Squiggle: {game.squiggle_tip} {formatSquiggleConfidence(game.squiggle_confidence)}
                  </span>
                )}
                {pred && (
                  <>
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
                      Paper Bet Home
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
                      Paper Bet Away
                    </Link>
                  </>
                )}
              </div>

              {/* Expanded: Feature Impact */}
              {isExpanded && pred && (
                <div className="game-expanded-section">
                  <div className="feature-impact-section">
                    <h4><BarChart3 size={16} /> ML Feature Impact</h4>
                    <div className="feature-bars">
                      {Object.entries(pred.feature_impact)
                        .sort(([, a], [, b]) => b - a)
                        .map(([feature, importance]) => (
                          <div key={feature} className="feature-bar-row">
                            <span className="feature-label">{formatFeatureName(feature)}</span>
                            <div className="feature-bar-track">
                              <div
                                className="feature-bar-fill afl"
                                style={{ width: `${(importance / Math.max(...Object.values(pred.feature_impact))) * 100}%` }}
                              />
                            </div>
                            <span className="feature-value">{(importance * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {pred.ai_insights_context && (
                    <div className="ai-insight-card">
                      <Brain size={16} />
                      <span>{pred.ai_insights_context}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> AFL predictions are generated by XGBoost models considering home advantage, form, weather, and travel fatigue. They are not guarantees.
      </div>
    </div>
  );
}

function formatFeatureName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatSquiggleConfidence(confidence?: number): string {
  if (!confidence) {
    return "";
  }

  const confidencePct = confidence > 1 ? confidence : confidence * 100;
  return `${confidencePct.toFixed(0)}%`;
}

function getLiveScoreKey(update: AFLScoreUpdate): string | null {
  const key = update.id ?? update.game_id ?? update.gameid;
  return key === undefined || key === null ? null : String(key);
}

function toScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatScoreLabel(homeScore: number | null, awayScore: number | null, complete: number): string | null {
  if (homeScore === null || awayScore === null) {
    return null;
  }

  const status = complete >= 100 ? "Final" : "Live";
  return `${status}: ${homeScore}-${awayScore}`;
}

function formatLiveStatus(status: "connecting" | "connected" | "reconnecting"): string {
  if (status === "connected") {
    return "connected";
  }

  if (status === "reconnecting") {
    return "reconnecting";
  }

  return "connecting";
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
