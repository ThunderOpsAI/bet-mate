"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Flame,
  Shield,
  Target,
  AlertTriangle,
  Sparkles,
  Plus,
  Check,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  Zap,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../lib/api";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { AwaitingFeed, NoData } from "../../components/common/EmptyStates";
import OnboardingModal from "../../components/onboarding/OnboardingModal";

interface AlertItem {
  id: string;
  sport: string;
  targetType: string;
  targetId: string;
  title: string;
  message: string;
  impactJson?: {
    status?: string;
    repriceFactor?: number;
    usageShiftPct?: number;
    teamName?: string;
    injuryDetail?: string;
  };
  createdAt: string;
}

interface BobsMultiLeg {
  sport: string;
  selection: string;
  odds: number;
  market_type?: string;
  edge_pct?: number;
  calibrated_prob?: number;
  event_id?: string;
  event_name?: string;
}

interface BobsMultiItem {
  title: string;
  badge: string;
  risk_profile: string;
  actual_odds: number;
  combined_edge_pct: number;
  health_grade: string;
  health_score: number;
  leg_count: number;
  bob_rationale?: string;
  kelly_recommendation?: {
    recommended_stake: number;
    recommended_fraction: number;
  };
  legs: BobsMultiLeg[];
}

interface LiveEventItem {
  id: string;
  name: string;
  sport: string;
  startTime: string; // ISO date
  venue?: string;
  type: "RACE" | "GAME";
}

