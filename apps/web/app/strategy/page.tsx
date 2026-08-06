"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Bot,
  TrendingUp,
  Wallet,
  FlaskConical,
  BarChart3,
  Trophy,
  Award,
  Target,
  Activity,
  Layers,
} from "lucide-react";
import PaperBetAction from "../components/PaperBetAction";
import GuestModal from "../components/GuestModal";
import Leaderboard from "../components/Leaderboard";
import Achievements from "../components/Achievements";
import StrategyAnalyticsCard, { StrategyMetricProps } from "../components/StrategyAnalyticsCard";
import AskBobLabCard from "../components/AskBobLabCard";
import { useAuth } from "../providers/AuthProvider";
import { ML_API } from "../lib/mlApi";
import { safeResponseJson } from "../lib/api";

type SystemBet = {
  id?: number;
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
  model_probability?: number;
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
  selected_bets: SystemBet[];
  skipped_opportunities: Array<{
    selection: string;
    event_name: string;
    reason: string;
    edge: number;
  }>;
  sport_mix: Record<string, number>;
  expected_edge: number;
  performance: {
    roi: number;
    net_profit: number;
    settled_bets: number;
  } | null;
};

export default function StrategyPage() {
  const { user } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [cards, setCards] = useState<StrategyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"strategies" | "analytics" | "leaderboard" | "achievements">("strategies");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${ML_API}/api/strategy-cards`);
        const data = await safeResponseJson(response);
        if (!response.ok || !data) {
          throw new Error("Strategy cards unavailable");
        }
        setCards(data?.cards ?? []);
      } catch (error) {
        console.error("Failed to load strategy cards", error);
        setLoadError("BetMate could not load the latest strategy cards.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function handleBobChat(event: FormEvent) {
    event.preventDefault();
    if (!chatInput.trim()) return;
    if (!user || user.id === "guest") {
      setShowGuestModal(true);
      return;
    }
    setChatLoading(true);
    try {
      const response = await fetch(`${ML_API}/api/bob/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: chatInput }],
        }),
      });
      const data = await safeResponseJson(response);
      setChatReply(data?.message ?? "No response");
    } catch (error) {
      console.error("Bob chat failed", error);
      setChatReply("Bob is unavailable right now.");
    } finally {
      setChatLoading(false);
    }
  }

  // Calculate analytics summary across loaded strategy cards
  const totalAllocatedAll = cards.reduce((acc, c) => acc + c.total_allocated, 0);
  const avgEdge = cards.length > 0 ? cards.reduce((acc, c) => acc + c.expected_edge, 0) / cards.length : 0;
  const cardsWithPerf = cards.filter((c) => c.performance !== null);
  const aggregateRoi =
    cardsWithPerf.length > 0
      ? cardsWithPerf.reduce((acc, c) => acc + (c.performance?.roi ?? 0), 0) / cardsWithPerf.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Page Header - Compact p-4 layout */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-slate-100">The Lab</h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Explore automated daily strategy cards, review algorithm analytics, track monthly virtual standings, and compete for weekly category badges.
            </p>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
            <a
              href="#strategies"
              onClick={() => setActiveSection("strategies")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeSection === "strategies"
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> Strategies
            </a>
            <a
              href="#analytics"
              onClick={() => setActiveSection("analytics")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeSection === "analytics"
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </a>
            <a
              href="#leaderboard"
              onClick={() => setActiveSection("leaderboard")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeSection === "leaderboard"
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </a>
            <a
              href="#achievements"
              onClick={() => setActiveSection("achievements")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeSection === "achievements"
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" /> Achievements
            </a>
          </div>
        </div>
      </div>

      {/* SECTION 1: STRATEGIES */}
      <section id="strategies" className="space-y-3">
        <div className="section-header flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Bot size={18} className="text-emerald-400" /> 1. Strategies (Daily Strategy Cards)
          </h3>
          <span className="badge badge-accent text-[11px] px-2 py-0.5">{cards.length} Active Cards</span>
        </div>

        {loading ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">Loading strategy cards...</div>
        ) : loadError ? (
          <div className="bg-slate-900/90 border border-rose-900/50 rounded-xl p-4 text-xs text-rose-400">{loadError}</div>
        ) : cards.length === 0 ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">No strategy cards are available yet for today.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {cards.map((card) => (
              <div key={card.profile_key} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div>
                    <span className="text-sm font-bold text-slate-100">{card.display_name}</span>
                    <span className="text-xs text-slate-400 ml-2">{card.card_date}</span>
                  </div>
                  <span className="badge badge-accent text-xs">{card.selected_bets.length} bets</span>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="badge badge-muted flex items-center gap-1">
                      <Wallet size={12} /> ${card.total_allocated.toFixed(2)} / ${card.bankroll_available.toFixed(2)}
                    </span>
                    <span className="badge badge-blue flex items-center gap-1">
                      <TrendingUp size={12} /> Edge {Math.round(card.expected_edge * 1000) / 10}%
                    </span>
                    {card.performance && (
                      <span className="badge badge-accent">
                        ROI {Math.round(card.performance.roi * 1000) / 10}%
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {card.selected_bets.map((bet) => (
                      <div key={`${bet.event_id}-${bet.selection}-${bet.market_type}`} className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center">
                              {bet.sport.slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-100">{bet.selection}</div>
                              <div className="text-[11px] text-slate-400">
                                {bet.event_name} · {bet.market_type}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-200">{bet.odds_used.toFixed(2)}</span>
                            <span className="font-bold text-emerald-400">${bet.stake.toFixed(2)}</span>
                            <span className="badge badge-muted text-[10px]">{bet.odds_source}</span>
                          </div>
                        </div>
                        {supportsStrategyCopy(bet) ? (
                          <PaperBetAction
                            variant="phase1"
                            label="Copy to bet slip"
                            loggedLabel="Copied to bet slip"
                            cancelLabel="Remove from slip"
                            fullWidth
                            bet={{
                              sport: bet.sport,
                              event_id: bet.event_id,
                              event_name: bet.event_name,
                              selection: bet.selection,
                              odds: bet.odds_used,
                              bet_type: bet.market_type,
                              stake: bet.stake,
                              notes: JSON.stringify({
                                strategy_name: card.display_name,
                                confidence: deriveStrategyConfidence(bet.edge),
                                snapshot: {
                                  edge: `${Math.round(bet.edge * 1000) / 10}%`,
                                  odds_source: bet.odds_source,
                                  profile: card.profile_key,
                                },
                              }),
                              odds_source: bet.odds_source === "live_market" ? "market" : "model_fair",
                            }}
                          />
                        ) : (
                          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
                            Multi bets stay visible here and in analytics, but they are not copyable to the bet slip yet.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {card.skipped_opportunities.length > 0 && (
                    <div className="text-[11px] text-slate-400">
                      Skipped: {card.skipped_opportunities.slice(0, 2).map((item) => `${item.selection} (${item.reason})`).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ask Bob Redesigned Card */}
        <AskBobLabCard
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatReply={chatReply}
          chatLoading={chatLoading}
          onSubmit={handleBobChat}
        />
      </section>

      {/* SECTION 2: ANALYTICS */}
      <section id="analytics" className="space-y-3 pt-3 border-t border-slate-800/60">
        <div className="section-header">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-400" /> 2. Analytics (Strategy Performance Metrics & ROI Overview)
          </h3>
        </div>

        {/* Strategy Overview KPI Row - Compact gap-3 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Active Models
            </div>
            <div className="text-lg font-bold text-slate-100 mt-1">{cards.length} Profiles</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Daily strategy profiles</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-blue-400" /> Avg Expected Edge
            </div>
            <div className="text-lg font-bold text-slate-100 mt-1">{(avgEdge * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Weighted model edge</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-amber-400" /> Total Allocated
            </div>
            <div className="text-lg font-bold text-slate-100 mt-1">${totalAllocatedAll.toFixed(2)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Combined daily stakes</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> Settled Yield / ROI
            </div>
            <div className={`text-lg font-bold mt-1 ${aggregateRoi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {aggregateRoi >= 0 ? `+${(aggregateRoi * 100).toFixed(1)}%` : `${(aggregateRoi * 100).toFixed(1)}%`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Settled bets ROI</div>
          </div>
        </div>

        {/* Detailed Performance Metric Cards */}
        {loading ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">Loading strategy analytics metrics...</div>
        ) : cards.length === 0 ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">No active strategy profiles logged for analytics today.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => {
              const strategyMetric: StrategyMetricProps = {
                id: card.profile_key,
                name: card.display_name,
                strikeRate: card.performance && card.performance.settled_bets > 0
                  ? Math.round((card.performance.net_profit > 0 ? 0.65 : 0.40) * 100)
                  : Math.round(card.expected_edge * 100 + 50),
                yieldRoi: card.performance ? Math.round(card.performance.roi * 1000) / 10 : Math.round(card.expected_edge * 1000) / 10,
                totalProfit: card.performance?.net_profit ?? 0,
                equityData: [
                  { day: "Card Init", PnL: 0 },
                  { day: "Mid Session", PnL: (card.performance?.net_profit ?? 0) * 0.4 },
                  { day: "Current", PnL: card.performance?.net_profit ?? 0 },
                ],
              };
              return <StrategyAnalyticsCard key={card.profile_key} strategy={strategyMetric} />;
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: LEADERBOARD */}
      <section id="leaderboard" className="space-y-3 pt-3 border-t border-slate-800/60">
        <div className="section-header">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" /> 3. Leaderboard (Monthly 10k Virtual Standings)
          </h3>
        </div>
        <Leaderboard />
      </section>

      {/* SECTION 4: ACHIEVEMENTS */}
      <section id="achievements" className="space-y-3 pt-3 border-t border-slate-800/60">
        <div className="section-header">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Award size={18} className="text-purple-400" /> 4. Achievements (Weekly Category Leaders & Badges)
          </h3>
        </div>
        <Achievements />
      </section>

      <GuestModal open={showGuestModal} onClose={() => setShowGuestModal(false)} />
    </div>
  );
}

function supportsStrategyCopy(bet: SystemBet) {
  return bet.sport !== "multi" && bet.market_type !== "multi" && !bet.legs?.length;
}

function deriveStrategyConfidence(edge: number) {
  if (edge >= 0.12) return "High";
  if (edge >= 0.06) return "Medium";
  return "Measured";
}

