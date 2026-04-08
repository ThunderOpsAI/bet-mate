"use client";
import { useEffect, useState } from "react";
import { Brain, Zap, BarChart3 } from "lucide-react";

const ML_API = process.env.NEXT_PUBLIC_ML_API ?? "http://localhost:8000";

type NBAGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
};

type NBAPrediction = {
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

export default function NBAPage() {
  const [games, setGames] = useState<NBAGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, NBAPrediction>>({});
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${ML_API}/api/nba/games/today`);
        const data = await res.json();
        const fetchedGames: NBAGame[] = data?.games ?? [];
        setGames(fetchedGames);

        const predsMap: Record<string, NBAPrediction> = {};
        await Promise.all(
          fetchedGames.map(async (game) => {
            try {
              const predRes = await fetch(`${ML_API}/api/predict/nba`, {
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
        console.error("Failed to load NBA data:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Zap size={48} />
          <p>Running XGBoost NBA Model...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="game-cards-list">
        {games.map(game => {
          const pred = predictions[game.game_id];
          const homePct = pred?.predictions?.home_win_probability ?? 50;
          const awayPct = pred?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;
          const isExpanded = expandedGame === game.game_id;

          return (
            <div
              key={game.game_id}
              className={`game-prediction-card nba-variant ${isExpanded ? "expanded" : ""}`}
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

                <div className="vs-divider nba">
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
              <div className="game-prob-bar large nba">
                <div className="prob-fill home nba" style={{ width: `${homePct}%` }} />
                <div className="prob-fill away nba" style={{ width: `${awayPct}%` }} />
              </div>

              {/* Game Context Chips */}
              <div className="game-context-row">
                <span className="context-chip">ORTG H:{game.features.home_ortg}</span>
                <span className="context-chip">DRTG H:{game.features.home_drtg}</span>
                <span className="context-chip">{game.features.home_b2b ? "⚡ Home B2B" : "✅ Home Rested"}</span>
                <span className="context-chip">{game.features.away_b2b ? "⚡ Away B2B" : "✅ Away Rested"}</span>
              </div>

              {/* Expanded Details */}
              {isExpanded && pred && (
                <div className="game-expanded-section">
                  {/* Stats Comparison */}
                  <div className="stats-compare">
                    <div className="compare-row">
                      <span className="compare-label">Win %</span>
                      <span className="compare-home">{(game.features.home_win_pct * 100).toFixed(0)}%</span>
                      <span className="compare-away">{(game.features.away_win_pct * 100).toFixed(0)}%</span>
                    </div>
                    <div className="compare-row">
                      <span className="compare-label">Off Rating</span>
                      <span className="compare-home">{game.features.home_ortg}</span>
                      <span className="compare-away">{game.features.away_ortg}</span>
                    </div>
                    <div className="compare-row">
                      <span className="compare-label">Def Rating</span>
                      <span className="compare-home">{game.features.home_drtg}</span>
                      <span className="compare-away">{game.features.away_drtg}</span>
                    </div>
                    <div className="compare-row">
                      <span className="compare-label">Injury Impact</span>
                      <span className="compare-home">{game.features.home_injuries_impact}</span>
                      <span className="compare-away">{game.features.away_injuries_impact}</span>
                    </div>
                  </div>

                  {/* Feature Impact */}
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
                                className="feature-bar-fill nba"
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
        ⚠️ <strong>Disclaimer:</strong> NBA predictions are generated by XGBoost models considering offensive/defensive ratings, fatigue, injuries, and home court advantage. They are not guarantees.
      </div>
    </div>
  );
}

function formatFeatureName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
