"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Database,
  RotateCw,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import RefreshControls from "../components/RefreshControls";
import { ML_API } from "../lib/mlApi";
import { useAuth } from "../providers/AuthProvider";

type AnalyticsTab = "user" | "strategy" | "ml";

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

type PredictionMetadata = {
  probability: number | null;
  fair_odds: number | null;
  payload?: Record<string, unknown> | null;
};

type UserPaperBet = {
  id: number;
  created_at: string;
  settled_at: string | null;
  sport: string;
  event_id: string;
  event_name: string;
  selection: string;
  bet_type: string;
  odds: number;
  stake: number;
  status: string;
  payout: number | null;
  profit: number | null;
  notes: string | null;
  origin?: string;
  prediction?: PredictionMetadata | null;
};

type PaperBetSummary = {
  total_bets: number;
  pending_bets: number;
  settled_bets: number;
  won_bets: number;
  lost_bets: number;
  void_bets: number;
  total_staked: number;
  settled_staked: number;
  pending_exposure: number;
  total_returned: number;
  net_profit: number;
  roi: number;
  win_rate: number;
};

type PaperBetTrendPoint = {
  date: string;
  sport: string;
  settled_bets: number;
  decision_bets: number;
  settled_staked: number;
  total_returned: number;
  net_profit: number;
  roi: number;
  cumulative_staked: number;
  cumulative_profit: number;
  cumulative_roi: number;
};

type StrategyBet = {
  id?: number;
  profile_key?: string;
  sport: string;
  event_id: string;
  event_name: string;
  market_type: string;
  selection: string;
  odds_used: number;
  odds_source: string;
  edge: number;
  stake: number;
  status?: string;
  payout?: number | null;
  profit?: number | null;
  settled_at?: string | null;
  created_at?: string | null;
  sport_allocation?: Record<string, number>;
  legs?: Array<{
    sport: string;
    event_id: string;
    event_name: string;
    market_type: string;
    selection: string;
    odds_used: number;
    odds_source: string;
  }>;
};

type StrategyCard = {
  profile_key: string;
  display_name: string;
  card_date: string;
  bankroll_available: number;
  total_allocated: number;
  selected_bets: StrategyBet[];
  expected_edge: number;
  performance: {
    roi: number;
    net_profit: number;
    settled_bets: number;
    total_bets?: number;
  } | null;
};

