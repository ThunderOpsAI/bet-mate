"use client";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Database, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ML_API = process.env.NEXT_PUBLIC_ML_API ?? "http://localhost:8000";

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
  latest_at: string | null;
  avg_probability: number;
};

export default function AnalyticsPage() {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [predictionSummary, setPredictionSummary] = useState<PredictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [metadataResponse, summaryResponse] = await Promise.all([
          fetch(`${ML_API}/api/models/metadata`),
          fetch(`${ML_API}/api/predictions/summary`).catch(() => null),
        ]);

        if (!metadataResponse.ok) {
          throw new Error("Model metadata unavailable");
        }

        const data = await metadataResponse.json();
        setModels(data?.models ?? []);
        if (summaryResponse?.ok) {
          const summaryData = await summaryResponse.json();
          setPredictionSummary(summaryData?.summary ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Model metadata unavailable");
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
          <BarChart3 size={48} />
          <p>Loading model telemetry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Activity size={48} /></div>
        <h4>Model telemetry unavailable</h4>
        <p>{error}</p>
      </div>
    );
  }

  const loadedModels = models.filter((model) => model.status === "loaded").length;
  const historicalModels = models.filter((model) => model.training_source?.includes("historical")).length;
  const totalRows = models.reduce((sum, model) => sum + (model.training_rows ?? 0), 0);
  const totalFeatures = models.reduce((sum, model) => sum + model.feature_count, 0);
  const loggedPredictions = predictionSummary.reduce((sum, sport) => sum + sport.prediction_count, 0);
  const rowChartData = models.map((model) => ({
    name: model.name,
    rows: model.training_rows ?? 0,
  }));

  return (
    <div>
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
          <div className="stat-sub">{predictionSummary.length} sports tracked</div>
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

      {predictionSummary.length > 0 && (
        <div className="chart-container">
          <h4>Logged Predictions By Sport</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={predictionSummary.map((sport) => ({
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
    </div>
  );
}

function formatFeatureName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
