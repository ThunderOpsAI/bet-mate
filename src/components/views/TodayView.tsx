import React, { useState } from "react";
import { Calendar, Clock, Trophy, Activity, ArrowRight, Zap, Check, Plus, Bot } from "lucide-react";
import { MOCK_RACES, MOCK_SPORTS } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import { buildBobExplanation } from "../../lib/bob/explainer";
import type { BobExplanation } from "../../lib/bob/explainer";

interface TodayViewProps {
  onOpenBob: (explanation: BobExplanation) => void;
  onNavigate: (view: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ onOpenBob, onNavigate }) => {
  const { addBet, bets } = useBetslip();
  const [filterType, setFilterType] = useState<"ALL" | "RACING" | "SPORT">("ALL");

  // Merge today's races and sports into a chronological list
  const raceItems = MOCK_RACES.map((r) => ({
    id: r.race_id,
    type: "RACING" as const,
    title: `${r.venue} Race ${r.race_number}`,
    subtitle: `${r.distance}m • ${r.track_condition}`,
    time: r.start_time,
    topPick: r.horses[0],
    odds: r.horses[0]?.betfair_back_price || 3.0,
    prob: r.horses[0]?.win_probability || 30,
    edge: r.horses[0]?.edge_pct || 15,
  }));

  const sportItems = MOCK_SPORTS.map((s) => ({
    id: s.game_id,
    type: "SPORT" as const,
    title: `${s.home_team} vs ${s.away_team}`,
    subtitle: `${s.sport_label} • ${s.venue}`,
    time: s.date,
    topPick: {
      name: s.home_win_probability >= s.away_win_probability ? s.home_team : s.away_team,
      betfair_back_price: s.home_win_probability >= s.away_win_probability ? s.market_odds_home : s.market_odds_away,
      win_probability: Math.max(s.home_win_probability, s.away_win_probability),
      fair_odds: s.home_win_probability >= s.away_win_probability ? s.fair_odds_home : s.fair_odds_away,
    },
    odds: s.home_win_probability >= s.away_win_probability ? s.market_odds_home : s.market_odds_away,
    prob: Math.max(s.home_win_probability, s.away_win_probability),
    edge: s.home_win_probability >= s.away_win_probability ? s.edge_home_pct : s.edge_away_pct,
  }));

  const allItems = [...raceItems, ...sportItems]
    .filter((item) => (filterType === "ALL" ? true : item.type === filterType))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="text-cyan-400" size={24} />
            <span>Today&apos;s Schedule &amp; Events</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Chronological timeline of jumping races and scheduled matches with live odds and model edges.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(["ALL", "RACING", "SPORT"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterType(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterType === mode
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {mode === "ALL" ? "All Events" : mode === "RACING" ? "Racing Only" : "Sports Only"}
            </button>
          ))}
        </div>
      </div>

      {/* Events Timeline */}
      <div className="space-y-3">
        {allItems.map((item, index) => {
          const inSlip = bets.some((b) => b.selection === item.topPick.name);

          return (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {index + 1}
                </span>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${
                        item.type === "RACING"
                          ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                          : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {item.type}
                    </span>
                    <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                </div>
              </div>

              {/* Top Model Pick & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Top Model Pick:</span>
                  <span className="text-xs font-bold text-slate-200 block truncate max-w-[140px]">
                    {item.topPick.name}
                  </span>
                </div>

                <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 font-bold block">Odds</span>
                  <span className="text-xs font-mono font-black text-emerald-400">
                    ${item.odds.toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const expl = buildBobExplanation({
                      sport: item.type === "RACING" ? "racing" : "nba",
                      selectionName: item.topPick.name,
                      probability: item.prob,
                      marketOdds: item.odds,
                    });
                    onOpenBob(expl);
                  }}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/25 transition-colors cursor-pointer"
                  title="Ask Bob explanation"
                >
                  <Bot size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    addBet(
                      {
                        sport: item.type === "RACING" ? "racing" : "nba",
                        event_id: item.id,
                        event_name: item.title,
                        selection: item.topPick.name,
                        bet_type: "win",
                        odds: item.odds,
                        stake: 10,
                        edge_pct: item.edge,
                      },
                      true
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer ${
                    inSlip
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm"
                  }`}
                >
                  {inSlip ? <Check size={13} /> : <Plus size={13} />}
                  <span>{inSlip ? "In Slip" : "Bet"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
