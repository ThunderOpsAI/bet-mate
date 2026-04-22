"use client";
import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, Database, Target, RotateCw, BarChart as ChartIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ML_API } from "../lib/mlApi";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import RefreshControls from "../components/RefreshControls";

type ModelMetadata = {
  name: string;
  model_type: string;
  status: "loaded" | "not_loaded";
  training_source: string | null;
  training_rows: number;
  feature_count: number;
  features: string[];
  feature_impact: Record<string, number>;
  top_feature: string | null;
  artifact_exists: boolean;
};

type PredictionSummary = {
  sport: string;
  prediction_count: number;
  settled_count: number;
  winning_count: number;
  event_count: number;
  latest_at: string | null;
  avg_probability: number;
};

type CalibrationBucket = {
  bucket: string;
  count: number;
  avg_predicted: number;
  observed_rate: number;
};

type AccuracyMetrics = {
  sport: string;
  settled_predictions: number;
  settled_events: number;
  top_pick_wins: number;
  hit_rate: number;
  paper_bets: number;
  paper_profit: number;
  paper_roi: number;
  brier_score: number;
  log_loss: number;
  avg_confidence: number;
  avg_winner_probability: number;
  calibration_error: number;
  latest_settled_at: string | null;
  calibration: CalibrationBucket[];
  by_sport?: AccuracyMetrics[];
};

type RecentPrediction = {
  id: number;
  created_at: string;
  updated_at: string | null;
  sport: string;
  event_id: string;
  event_name: string;
  selection: string;
  probability: number;
  fair_odds: number | null;
  actual_outcome: number | null;
  result_status: string | null;
  settled_at: string | null;
};

type AccuracyTrendPoint = {
  date: string;
  sport: string;
  settled_predictions: number;
  settled_events: number;
  top_pick_wins: number;
  hit_rate: number;
  paper_bets: number;
  paper_profit: number;
  paper_roi: number;
  brier_score: number;
  log_loss: number;
};

