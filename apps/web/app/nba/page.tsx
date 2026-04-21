"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BobExplanation,
  FeatureImpactItem,
  ModelMetadata,
} from "../lib/bob/explainer";
import { Brain, Zap, BarChart3 } from "lucide-react";
import ExplainDrawer from "../components/ExplainDrawer";
import {
  ConfidenceBadge,
  UrgencyBadge,
} from "../components/PredictionSignalBadges";
import BestNbaOpportunities from "../components/nba/BestOpportunities";
import RefreshControls from "../components/RefreshControls";
import { buildBobExplanation } from "../lib/bob/explainer";
import { ML_API } from "../lib/mlApi";
import {
  getMlCacheDateKey,
  getMlDataCacheKey,
  getMlDataCacheMetadata,
  isMlDataCacheStale,
  readMlDataCache,
  refreshMlDataCache,
  scheduleMlDataCacheRetry,
} from "../lib/cache/mlDataCache";
import {
  getConfidenceSignal,
  getUrgencySignal,
} from "../lib/predictionSignals";
import { rankOpportunities } from "../lib/opportunityScore";
import PaperBetAction from "../components/PaperBetAction";

type NBAGame = {
  game_id: string;
  home_team: string;
  away_team: string;
  features: Record<string, number>;
  date?: string;
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
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?:
    | {
        data_quality?: "strong" | "moderate" | "thin";
        calibration_confidence?: number;
        market_agreement?: boolean;
        notes?: string[];
      }
    | string;
  model_metadata?: ModelMetadata;
};

type NBAPredictionEntry = readonly [string, NBAPrediction];

function getNbaCacheKeys() {
  const dateKey = getMlCacheDateKey();

  return {
    fixturesKey: getMlDataCacheKey("fixtures", "nba", dateKey),
    predictionsKey: getMlDataCacheKey("predictions", "nba", dateKey),
  };
}

function isNbaPredictionEntry(
  entry: NBAPredictionEntry | null,
): entry is NBAPredictionEntry {
  return entry !== null;
}

