"use client";
import { useMemo, useState } from "react";
import { Activity, ChevronDown, Compass, BarChart3, Layers, Plus, Sparkles, ShieldAlert } from "lucide-react";
import RunnerRow, { type RunnerPrediction } from "./RunnerRow";
import PaperBetAction from "../PaperBetAction";
import SectionalMetricsDrawer from "./SectionalMetricsDrawer";
import SpeedMapVisualization from "./SpeedMapVisualization";
import RacingRunnerDrawer from "./RacingRunnerDrawer";
import QuaddiePlannerModal from "./QuaddiePlannerModal";
import { ConfidenceBadge, UrgencyBadge } from "../PredictionSignalBadges";
import { getEdgePercent } from "../../lib/opportunityScore";
import { getConfidenceSignal, getUrgencySignal } from "../../lib/predictionSignals";
import type { BobExplanation, FeatureImpactItem, ModelMetadata } from "../../lib/bob/explainer";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import { ML_API } from "../../lib/mlApi";

type HorseData = {
  horse_id: string;
  name: string;
  barrier: number;
  weight: number;
  past_win_rate?: number;
  jockey_win_rate?: number;
  track_condition?: number;
  days_since_last_race?: number;
  betfair_back_price?: number;
  betfair_place_price?: number;
  betfair_implied_prob?: number;
  jockey_name?: string | null;
  trainer_name?: string | null;
  data_source?: "betfair" | "racing_australia";
  sectional_data?: any;
  settling_position?: "leader" | "on_pace" | "midfield" | "backmarker";
  wide_position?: 1 | 2 | 3;
  early_speed_score?: number;
};

type Prediction = {
  horse_id: string;
  name: string;
  win_probability: number;
  fair_odds: number;
};

type RacePrediction = {
  race_id: string;
  predictions: Prediction[];
  feature_impact?: FeatureImpactItem[] | Record<string, number>;
  ai_insights_context?: { data_quality?: "strong" | "moderate" | "thin"; calibration_confidence?: number; market_agreement?: boolean; notes?: string[] } | string;
  model_metadata?: ModelMetadata;
};

interface RaceData {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  start_time?: string;
  meeting_type?: string;
  meeting_region?: string;
  meeting_date?: string;
  horses: HorseData[];
  predicted_pace?: "Fast" | "Moderate" | "Slow" | "Extreme";
}

interface SingleRaceCardProps {
  race: RaceData;
  prediction?: RacePrediction | null;
  siblingRaces: { race_id: string; race_number: number }[];
  onSwitchRace: (raceId: string) => void;
  onExplain: (explanation: BobExplanation) => void;
}

const trackConditions: Record<number, string> = { 1: "Fast", 2: "Good", 3: "Soft", 4: "Heavy" };