const ANALYTICS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function AnalyticsPage() {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [predictionSummary, setPredictionSummary] = useState<PredictionSummary[]>([]);
  const [accuracy, setAccuracy] = useState<AccuracyMetrics | null>(null);
  const [accuracyTrend, setAccuracyTrend] = useState<AccuracyTrendPoint[]>([]);
  const [recentPredictions, setRecentPredictions] = useState<RecentPrediction[]>([]);
  const [selectedSport, setSelectedSport] = useState("all");
  const [loading, setLoading] = useState(true);
  const [syncingResults, setSyncingResults] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);

  const loadAnalytics = useCallback(async (showLoading = true, sportFilter = selectedSport) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);
      setError(null);
      
      const sportParam = sportFilter !== "all" ? `?sport=${sportFilter}` : "";

      const [metadataRes, summaryRes, accuracyRes, trendRes, recentRes] = await Promise.all([
        fetch(`${ML_API}/api/models/metadata`),
        fetch(`${ML_API}/api/predictions/summary`),
        fetch(`${ML_API}/api/predictions/accuracy${sportParam}`),
        fetch(`${ML_API}/api/predictions/accuracy/trend${sportParam}`),
        fetch(`${ML_API}/api/predictions/results/recent?limit=100`),
      ]);

      if (metadataRes.ok) {
        const data = await metadataRes.json();
        setModels(data.models || []);
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setPredictionSummary(data.summary || []);
      }
      if (accuracyRes.ok) {
        const data = await accuracyRes.json();
        setAccuracy(data.accuracy);
      }
      if (trendRes.ok) {
        const data = await trendRes.json();
        setAccuracyTrend(data.trend || []);
      }
      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentPredictions(data.results || []);
      }

      const updatedAt = Date.now();
      setLastUpdated(updatedAt);
      setNextRefreshAt(updatedAt + ANALYTICS_REFRESH_INTERVAL_MS);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError("BetMate could not load the latest model analytics. Check your connection or the ML engine status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSport]);

  useEffect(() => {
    void loadAnalytics(true);
  }, [loadAnalytics]);

  const syncResults = async () => {
    setSyncingResults(true);
    setSyncMessage(null);
    try {
      const response = await fetch(`${ML_API}/api/predictions/results/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sports: ["afl", "nba"] }),
      });

      if (response.ok) {
        const data = await response.json();
        const { fetched, settled, errors } = data.ingestion || {};
        setSyncMessage(`Fetched ${fetched} results. Settled ${settled} predictions into history. ${errors?.length ? `(${errors.length} errors)` : ""}`);
        void loadAnalytics(false);
      } else {
        setSyncMessage("Failed to trigger result ingestion.");
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncMessage("Connection error during result sync.");
    } finally {
      setSyncingResults(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BarChart3 size={48} />
          <p>Loading model telemetry...</p>
        </div>
      </div>
    );
  }

  if (error && !models.length) {
    return (
      <div className="status-stack" style={{ padding: "2rem" }}>
        <ErrorState
          title="Telemetry board unavailable"
          message={error}
          tone="danger"
          actionLabel="Try again"
          onAction={() => void loadAnalytics()}
        />
      </div>
    );
  }

  const loadedModels = models.filter((model) => model.status === "loaded").length;
  const historicalModels = models.filter((model) => model.training_source?.includes("historical")).length;
  const totalRows = models.reduce((sum, model) => sum + (model.training_rows ?? 0), 0);
  const totalFeatures = models.reduce((sum, model) => sum + model.feature_count, 0);
  const settledEvents = accuracy?.settled_events ?? 0;
  const hitRate = accuracy?.hit_rate ?? 0;
  const sportOptions = ["all", "afl", "nba", "racing"];
  const filteredPredictionSummary = selectedSport === "all"
    ? predictionSummary
    : predictionSummary.filter((sport) => sport.sport === selectedSport);
  const loggedPredictions = filteredPredictionSummary.reduce((sum, sport) => sum + sport.prediction_count, 0);
  const filteredRecentPredictions = selectedSport === "all"
    ? recentPredictions
    : recentPredictions.filter((prediction) => prediction.sport === selectedSport);
  const calibrationChartData = (accuracy?.calibration ?? []).map((bucket) => ({
    bucket: bucket.bucket,
    predicted: roundPct(bucket.avg_predicted),
    observed: roundPct(bucket.observed_rate),
  }));
  const accuracyTrendData = accuracyTrend.map((point) => ({
    date: point.date.slice(5),
    hitRate: roundPct(point.hit_rate),
    paperRoi: roundPct(point.paper_roi),
    brierScore: point.brier_score,
    settledEvents: point.settled_events,
  }));
  const accuracyBySportData = (accuracy?.by_sport ?? []).map((sport) => ({
    name: formatFeatureName(sport.sport),
    hitRate: roundPct(sport.hit_rate),
    brierScore: sport.brier_score,
  }));
  const rowChartData = models.map((model) => ({
    name: model.name,
    rows: model.training_rows ?? 0,
  }));

  return (
    <ErrorBoundary sectionName="Analytics Board">
      <RefreshControls
        lastUpdated={lastUpdated}
        nextRefreshAt={nextRefreshAt}
        isRefreshing={refreshing}
        onRefresh={() => void loadAnalytics(false)}
      />

      <div className="section-header">
        <h3>Prediction Analytics</h3>
        <button
          className="btn btn-sm btn-secondary"
          type="button"
          onClick={syncResults}
          disabled={syncingResults}
        >
          {syncingResults ? (
            <>
              <RotateCw size={14} className="animate-spin" /> Syncing...
            </>
          ) : (
            "Sync Results"
          )}
        </button>
      </div>

      {syncMessage && (
        <div className="status-stack" style={{ marginBottom: "1.5rem" }}>
          <ErrorState
            title="Result sync update"
            message={syncMessage}
            tone={syncMessage.includes("Failed") ? "warning" : "info"}
            compact
          />
        </div>
      )}

      <div className="filter-bar">
        {sportOptions.map((sport) => (
          <button
            key={sport}
            className={`filter-chip ${selectedSport === sport ? "active" : ""}`}
            onClick={() => setSelectedSport(sport)}
            type="button"
          >
            {formatFeatureName(sport)}
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-label"><Activity size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Loaded Models</div>
          <div className="stat-value">{loadedModels}/{models.length}</div>
          <div className="stat-sub">Engine telemetry</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-label"><Database size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Training Rows</div>
          <div className="stat-value">{totalRows.toLocaleString("en-AU")}</div>
          <div className="stat-sub">{historicalModels} historical models</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label"><Target size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Features</div>
          <div className="stat-value">{totalFeatures}</div>
          <div className="stat-sub">Across {models.length} models</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Prediction Log</div>
          <div className="stat-value">{loggedPredictions.toLocaleString("en-AU")}</div>
          <div className="stat-sub">{filteredPredictionSummary.length} sports tracked</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Settled Events</div>
          <div className="stat-value">{settledEvents.toLocaleString("en-AU")}</div>
          <div className="stat-sub">{accuracy?.settled_predictions ?? 0} selections scored</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Top Pick Hit Rate</div>
          <div className="stat-value">{formatPct(hitRate)}</div>
          <div className="stat-sub">{accuracy?.top_pick_wins ?? 0} winning events</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Brier Score</div>
          <div className="stat-value">{formatDecimal(accuracy?.brier_score)}</div>
          <div className="stat-sub">Lower is better</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-label">Paper ROI</div>
          <div className="stat-value" style={{ color: (accuracy?.paper_profit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
            {formatPct(accuracy?.paper_roi ?? 0)}
          </div>
          <div className="stat-sub">{formatSignedCurrency(accuracy?.paper_profit ?? 0)} across {accuracy?.paper_bets ?? 0} top picks</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Artifacts</div>
          <div className="stat-value">{models.filter((model) => model.artifact_exists).length}</div>
          <div className="stat-sub">Saved model files</div>
        </div>
      </div>

      <div className="chart-container">
        <h4>Training Rows By Model</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rowChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
            <Bar dataKey="rows" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {accuracyBySportData.length > 0 && (
        <div className="chart-container">
          <h4>Accuracy By Sport</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={accuracyBySportData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="hitRate" name="Top pick hit rate %" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {accuracyTrendData.length > 0 && (
        <div className="chart-container">
          <h4>Top Pick Hit Rate Trend</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={accuracyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="hitRate" name="Hit rate %" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="paperRoi" name="Paper ROI %" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {calibrationChartData.length > 0 && (
        <div className="chart-container">
          <h4>Calibration Buckets</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={calibrationChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="predicted" name="Predicted %" fill="var(--blue)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="observed" name="Observed %" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {filteredRecentPredictions.length > 0 && (
        <div className="chart-container">
          <h4>Recent Prediction Log</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sport</th>
                  <th>Event</th>
                  <th>Selection</th>
                  <th>Probability</th>
                  <th>Fair Odds</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecentPredictions.map((prediction) => (
                  <tr key={prediction.id}>
                    <td>{formatFeatureName(prediction.sport)}</td>
                    <td>{prediction.event_name}</td>
                    <td>{prediction.selection}</td>
                    <td>{formatRawProbability(prediction.probability)}</td>
                    <td>{prediction.fair_odds ? `$${prediction.fair_odds.toFixed(2)}` : "-"}</td>
                    <td>{formatResultStatus(prediction.result_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredPredictionSummary.length > 0 && (
        <div className="chart-container">
          <h4>Logged Predictions By Sport</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={filteredPredictionSummary.map((sport) => ({
              name: formatFeatureName(sport.sport),
              predictions: sport.prediction_count,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="predictions" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="game-cards-list">
        {models.map((model) => {
          const maxImpact = Math.max(...Object.values(model.feature_impact), 0);
          return (
            <div key={model.name} className="game-prediction-card expanded">
              <div className="game-matchup-header">
                <div className="team-block favoured">
                  <span className="team-label">{model.model_type}</span>
                  <span className="team-name-lg">{model.name}</span>
                  <span className="team-prob-lg">{model.status === "loaded" ? "Loaded" : "Not loaded"}</span>
                </div>
                <div className="team-block">
                  <span className="team-label">Training Source</span>
                  <span className="team-name-lg">{formatFeatureName(model.training_source ?? "unknown")}</span>
                  <span className="team-odds">{(model.training_rows ?? 0).toLocaleString("en-AU")} rows</span>
                </div>
              </div>

              <div className="game-context-row">
                <span className="context-chip">Top feature: {formatFeatureName(model.top_feature ?? "pending")}</span>
                <span className="context-chip">{model.feature_count} features</span>
                <span className="context-chip">{model.artifact_exists ? "Artifact saved" : "Artifact pending"}</span>
              </div>

              <div className="feature-impact-section">
                <h4><BarChart3 size={16} /> Feature Impact</h4>
                <div className="feature-bars">
                  {Object.entries(model.feature_impact).length === 0 && (
                    <span className="feature-label">Feature impact will be available after the model loads.</span>
                  )}
                  {Object.entries(model.feature_impact)
                    .sort(([, a], [, b]) => b - a)
                    .map(([feature, importance]) => (
                      <div key={feature} className="feature-bar-row">
                        <span className="feature-label">{formatFeatureName(feature)}</span>
                        <div className="feature-bar-track">
                          <div
                            className="feature-bar-fill"
                            style={{ width: `${maxImpact > 0 ? (importance / maxImpact) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="feature-value">{(importance * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ErrorBoundary>
  );
}

function formatFeatureName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function roundPct(value: number): number {
  return Number((value * 100).toFixed(1));
}

function formatPct(value: number): string {
  return `${roundPct(value).toFixed(1)}%`;
}

function formatDecimal(value?: number | null): string {
  if (value === undefined || value === null) {
    return "0.000";
  }

  return value.toFixed(3);
}

function formatSignedCurrency(value: number): string {
  const formatted = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Math.abs(value));

  if (value === 0) {
    return formatted;
  }

  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function formatRawProbability(value: number): string {
  const probability = value > 1 ? value : value * 100;
  return `${probability.toFixed(1)}%`;
}

function formatResultStatus(status: string | null): string {
  if (!status) {
    return "Pending";
  }

  return formatFeatureName(status);
}