async function fetchTodayNbaGames() {
  const response = await fetch(`${ML_API}/api/nba/games/today`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NBA fixtures request failed with ${response.status}`);
  }

  const data = await response.json();
  return (data?.games ?? []) as NBAGame[];
}

async function fetchNbaPredictions(games: NBAGame[]) {
  const entries = await Promise.all(
    games.map(async (game) => {
      try {
        const response = await fetch(`${ML_API}/api/predict/nba`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(game),
        });

        if (!response.ok) {
          return null;
        }

        return [game.game_id, await response.json()] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(isNbaPredictionEntry)) as Record<
    string,
    NBAPrediction
  >;
}

export default function NBAPage() {
  const [games, setGames] = useState<NBAGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, NBAPrediction>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [activeExplanation, setActiveExplanation] = useState<BobExplanation | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncCacheMetadata = () => {
    const { fixturesKey, predictionsKey } = getNbaCacheKeys();
    const metadata = getMlDataCacheMetadata([fixturesKey, predictionsKey]);

    if (!isMountedRef.current) {
      return;
    }

    setLastUpdated(metadata.lastUpdated);
    setNextRefreshAt(metadata.nextRefreshAt);
  };

  const hydrateFromCache = () => {
    const { fixturesKey, predictionsKey } = getNbaCacheKeys();
    const cachedGames = readMlDataCache<NBAGame[]>(fixturesKey);
    const cachedPredictions = readMlDataCache<Record<string, NBAPrediction>>(
      predictionsKey,
    );

    if (cachedGames && isMountedRef.current) {
      setGames(cachedGames.data);
    }

    if (cachedPredictions && isMountedRef.current) {
      setPredictions(cachedPredictions.data);
    }

    syncCacheMetadata();

    return {
      cachedGames,
      cachedPredictions,
    };
  };

  const refreshPage = async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    if (isMountedRef.current) {
      setRefreshing(true);
    }

    const { fixturesKey, predictionsKey } = getNbaCacheKeys();

    const fixturesEntry = await refreshMlDataCache(
      fixturesKey,
      fetchTodayNbaGames,
      { force: true },
    ).catch((error) => {
      console.error("Failed to refresh NBA fixtures:", error);
      scheduleMlDataCacheRetry(fixturesKey);
      return readMlDataCache<NBAGame[]>(fixturesKey);
    });

    if (fixturesEntry && isMountedRef.current) {
      setGames(fixturesEntry.data);
      setLoading(false);
    }

    if (fixturesEntry) {
      const predictionsEntry = await refreshMlDataCache(
        predictionsKey,
        () => fetchNbaPredictions(fixturesEntry.data),
        { force: true },
      ).catch((error) => {
        console.error("Failed to refresh NBA predictions:", error);
        scheduleMlDataCacheRetry(predictionsKey);
        return readMlDataCache<Record<string, NBAPrediction>>(predictionsKey);
      });

      if (predictionsEntry && isMountedRef.current) {
        setPredictions(predictionsEntry.data);
      }
    }

    syncCacheMetadata();
    refreshingRef.current = false;

    if (isMountedRef.current) {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const { cachedGames, cachedPredictions } = hydrateFromCache();

    if (cachedGames) {
      setLoading(false);
    }

    const shouldRefresh =
      !cachedGames ||
      !cachedPredictions ||
      isMlDataCacheStale(cachedGames) ||
      isMlDataCacheStale(cachedPredictions);

    if (shouldRefresh) {
      void refreshPage();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <Zap size={48} />
          <p>Loading NBA snapshot...</p>
        </div>
      </div>
    );
  }

  const nbaOpportunities = rankOpportunities(
    games.flatMap((game) => {
      const prediction = predictions[game.game_id];
      if (!prediction) {
        return [];
      }

      const homePct = prediction.predictions.home_win_probability;
      const awayPct = prediction.predictions.away_win_probability;
      const homeWins = homePct > awayPct;

      return [
        {
          id: game.game_id,
          sport: "nba" as const,
          selectionName: homeWins ? game.home_team : game.away_team,
          eventLabel: `${game.home_team} vs ${game.away_team}`,
          probability: homeWins ? homePct : awayPct,
          fairOdds: homeWins
            ? prediction.predictions.fair_odds_home
            : prediction.predictions.fair_odds_away,
          confidenceSignal: getConfidenceSignal(prediction.ai_insights_context),
          urgencySignal: getUrgencySignal({
            startTime: game.date,
          }),
          href: "/nba",
          note:
            "Live market prices are not attached here yet, so this section stays honest by ranking model leans instead of claiming a price edge.",
        },
      ];
    }),
  ).slice(0, 5);

  return (
    <div>
      <ExplainDrawer
        open={activeExplanation !== null}
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />
      <RefreshControls
        lastUpdated={lastUpdated}
        nextRefreshAt={nextRefreshAt}
        isRefreshing={refreshing}
        onRefresh={refreshPage}
      />

      <BestNbaOpportunities opportunities={nbaOpportunities} />

      <div className="game-cards-list">
        {games.map((game) => {
          const prediction = predictions[game.game_id];
          const homePct = prediction?.predictions?.home_win_probability ?? 50;
          const awayPct = prediction?.predictions?.away_win_probability ?? 50;
          const homeWins = homePct > awayPct;
          const isExpanded = expandedGame === game.game_id;
          const confidenceSignal = prediction
            ? getConfidenceSignal(prediction.ai_insights_context)
            : null;
          const urgencySignal = getUrgencySignal({
            startTime: game.date,
          });

          return (
            <div
              key={game.game_id}
              className={`game-prediction-card nba-variant ${
                isExpanded ? "expanded" : ""
              }`}
              onClick={() => setExpandedGame(isExpanded ? null : game.game_id)}
            >
              <div className="game-matchup-header">
                <div className={`team-block ${homeWins ? "favoured" : ""}`}>
                  <span className="team-label">HOME</span>
                  <span className="team-name-lg">{game.home_team}</span>
                  <span className="team-prob-lg">{homePct.toFixed(1)}%</span>
                  {prediction ? (
                    <span className="team-odds">
                      Fair: ${prediction.predictions.fair_odds_home}
                    </span>
                  ) : null}
                </div>

                <div className="vs-divider nba">
                  <span>VS</span>
                </div>

                <div className={`team-block ${!homeWins ? "favoured" : ""}`}>
                  <span className="team-label">AWAY</span>
                  <span className="team-name-lg">{game.away_team}</span>
                  <span className="team-prob-lg">{awayPct.toFixed(1)}%</span>
                  {prediction ? (
                    <span className="team-odds">
                      Fair: ${prediction.predictions.fair_odds_away}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="game-prob-bar large nba">
                <div
                  className="prob-fill home nba"
                  style={{ width: `${homePct}%` }}
                />
                <div
                  className="prob-fill away nba"
                  style={{ width: `${awayPct}%` }}
                />
              </div>

              <div className="game-context-row">
                <span className="context-chip">
                  ORTG H:{game.features.home_ortg}
                </span>
                <span className="context-chip">
                  DRTG H:{game.features.home_drtg}
                </span>
                <span className="context-chip">
                  {game.features.home_b2b ? "⚡ Home B2B" : "✅ Home Rested"}
                </span>
                <span className="context-chip">
                  {game.features.away_b2b ? "⚡ Away B2B" : "✅ Away Rested"}
                </span>
                {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
                {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
                {prediction ? (
                  <>
                    <button
                      type="button"
                      className="why-pick-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveExplanation(
                          buildBobExplanation({
                            sport: "nba",
                            selectionName: homeWins ? game.home_team : game.away_team,
                            opponentName: homeWins ? game.away_team : game.home_team,
                            probability: homeWins ? homePct : awayPct,
                            fairOdds: homeWins
                              ? prediction.predictions.fair_odds_home
                              : prediction.predictions.fair_odds_away,
                            featureImpact: prediction.feature_impact,
                            aiInsightsContext: prediction.ai_insights_context,
                            modelMetadata: prediction.model_metadata,
                          }),
                        );
                      }}
                    >
                      <Brain size={14} /> Why {homeWins ? game.home_team : game.away_team}?
                    </button>
                    <div onClick={(event) => event.stopPropagation()}>
                      <PaperBetAction
                        bet={{
                          sport: "nba",
                          event_id: game.game_id,
                          event_name: `${game.home_team} vs ${game.away_team}`,
                          selection: game.home_team,
                          odds: prediction.predictions.fair_odds_home,
                          bet_type: "head_to_head",
                          stake: 10,
                        }}
                      />
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <PaperBetAction
                        bet={{
                          sport: "nba",
                          event_id: game.game_id,
                          event_name: `${game.home_team} vs ${game.away_team}`,
                          selection: game.away_team,
                          odds: prediction.predictions.fair_odds_away,
                          bet_type: "head_to_head",
                          stake: 10,
                        }}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              {isExpanded && prediction ? (
                <div className="game-expanded-section">
                  <div className="stats-compare">
                    <div className="compare-row">
                      <span className="compare-label">Win %</span>
                      <span className="compare-home">
                        {(game.features.home_win_pct * 100).toFixed(0)}%
                      </span>
                      <span className="compare-away">
                        {(game.features.away_win_pct * 100).toFixed(0)}%
                      </span>
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
                      <span className="compare-home">
                        {game.features.home_injuries_impact}
                      </span>
                      <span className="compare-away">
                        {game.features.away_injuries_impact}
                      </span>
                    </div>
                  </div>

                  <div className="feature-impact-section">
                    <h4>
                      <BarChart3 size={16} /> Bob explainability
                    </h4>
                    <p className="muted-copy">
                      Open the "Why" drawer for the lead side to see the real edge,
                      the caution flags, and whether the model confidence deserves a
                      heavier or lighter touch.
                    </p>
                  </div>

                  <div className="explain-inline-card">
                    <span>
                      Model lean: {homeWins ? game.home_team : game.away_team} at{" "}
                      {(homeWins ? homePct : awayPct).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="disclaimer">
        ⚠️ <strong>Disclaimer:</strong> NBA predictions are generated by machine
        learning models considering offensive and defensive ratings, fatigue,
        injuries, and home court advantage. They are not guarantees.
      </div>
    </div>
  );
}