export default function SingleRaceCard({ race, prediction, siblingRaces, onSwitchRace }: SingleRaceCardProps) {
  const [activeTab, setActiveTab] = useState<"win" | "multi" | "exotics" | "speed_map">("win");
  const [openSectionalRunnerIds, setOpenSectionalRunnerIds] = useState<Record<string, boolean>>({});
  const [drawerRunner, setDrawerRunner] = useState<{ horse: HorseData; prediction: RunnerPrediction | null } | null>(null);
  const [isQuaddieModalOpen, setIsQuaddieModalOpen] = useState(false);

  const { addBet, addToast } = usePaperBetslip();
  const [srmSelections, setSrmSelections] = useState<Record<string, "win" | "top2" | "top3" | "top4">>({});

  const toggleSrmSelection = (horseId: string, position: "win" | "top2" | "top3" | "top4") => {
    setSrmSelections((prev) => {
      const next = { ...prev };
      if (next[horseId] === position) {
        delete next[horseId];
      } else {
        next[horseId] = position;
      }
      return next;
    });
  };

  const selectedSrmCount = Object.keys(srmSelections).length;

  const [isPricingSrm, setIsPricingSrm] = useState(false);

  const handleAddSrmToSlip = async () => {
    if (selectedSrmCount < 2 || isPricingSrm) return;
    const legDescriptions = Object.entries(srmSelections).map(([id, pos]) => {
      const horseName = race.horses.find((h) => h.horse_id === id)?.name || id;
      const posLabel = pos === "win" ? "Win (1st)" : pos === "top2" ? "Top 2" : pos === "top3" ? "Top 3" : "Top 4";
      return `${horseName} ${posLabel}`;
    });

    const runners = race.horses.map((h) => ({
      runner_id: h.horse_id,
      name: h.name,
      win_price: h.betfair_back_price,
      win_probability: prediction?.predictions.find((p) => p.horse_id === h.horse_id)?.win_probability,
    }));

    let pricing: { adjusted_odds: number; input_source: "LADBROKES" | "MODEL"; fallback_reason?: string | null } | null = null;
    setIsPricingSrm(true);
    try {
      const res = await fetch(`${ML_API}/api/racing/srm/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue: race.venue,
          race_number: race.race_number,
          legs: Object.entries(srmSelections).map(([runner_id, position]) => ({ runner_id, position })),
          runners,
        }),
      });
      if (res.ok) pricing = await res.json();
    } catch {
      pricing = null;
    } finally {
      setIsPricingSrm(false);
    }

    const estimate = pricing && pricing.adjusted_odds > 1 ? Number(pricing.adjusted_odds.toFixed(2)) : undefined;

    addBet({
      sport: "racing",
      event_id: race.race_id,
      event_name: `${race.venue} R${race.race_number} SRM`,
      selection_id: `srm-${race.race_id}`,
      selection: legDescriptions.join(" + "),
      runner_name: legDescriptions.join(" + "),
      // Actual bookmaker SRM price must be entered by the user; estimate is shown separately.
      odds: undefined,
      model_fair_odds: estimate,
      bet_type: "srm",
      bet_family: "srm",
      stake: 10,
      odds_source: estimate ? "model_fair" : "missing",
      srm_input_source: pricing?.input_source,
      srm_fallback_reason: pricing?.fallback_reason ?? null,
      is_unavailable: !estimate,
      unavailable_reason: estimate ? undefined : "No live or model prices available to estimate this Same Race Multi.",
      event_start_time: race.start_time,
      event_date: race.meeting_date,
      notes: `Same Race Multi (${selectedSrmCount} legs) - est. ${estimate ?? "n/a"} via ${pricing?.input_source ?? "none"}`,
    });
    addToast(
      estimate
        ? `Added ${selectedSrmCount}-Leg SRM (est. $${estimate}${pricing?.input_source === "MODEL" ? ", model only" : ""})`
        : `Added ${selectedSrmCount}-Leg SRM selection (pricing unavailable)`,
      "info",
    );
    setSrmSelections({});
  };

  const sorted = [...siblingRaces].sort((a, b) => a.race_number - b.race_number);
  const trackCond = race.horses[0]?.track_condition;
  const confidenceSignal = prediction ? getConfidenceSignal(prediction.ai_insights_context) : null;
  const urgencySignal = getUrgencySignal({ startTime: race.start_time, eventDate: race.meeting_date });

  const toggleSectionalDrawer = (horseId: string) => {
    setOpenSectionalRunnerIds((prev) => ({
      ...prev,
      [horseId]: !prev[horseId],
    }));
  };

  return (
    <div className="single-race-card">
      {/* Race switcher bar */}
      <div className="race-switcher-bar">
        {sorted.map((r) => (
          <button
            key={r.race_id}
            type="button"
            className={`race-switcher-chip ${r.race_id === race.race_id ? "active" : ""}`}
            onClick={() => onSwitchRace(r.race_id)}
          >
            R{r.race_number}
          </button>
        ))}
      </div>

      {/* Race info header */}
      <div className="single-race-info">
        <h3 className="single-race-title">
          {race.venue} — Race {race.race_number}
        </h3>
        <div className="single-race-badges">
          <span className="badge badge-accent">{race.distance}m</span>
          {trackCond ? <span className="badge badge-blue">{trackConditions[trackCond] ?? "Good"}</span> : null}
          <span className="badge badge-muted">{race.horses.length} runners</span>
          {race.meeting_type && race.meeting_type !== "unknown" ? (
            <span className="badge badge-green">{race.meeting_type.toUpperCase()}</span>
          ) : null}
          {confidenceSignal ? <ConfidenceBadge signal={confidenceSignal} /> : null}
          {urgencySignal ? <UrgencyBadge signal={urgencySignal} /> : null}
        </div>
      </div>

      {/* Betting & Speed Map tabs */}
      <div className="race-bet-tabs">
        <button type="button" className={`race-bet-tab ${activeTab === "win" ? "active" : ""}`} onClick={() => setActiveTab("win")}>
          Win / Place
        </button>
        <button type="button" className={`race-bet-tab ${activeTab === "multi" ? "active" : ""}`} onClick={() => setActiveTab("multi")}>
          Same Race Multi (SRM)
        </button>
        <button type="button" className={`race-bet-tab ${activeTab === "exotics" ? "active" : ""}`} onClick={() => setActiveTab("exotics")}>
          Exotics & Quaddie
        </button>
        <button type="button" className={`race-bet-tab ${activeTab === "speed_map" ? "active" : ""}`} onClick={() => setActiveTab("speed_map")}>
          <span className="inline-flex items-center gap-1.5">
            <Compass size={14} className="text-purple-400" />
            Speed Map
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === "win" ? (
        <div className="runner-list flex flex-col gap-3">
          <div className="hidden md:flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/50 rounded-lg border border-slate-800/60">
            <span>Runner</span>
            <div className="flex items-center gap-12 pr-2">
              <span className="w-16 text-center">Win</span>
              <span className="w-16 text-center">Place</span>
            </div>
          </div>
          {(prediction?.predictions ?? race.horses.map((h) => ({ horse_id: h.horse_id, name: h.name, win_probability: 0, fair_odds: 0 }))).map((pick, index) => {
            const horse = race.horses.find((h) => h.horse_id === pick.horse_id);
            const isDrawerOpen = Boolean(openSectionalRunnerIds[pick.horse_id]);

            return (
              <div key={pick.horse_id} className="runner-card-container flex flex-col">
                <div className="flex flex-col">
                  <RunnerRow
                    horse={horse}
                    prediction={pick}
                    index={index}
                    hasTopPrediction={Boolean(prediction)}
                    race={race}
                  />

                  {/* Expandable "Sectionals & Speed" and "Deep Stats" buttons */}
                  <div className="flex justify-end items-center gap-2 px-2 py-1 bg-slate-950/40 border-x border-b border-slate-800/80 rounded-b-md">
                    <button
                      type="button"
                      onClick={() => horse && setDrawerRunner({ horse, prediction: pick.fair_odds > 0 ? pick : null })}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
                      title="Open Deep Stats & Quant Analysis"
                    >
                      <BarChart3 size={13} className="text-emerald-400" />
                      <span>Deep Stats</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSectionalDrawer(pick.horse_id)}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        isDrawerOpen
                          ? "bg-purple-950/80 text-purple-300 border border-purple-500/40"
                          : "text-slate-400 hover:text-purple-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <Activity size={13} className="text-purple-400" />
                      <span>Sectionals & Speed</span>
                      <ChevronDown size={13} className={`transition-transform duration-200 ${isDrawerOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Sectional Metrics Drawer rendered beneath runner row */}
                {isDrawerOpen && (
                  <SectionalMetricsDrawer horse={horse} />
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab === "speed_map" ? (
        <SpeedMapVisualization race={race} />
      ) : activeTab === "exotics" ? (
        <div className="p-6 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
            <Layers size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100">
              {race.venue} Multi-Race Exotics & Quaddie Planner
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Plan your 4-leg Quaddie with automated combination counting, flexi stake calculation, and joint model win probability.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsQuaddieModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-lg shadow-purple-900/30 inline-flex items-center gap-2"
          >
            <Layers size={14} />
            <span>Launch Quaddie Planner</span>
          </button>
        </div>
      ) : (
        <div className="srm-builder flex flex-col gap-4 p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Same Race Multi (SRM) Builder
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Combine 2 or more finishing positions in {race.venue} R{race.race_number}.
              </p>
            </div>
            {selectedSrmCount >= 2 ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-amber-400 block uppercase">Pricing Status</span>
                  <span className="text-xs font-bold text-slate-300">Market Odds Unavailable</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSrmToSlip}
                  disabled={isPricingSrm}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-wait text-white transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{isPricingSrm ? "Pricing SRM…" : "Add Selections to Slip"}</span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-purple-300/80 bg-purple-950/40 border border-purple-500/20 px-3 py-1.5 rounded-lg">
                Select 2+ runner positions below
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
            <ShieldAlert size={16} className="shrink-0 text-amber-400" />
            <span>
              Provider-backed Same Race Multi pricing is currently unavailable for this race. You can track multi-runner combinations in your slip, but unpriced selections cannot be logged as placed bets.
            </span>
          </div>

          {race.horses.length < 2 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
              Same Race Multi is unavailable for races with fewer than 2 runners.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 flex flex-col gap-1">
              {race.horses.map((horse) => {
                const pred = prediction?.predictions?.find((p) => p.horse_id === horse.horse_id);
                const currentPos = srmSelections[horse.horse_id];

                return (
                  <div key={horse.horse_id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {horse.barrier}
                      </span>
                      <span className="text-xs font-bold text-slate-200 truncate">{horse.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(["win", "top2", "top3", "top4"] as const).map((pos) => {
                        const isSelected = currentPos === pos;
                        const label = pos === "win" ? "Win" : pos === "top2" ? "Top 2" : pos === "top3" ? "Top 3" : "Top 4";
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => toggleSrmSelection(horse.horse_id, pos)}
                            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-purple-600 text-white border-purple-400 shadow-sm"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <QuaddiePlannerModal
        isOpen={isQuaddieModalOpen}
        onClose={() => setIsQuaddieModalOpen(false)}
        venue={race.venue}
        races={[
          {
            race_id: race.race_id,
            race_number: race.race_number,
            venue: race.venue,
            distance: race.distance,
            start_time: race.start_time,
            runners: race.horses.map((h, i) => {
              const pred = prediction?.predictions?.find((p) => p.horse_id === h.horse_id);
              return {
                horse_id: h.horse_id,
                name: h.name,
                barrier: h.barrier,
                modelRank: pred && prediction?.predictions ? (prediction.predictions.findIndex((p) => p.horse_id === h.horse_id) + 1) : i + 1,
                winProbability: pred ? pred.win_probability : h.betfair_back_price ? (1 / h.betfair_back_price) : 0,
                fairOdds: pred?.fair_odds,
                marketOdds: h.betfair_back_price,
                edgePercent: pred && h.betfair_back_price ? getEdgePercent(pred.fair_odds, h.betfair_back_price) : null,
              };
            }),
          },
        ]}
      />

      <RacingRunnerDrawer
        isOpen={drawerRunner !== null}
        onClose={() => setDrawerRunner(null)}
        horse={drawerRunner?.horse ?? null}
        prediction={drawerRunner?.prediction ?? null}
        race={race}
      />
    </div>
  );
}