const ANALYTICS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("user");
  const [mlSportFilter, setMlSportFilter] = useState("all");
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [predictionSummary, setPredictionSummary] = useState<PredictionSummary[]>([]);
  const [accuracy, setAccuracy] = useState<AccuracyMetrics | null>(null);
  const [accuracyTrend, setAccuracyTrend] = useState<AccuracyTrendPoint[]>([]);
  const [recentPredictions, setRecentPredictions] = useState<RecentPrediction[]>([]);
  const [userSummary, setUserSummary] = useState<PaperBetSummary | null>(null);
  const [userTrend, setUserTrend] = useState<PaperBetTrendPoint[]>([]);
  const [userBets, setUserBets] = useState<UserPaperBet[]>([]);
  const [strategyCards, setStrategyCards] = useState<StrategyCard[]>([]);
  const [strategyBets, setStrategyBets] = useState<StrategyBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingResults, setSyncingResults] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);

  const loadAnalytics = useCallback(
    async (showLoading = true, sportFilter = mlSportFilter) => {
      if (showLoading) setLoading(true);
      setRefreshing(true);
      setError(null);

      const authHeaders = { Authorization: `Bearer ${token || "guest"}` };
      const sportParam = sportFilter !== "all" ? `?sport=${sportFilter}` : "";

      const [
        metadataResult,
        summaryResult,
        accuracyResult,
        trendResult,
        recentResult,
        userBetsResult,
        userSummaryResult,
        userTrendResult,
        strategyCardsResult,
        strategyBetsResult,
      ] = await Promise.allSettled([
        fetchJson<{ models?: ModelMetadata[] }>(`${ML_API}/api/models/metadata`),
        fetchJson<{ summary?: PredictionSummary[] }>(`${ML_API}/api/predictions/summary`),
        fetchJson<{ accuracy?: AccuracyMetrics }>(`${ML_API}/api/predictions/accuracy${sportParam}`),
        fetchJson<{ trend?: AccuracyTrendPoint[] }>(`${ML_API}/api/predictions/accuracy/trend${sportParam}`),
        fetchJson<{ results?: RecentPrediction[] }>(`${ML_API}/api/predictions/results/recent?limit=100`),
        fetchJson<{ bets?: UserPaperBet[] }>(`${ML_API}/api/paper-bets?limit=200`, { headers: authHeaders }),
        fetchJson<{ summary?: PaperBetSummary }>(`${ML_API}/api/paper-bets/summary`, { headers: authHeaders }),
        fetchJson<{ trend?: PaperBetTrendPoint[] }>(`${ML_API}/api/paper-bets/trend?days=30`, { headers: authHeaders }),
        fetchJson<{ cards?: StrategyCard[] }>(`${ML_API}/api/strategy-cards`),
        fetchJson<{ bets?: StrategyBet[] }>(`${ML_API}/api/system-bets?limit=500`),
      ]);

      if (metadataResult.status === "fulfilled") {
        setModels(metadataResult.value.models ?? []);
      }
      if (summaryResult.status === "fulfilled") {
        setPredictionSummary(summaryResult.value.summary ?? []);
      }
      if (accuracyResult.status === "fulfilled") {
        setAccuracy(accuracyResult.value.accuracy ?? null);
      }
      if (trendResult.status === "fulfilled") {
        setAccuracyTrend(trendResult.value.trend ?? []);
      }
      if (recentResult.status === "fulfilled") {
        setRecentPredictions(recentResult.value.results ?? []);
      }
      if (userBetsResult.status === "fulfilled") {
        setUserBets(userBetsResult.value.bets ?? []);
      }
      if (userSummaryResult.status === "fulfilled") {
        setUserSummary(userSummaryResult.value.summary ?? null);
      }
      if (userTrendResult.status === "fulfilled") {
        setUserTrend(userTrendResult.value.trend ?? []);
      }
      if (strategyCardsResult.status === "fulfilled") {
        setStrategyCards(strategyCardsResult.value.cards ?? []);
      }
      if (strategyBetsResult.status === "fulfilled") {
        setStrategyBets(strategyBetsResult.value.bets ?? []);
      }

      const coreFailures = [
        metadataResult,
        summaryResult,
        accuracyResult,
        userSummaryResult,
        strategyCardsResult,
      ].every((result) => result.status === "rejected");

      if (coreFailures) {
        setError("BetMate could not load analytics right now. Check your connection or the ML engine status.");
      }

      const updatedAt = Date.now();
      setLastUpdated(updatedAt);
      setNextRefreshAt(updatedAt + ANALYTICS_REFRESH_INTERVAL_MS);
      setLoading(false);
      setRefreshing(false);
    },
    [mlSportFilter, token],
  );

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
        body: JSON.stringify({ sports: ["afl", "nba", "racing"] }),
      });

      if (!response.ok) {
        throw new Error("Failed to trigger result ingestion");
      }

      const data = await response.json();
      const { fetched, settled, errors } = data.ingestion || {};
      setSyncMessage(
        `Fetched ${fetched} results. Settled ${settled} predictions into history.${errors?.length ? ` (${errors.length} errors)` : ""}`,
      );
      void loadAnalytics(false);
    } catch (syncError) {
      console.error("Sync error:", syncError);
      setSyncMessage("Connection error during result sync.");
    } finally {
      setSyncingResults(false);
    }
  };

  const anyDataLoaded =
    models.length > 0 ||
    userBets.length > 0 ||
    strategyBets.length > 0 ||
    Boolean(userSummary) ||
    strategyCards.length > 0;

  const loadedModels = models.filter((model) => model.status === "loaded").length;
  const historicalModels = models.filter((model) => model.training_source?.includes("historical")).length;
  const totalRows = models.reduce((sum, model) => sum + (model.training_rows ?? 0), 0);
  const totalFeatures = models.reduce((sum, model) => sum + model.feature_count, 0);
  const settledEvents = accuracy?.settled_events ?? 0;
  const hitRate = accuracy?.hit_rate ?? 0;
  const filteredPredictionSummary =
    mlSportFilter === "all"
      ? predictionSummary
      : predictionSummary.filter((sport) => sport.sport === mlSportFilter);
  const loggedPredictions = filteredPredictionSummary.reduce(
    (sum, sport) => sum + sport.prediction_count,
    0,
  );
  const filteredRecentPredictions =
    mlSportFilter === "all"
      ? recentPredictions
      : recentPredictions.filter((prediction) => prediction.sport === mlSportFilter);
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

  const userSportSummary = useMemo(() => buildUserSportSummary(userBets), [userBets]);
  const userSourceSummary = useMemo(() => buildUserSourceSummary(userBets), [userBets]);
  const userTrendData = userTrend.map((point) => ({
    date: point.date.slice(5),
    dailyProfit: point.net_profit,
    cumulativeProfit: point.cumulative_profit,
  }));

  const strategySummary = useMemo(() => buildStrategySummary(strategyBets), [strategyBets]);
  const strategyByProfile = useMemo(
    () =>
      strategyCards.map((card) => ({
        name: card.display_name,
        allocated: card.total_allocated,
        expectedEdge: Number((card.expected_edge * 100).toFixed(1)),
        roi: Number((((card.performance?.roi ?? 0) || 0) * 100).toFixed(1)),
        settledBets: card.performance?.settled_bets ?? 0,
      })),
    [strategyCards],
  );

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BarChart3 size={48} />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error && !anyDataLoaded) {
    return (
      <div className="status-stack" style={{ padding: "2rem" }}>
        <ErrorState
          title="Analytics unavailable"
          message={error}
          tone="danger"
          actionLabel="Try again"
          onAction={() => void loadAnalytics()}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary sectionName="Analytics">
      <RefreshControls
        lastUpdated={lastUpdated}
        nextRefreshAt={nextRefreshAt}
        isRefreshing={refreshing}
        onRefresh={() => void loadAnalytics(false)}
      />

      <div className="section-header">
        <h3>Analytics</h3>
        {activeTab === "ml" ? (
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
        ) : null}
      </div>

      {syncMessage ? (
        <div className="status-stack" style={{ marginBottom: "1.5rem" }}>
          <ErrorState
            title="Result sync update"
            message={syncMessage}
            tone={syncMessage.includes("error") ? "warning" : "info"}
            compact
          />
        </div>
      ) : null}

      <div className="filter-bar" role="tablist" aria-label="Analytics tabs">
        {([
          { id: "user", label: "User" },
          { id: "strategy", label: "Strategy" },
          { id: "ml", label: "ML" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`filter-chip ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "user" ? (
        <>
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label"><Wallet size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Bankroll Entries</div>
              <div className="stat-value">{userSummary?.total_bets ?? 0}</div>
              <div className="stat-sub">{userSummary?.pending_bets ?? 0} active bets</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Settled Stake</div>
              <div className="stat-value">{formatCurrency(userSummary?.settled_staked ?? 0)}</div>
              <div className="stat-sub">{formatCurrency(userSummary?.pending_exposure ?? 0)} pending exposure</div>
            </div>
            <div className={`stat-card ${(userSummary?.net_profit ?? 0) >= 0 ? "green" : "red"}`}>
              <div className="stat-label"><TrendingUp size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Net Profit</div>
              <div className="stat-value">{formatSignedCurrency(userSummary?.net_profit ?? 0)}</div>
              <div className="stat-sub">{formatPct(userSummary?.roi ?? 0)} ROI</div>
            </div>
            <div className="stat-card yellow">
              <div className="stat-label">Win Rate</div>
              <div className="stat-value">{formatPct(userSummary?.win_rate ?? 0)}</div>
              <div className="stat-sub">{userSummary?.won_bets ?? 0}W / {userSummary?.lost_bets ?? 0}L / {userSummary?.void_bets ?? 0}V</div>
            </div>
          </div>

          {userTrendData.length > 0 ? (
            <div className="chart-container">
              <h4>Bankroll Trend</h4>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={userTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="dailyProfit" name="Daily profit" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="cumulativeProfit" name="Cumulative profit" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {userSportSummary.length > 0 ? (
            <div className="chart-container">
              <h4>User Results By Sport</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={userSportSummary}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="bets" name="Bets" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {userSourceSummary.length > 0 ? (
            <div className="chart-container">
              <h4>Bankroll Source Mix</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={userSourceSummary}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="bets" name="Bets" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {userBets.length > 0 ? (
            <div className="chart-container">
              <h4>Recent Bankroll History</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Selection</th>
                      <th>Sport</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Stake</th>
                      <th>P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userBets.slice(0, 20).map((bet) => {
                      const source = getBetSource(bet);
                      return (
                        <tr key={bet.id}>
                          <td>{new Date(bet.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td>{bet.selection}<br /><span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{bet.event_name}</span></td>
                          <td>{formatFeatureName(bet.sport)}</td>
                          <td>{source.label}</td>
                          <td>{bet.status}</td>
                          <td>{formatCurrency(bet.stake)} @ {bet.odds.toFixed(2)}</td>
                          <td style={{ color: (bet.profit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                            {bet.profit == null ? "-" : formatSignedCurrency(bet.profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <p className="muted-copy">No bankroll history yet. Log bets from Racing, AFL, NBA, or Strategy to build your user analytics.</p>
            </div>
          )}
        </>
      ) : null}

      {activeTab === "strategy" ? (
        <>
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Strategy Bets</div>
              <div className="stat-value">{strategySummary.totalBets}</div>
              <div className="stat-sub">{strategySummary.pendingBets} pending</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Allocated</div>
              <div className="stat-value">{formatCurrency(strategySummary.totalStaked)}</div>
              <div className="stat-sub">{strategyCards.length} active cards</div>
            </div>
            <div className={`stat-card ${strategySummary.netProfit >= 0 ? "green" : "red"}`}>
              <div className="stat-label">Strategy P&amp;L</div>
              <div className="stat-value">{formatSignedCurrency(strategySummary.netProfit)}</div>
              <div className="stat-sub">{formatPct(strategySummary.roi)} ROI</div>
            </div>
            <div className="stat-card yellow">
              <div className="stat-label">Settled Strategy Bets</div>
              <div className="stat-value">{strategySummary.settledBets}</div>
              <div className="stat-sub">{strategySummary.wonBets}W / {strategySummary.lostBets}L / {strategySummary.voidBets}V</div>
            </div>
          </div>

          {strategyByProfile.length > 0 ? (
            <div className="chart-container">
              <h4>Strategy Profiles</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={strategyByProfile}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="allocated" name="Allocated stake" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="roi" name="ROI %" fill="var(--green)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {strategyCards.length > 0 ? (
            <div className="chart-container">
              <h4>Current Strategy Cards</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Profile</th>
                      <th>Date</th>
                      <th>Selections</th>
                      <th>Allocated</th>
                      <th>Expected Edge</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategyCards.map((card) => (
                      <tr key={card.profile_key}>
                        <td>{card.display_name}</td>
                        <td>{card.card_date}</td>
                        <td>{card.selected_bets.length}</td>
                        <td>{formatCurrency(card.total_allocated)}</td>
                        <td>{formatPct(card.expected_edge)}</td>
                        <td>{card.performance ? `${formatSignedCurrency(card.performance.net_profit)} (${formatPct(card.performance.roi)})` : "Pending"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {strategyBets.length > 0 ? (
            <div className="chart-container">
              <h4>Recent Strategy Bet Log</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Profile</th>
                      <th>Selection</th>
                      <th>Sport</th>
                      <th>Market</th>
                      <th>Status</th>
                      <th>Stake</th>
                      <th>P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategyBets.slice(0, 20).map((bet, index) => (
                      <tr key={`${bet.profile_key ?? "strategy"}-${bet.event_id}-${bet.selection}-${index}`}>
                        <td>{formatFeatureName(bet.profile_key ?? "strategy")}</td>
                        <td>{bet.selection}<br /><span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{bet.event_name}</span></td>
                        <td>{formatFeatureName(bet.sport)}</td>
                        <td>{formatFeatureName(bet.market_type)}</td>
                        <td>{formatFeatureName(bet.status ?? "pending")}</td>
                        <td>{formatCurrency(bet.stake)} @ {bet.odds_used.toFixed(2)}</td>
                        <td style={{ color: (bet.profit ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                          {bet.profit == null ? "-" : formatSignedCurrency(bet.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <p className="muted-copy">No strategy bet history is available yet. Once strategy cards generate, their selections will appear here.</p>
            </div>
          )}
        </>
      ) : null}

      {activeTab === "ml" ? (
        <>
          <div className="filter-bar">
            {["all", "afl", "nba", "racing"].map((sport) => (
              <button
                key={sport}
                className={`filter-chip ${mlSportFilter === sport ? "active" : ""}`}
                onClick={() => setMlSportFilter(sport)}
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

          {accuracyBySportData.length > 0 ? (
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
          ) : null}

          {accuracyTrendData.length > 0 ? (
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
          ) : null}

          {calibrationChartData.length > 0 ? (
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
          ) : null}

          {filteredRecentPredictions.length > 0 ? (
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
          ) : null}

          {filteredPredictionSummary.length > 0 ? (
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
          ) : null}

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
                      {Object.entries(model.feature_impact).length === 0 ? (
                        <span className="feature-label">Feature impact will be available after the model loads.</span>
                      ) : null}
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
        </>
      ) : null}
    </ErrorBoundary>
  );
}

function buildUserSportSummary(bets: UserPaperBet[]) {
  const groups = new Map<string, { name: string; bets: number; stake: number; profit: number }>();

  bets.forEach((bet) => {
    const key = bet.sport;
    const existing = groups.get(key) ?? {
      name: formatFeatureName(key),
      bets: 0,
      stake: 0,
      profit: 0,
    };

    existing.bets += 1;
    existing.stake += bet.stake;
    existing.profit += bet.profit ?? 0;
    groups.set(key, existing);
  });

  return Array.from(groups.values()).sort((a, b) => b.bets - a.bets);
}

function buildUserSourceSummary(bets: UserPaperBet[]) {
  const groups = new Map<string, { name: string; bets: number }>();

  bets.forEach((bet) => {
    const source = getBetSource(bet);
    const existing = groups.get(source.kind) ?? { name: source.label, bets: 0 };
    existing.bets += 1;
    groups.set(source.kind, existing);
  });

  return Array.from(groups.values()).sort((a, b) => b.bets - a.bets);
}

function buildStrategySummary(bets: StrategyBet[]) {
  const totalBets = bets.length;
  const pendingBets = bets.filter((bet) => (bet.status ?? "pending").toLowerCase() === "pending").length;
  const settled = bets.filter((bet) => (bet.status ?? "pending").toLowerCase() !== "pending");
  const wonBets = bets.filter((bet) => (bet.status ?? "").toLowerCase() === "won").length;
  const lostBets = bets.filter((bet) => (bet.status ?? "").toLowerCase() === "lost").length;
  const voidBets = bets.filter((bet) => (bet.status ?? "").toLowerCase() === "void").length;
  const totalStaked = bets.reduce((sum, bet) => sum + bet.stake, 0);
  const netProfit = settled.reduce((sum, bet) => sum + (bet.profit ?? 0), 0);

  return {
    totalBets,
    pendingBets,
    settledBets: settled.length,
    wonBets,
    lostBets,
    voidBets,
    totalStaked,
    netProfit,
    roi: totalStaked > 0 ? netProfit / totalStaked : 0,
  };
}

function getBetSource(bet: UserPaperBet) {
  const origin = (bet.origin ?? "user").toLowerCase();
  const notes = parseNotes(bet.notes);
  if (origin.includes("strategy") || (notes && typeof notes.strategy_name === "string")) {
    return { label: "Strategy Copy", kind: "strategy_copy" as const };
  }
  return { label: "Manual", kind: "manual" as const };
}

function parseNotes(notes: string | null) {
  if (!notes) return null;
  if (!notes.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function formatFeatureName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function roundPct(value: number): number {
  return Number((value * 100).toFixed(1));
}

function formatPct(value: number): string {
  return `${roundPct(value).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

function formatDecimal(value?: number | null): string {
  if (value === undefined || value === null) {
    return "0.000";
  }
  return value.toFixed(3);
}

function formatSignedCurrency(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
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