export default function TodayDashboardPage() {
  const { addBet, setIsBetslipOpen, addToast } = usePaperBetslip();

  const [loading, setLoading] = useState(true);
  const [bobsMultis, setBobsMultis] = useState<BobsMultiItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [events, setEvents] = useState<LiveEventItem[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(true);
  const [addedMultis, setAddedMultis] = useState<Record<string, boolean>>({});

  // Real-time clock tick for lockout countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Check user preferences
      const prefRes = await fetch(`${API_BASE}/user-preferences`).catch(() => null);
      if (prefRes && prefRes.ok) {
        const prefJson = await safeResponseJson(prefRes);
        if (prefJson && prefJson.onboarded === false) {
          setHasPreferences(false);
        }
      }

      // 2. Load alerts
      const alertsRes = await fetch(`${API_BASE}/alerts`).catch(() => null);
      if (alertsRes && alertsRes.ok) {
        const alertsJson = await safeResponseJson(alertsRes);
        if (alertsJson && Array.isArray(alertsJson.alerts)) {
          setAlerts(alertsJson.alerts);
        }
      }

      // 3. Load Bob's daily multis
      const bobsRes = await fetch(`${API_BASE}/recommendations/bobs-daily`).catch(() => null);
      if (bobsRes && bobsRes.ok) {
        const bobsJson = await safeResponseJson(bobsRes);
        if (bobsJson && Array.isArray(bobsJson.multis)) {
          setBobsMultis(bobsJson.multis);
        }
      }

      // 4. Load upcoming events for lockout countdowns
      const eventsRes = await fetch(`${API_BASE}/events?limit=8`).catch(() => null);
      if (eventsRes && eventsRes.ok) {
        const eventsJson = await safeResponseJson(eventsRes);
        if (eventsJson && Array.isArray(eventsJson.events)) {
          setEvents(eventsJson.events);
        }
      } else {
        // Fallback to races endpoint
        const racesRes = await fetch(`${API_BASE}/races?limit=6`).catch(() => null);
        if (racesRes && racesRes.ok) {
          const racesJson = await safeResponseJson(racesRes);
          if (racesJson && Array.isArray(racesJson.races)) {
            const formatted: LiveEventItem[] = racesJson.races.map((r: any) => ({
              id: r.id || r.raceId,
              name: `${r.venue || "Track"} R${r.raceNumber || 1}`,
              sport: "RACING",
              startTime: r.jumpTime || r.startTime || new Date(Date.now() + 25 * 60 * 1000).toISOString(),
              venue: r.venue,
              type: "RACE",
            }));
            setEvents(formatted);
          }
        }
      }
    } catch (err) {
      console.error("Error loading Today hub data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddMultiToSlip = (multi: BobsMultiItem) => {
    if (!multi.legs || multi.legs.length === 0) return;

    multi.legs.forEach((leg) => {
      addBet({
        sport: (leg.sport || "sport").toLowerCase(),
        event_id: leg.event_id || `ev-${Date.now()}`,
        event_name: leg.event_name || leg.selection,
        bet_type: leg.market_type || "Multi Leg",
        selection: leg.selection,
        odds: Number(leg.odds) || 1.85,
        stake: 10,
        odds_source: "market",
      });
    });

    setAddedMultis((prev) => ({ ...prev, [multi.title]: true }));
    setIsBetslipOpen(true);
    addToast(`Added ${multi.title} (${multi.legs.length} legs) to Bet Slip!`, "success");
  };

  const formatLockoutTimer = (targetIso: string) => {
    const targetMs = new Date(targetIso).getTime();
    if (isNaN(targetMs)) return { label: "TBD", urgency: "normal", secondsLeft: 99999 };

    const diff = Math.floor((targetMs - now) / 1000);
    if (diff <= 0) return { label: "STARTED", urgency: "closed", secondsLeft: 0 };

    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;

    let text = "";
    if (hours > 0) {
      text = `${hours}h ${mins}m`;
    } else {
      text = `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
    }

    let urgency: "critical" | "warning" | "normal" = "normal";
    if (diff < 900) urgency = "critical"; // < 15 mins
    else if (diff < 3600) urgency = "warning"; // < 1 hour

    return { label: text, urgency, secondsLeft: diff };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-in">
      {/* Onboarding Trigger Banner */}
      {!hasPreferences && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/60 border border-cyan-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-cyan-950/20">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-0.5">Personalize Your BetMate Flow</h3>
              <p className="text-xs text-slate-300">
                Choose your favourite leagues, teams, and risk tolerance for custom multi building.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-colors shrink-0 shadow-md"
          >
            <span>Set Preferences</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-wider uppercase mb-1">
            <Calendar className="w-4 h-4" />
            <span>Today&apos;s Curated Flow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Day-Ahead Hub &amp; Live Lockouts
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/bets/multi-builder"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Custom Multi Builder</span>
          </Link>
          <Link
            href="/track-record"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Model Track Record</span>
          </Link>
        </div>
      </div>

      {/* Injury & Lineup Alerts Banner / Ticker (Item 25) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Injury &amp; Lineup Alerts (Re-pricing Impacts)
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {alerts.length} active alerts
          </span>
        </div>

        {alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map((alert) => {
              const impact = alert.impactJson;
              return (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/80">
                        {alert.sport}
                      </span>
                      {impact?.status && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/80">
                          {impact.status}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1 leading-snug">{alert.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {alert.message}
                    </p>
                  </div>

                  {impact?.repriceFactor && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Model Reprice Shift:</span>
                      <span className="font-bold text-cyan-400 font-mono">
                        {((impact.repriceFactor - 1) * 100).toFixed(1)}% Line Move
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Zero critical lineup conflicts or injury voids currently logged. All rosters clear.</span>
          </div>
        )}
      </section>

      {/* Lockout Countdowns & Tip-off Reminders (Item 74) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Lockout Countdowns (Jump &amp; Tip-off Reminders)
            </h2>
          </div>
          <span className="text-xs text-slate-400">Updates in real-time</span>
        </div>

        {events.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {events.map((ev) => {
              const timer = formatLockoutTimer(ev.startTime);
              return (
                <div
                  key={ev.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                    timer.urgency === "critical"
                      ? "bg-rose-950/20 border-rose-800/80 shadow-md shadow-rose-950/30"
                      : timer.urgency === "warning"
                      ? "bg-amber-950/15 border-amber-800/60"
                      : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {ev.sport}
                      </span>
                      {timer.urgency === "critical" && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white truncate mb-2" title={ev.name}>
                      {ev.name}
                    </h4>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Lockout</span>
                    <span
                      className={`text-xs font-mono font-black ${
                        timer.urgency === "critical"
                          ? "text-rose-400"
                          : timer.urgency === "warning"
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {timer.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <AwaitingFeed
            title="Awaiting Scheduled Jump & Tip-off Times"
            message="Live game lockout timers initialize once official fixture jump times are scheduled."
            statusLabel="Awaiting Schedule"
          />
        )}
      </section>

      {/* Bob's Top Picks & Daily Multis (Item 71) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">
              Bob&apos;s Daily Multis (Automated Day-Ahead Selection)
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Calibrated with Kelly Criterion &amp; Health Rating
          </span>
        </div>

        {bobsMultis.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {bobsMultis.map((multi, idx) => {
              const isAdded = addedMultis[multi.title];

              return (
                <div
                  key={multi.title || idx}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 flex flex-col justify-between overflow-hidden shadow-xl shadow-black/30 transition-all"
                >
                  <div className="p-5">
                    {/* Multi Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {multi.badge || multi.risk_profile}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Health:</span>
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {multi.health_grade} ({multi.health_score})
                        </span>
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-white mb-1.5">{multi.title}</h3>

                    {/* Odds & EV KPIs */}
                    <div className="flex items-center gap-4 text-xs mb-4">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Price:</span>
                        <span className="text-base font-black text-white font-mono">
                          ${multi.actual_odds.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Model EV:</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          +{multi.combined_edge_pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Bob's Rationale */}
                    {multi.bob_rationale && (
                      <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                        {multi.bob_rationale}
                      </div>
                    )}

                    {/* Multi Legs List */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Included Legs ({multi.legs.length})
                      </span>
                      {multi.legs.map((leg, lIdx) => (
                        <div
                          key={lIdx}
                          className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 block truncate">
                              {leg.selection}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase">
                              {leg.sport} • {leg.market_type || "Market"}
                            </span>
                          </div>
                          <span className="font-bold text-white font-mono shrink-0">
                            ${leg.odds.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Multi Action Footer */}
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 flex items-center justify-between gap-3">
                    {multi.kelly_recommendation ? (
                      <div className="text-xs">
                        <span className="text-[10px] text-slate-400 block">Quarter-Kelly Stake</span>
                        <span className="font-bold text-white font-mono">
                          ${multi.kelly_recommendation.recommended_stake.toFixed(2)} (
                          {(multi.kelly_recommendation.recommended_fraction * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}

                    <button
                      type="button"
                      onClick={() => handleAddMultiToSlip(multi)}
                      disabled={isAdded}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isAdded
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-700 cursor-default"
                          : "bg-cyan-500 text-black hover:bg-cyan-400 active:scale-95 shadow-md shadow-cyan-950"
                      }`}
                    >
                      {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{isAdded ? "Added to Slip" : "Add Multi to Slip"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <AwaitingFeed
            title="Awaiting Bob's Daily Multi Formulation"
            message="Bob formulates daily value multis once bookmaker opening lines and morning scratchings are finalized."
            statusLabel="Awaiting Day-Ahead Formulation"
            onRefresh={loadData}
          />
        )}
      </section>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onCompleted={() => {
          setHasPreferences(true);
          void loadData();
        }}
      />
    </div>
  );
}
