import React, { useState } from "react";
import {
  Trophy,
  Zap,
  ArrowRight,
  TrendingUp,
  Clock,
  Bookmark,
  Plus,
  Check,
  Bot,
  Layers,
  ChevronDown,
  ChevronUp,
  Shield,
  Flame,
  Swords,
  Flag
} from "lucide-react";
import { MOCK_SPORTS } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import { useBlackbook } from "../../context/BlackbookContext";
import { buildBobExplanation } from "../../lib/bob/explainer";
import type { SportCode, SportMatchup } from "../../types";
import type { BobExplanation } from "../../lib/bob/explainer";

interface SportViewProps {
  initialSport?: SportCode | "ALL";
  onOpenBob: (explanation: BobExplanation) => void;
  onNavigate: (view: string) => void;
}

export const SportView: React.FC<SportViewProps> = ({ initialSport = "ALL", onOpenBob, onNavigate }) => {
  const { addBet, bets, openQuickBet } = useBetslip();
  const { isBookmarked, quickAdd } = useBlackbook();

  const [selectedSport, setSelectedSport] = useState<SportCode | "ALL">(initialSport);
  const [expandedMatchupId, setExpandedMatchupId] = useState<string | null>(null);

  const filteredMatchups = MOCK_SPORTS.filter((m) =>
    selectedSport === "ALL" ? true : m.sport === selectedSport
  );

  const toggleExpand = (id: string) => {
    setExpandedMatchupId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="text-blue-400" size={24} />
            <span>Sports Predictions &amp; Props Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Machine Learning match forecasting, player prop edges, and same-game multi (SGM) correlations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("multi-builder")}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Layers size={14} />
          <span>Build SGM Multi</span>
        </button>
      </div>

      {/* Sport Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { code: "ALL" as const, label: "All Sports" },
          { code: "nba" as const, label: "🏀 NBA" },
          { code: "afl" as const, label: "🏉 AFL" },
          { code: "nrl" as const, label: "🏉 NRL" },
          { code: "soccer" as const, label: "⚽ Soccer" },
          { code: "golf" as const, label: "⛳ Golf" },
          { code: "mma" as const, label: "🥊 MMA" },
        ].map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => setSelectedSport(item.code)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              selectedSport === item.code
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Matchups List */}
      <div className="space-y-4">
        {filteredMatchups.map((matchup) => {
          const isExpanded = expandedMatchupId === matchup.game_id;
          const homeInSlip = bets.some((b) => b.selection === `${matchup.home_team} Moneyline`);
          const awayInSlip = bets.some((b) => b.selection === `${matchup.away_team} Moneyline`);

          return (
            <div
              key={matchup.game_id}
              className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-slate-700/80 transition-all space-y-4 shadow-sm"
            >
              {/* Top Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    {matchup.sport_label}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{matchup.venue}</span>
                </div>

                <div className="flex items-center gap-2">
                  {matchup.edge_home_pct > 5 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      +{matchup.edge_home_pct}% EV on {matchup.home_team}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const expl = buildBobExplanation({
                        sport: matchup.sport,
                        selectionName: matchup.home_team,
                        opponentName: matchup.away_team,
                        probability: matchup.home_win_probability,
                        fairOdds: matchup.fair_odds_home,
                        marketOdds: matchup.market_odds_home,
                        featureImpact: matchup.feature_impact,
                      });
                      onOpenBob(expl);
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/25 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Bot size={13} />
                    <span>Ask Bob</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openQuickBet({
                        sport: matchup.sport,
                        event_id: matchup.game_id,
                        event_name: `${matchup.home_team} vs ${matchup.away_team}`,
                        selection: `${matchup.home_team} Moneyline`,
                        bet_type: "win",
                        odds: matchup.market_odds_home,
                        stake: 20,
                        fair_odds: matchup.fair_odds_home,
                        edge_pct: matchup.edge_home_pct,
                      });
                    }}
                    className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Instant Quick Bet on match favorite"
                  >
                    <Zap size={13} className="fill-amber-400" />
                    <span>Quick Bet</span>
                  </button>
                </div>
              </div>

              {/* Matchup Teams & Odds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Team Names */}
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    {matchup.home_team} <span className="text-slate-500 text-sm font-normal">vs</span> {matchup.away_team}
                  </h3>
                  {matchup.head_to_head_note && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {matchup.head_to_head_note}
                    </p>
                  )}
                </div>

                {/* Win Prob Bar & Odds Buttons */}
                <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-400">{matchup.home_team}: {matchup.home_win_probability}%</span>
                    <span className="text-blue-400">{matchup.away_team}: {matchup.away_win_probability}%</span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${matchup.home_win_probability}%` }}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${matchup.away_win_probability}%` }}
                    />
                  </div>

                  {/* Dual Odds Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        addBet(
                          {
                            sport: matchup.sport,
                            event_id: matchup.game_id,
                            event_name: `${matchup.home_team} vs ${matchup.away_team}`,
                            selection: `${matchup.home_team} Moneyline`,
                            bet_type: "win",
                            odds: matchup.market_odds_home,
                            stake: 10,
                            fair_odds: matchup.fair_odds_home,
                            edge_pct: matchup.edge_home_pct,
                          },
                          true
                        );
                      }}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-between cursor-pointer ${
                        homeInSlip
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-950 border-slate-700/80 hover:border-emerald-500/60 text-slate-200"
                      }`}
                    >
                      <span className="truncate">{matchup.home_team}</span>
                      <span className="font-mono font-black text-emerald-400 ml-1">
                        ${matchup.market_odds_home.toFixed(2)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        addBet(
                          {
                            sport: matchup.sport,
                            event_id: matchup.game_id,
                            event_name: `${matchup.home_team} vs ${matchup.away_team}`,
                            selection: `${matchup.away_team} Moneyline`,
                            bet_type: "win",
                            odds: matchup.market_odds_away,
                            stake: 10,
                            fair_odds: matchup.fair_odds_away,
                            edge_pct: matchup.edge_away_pct,
                          },
                          true
                        );
                      }}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-between cursor-pointer ${
                        awayInSlip
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-950 border-slate-700/80 hover:border-blue-500/60 text-slate-200"
                      }`}
                    >
                      <span className="truncate">{matchup.away_team}</span>
                      <span className="font-mono font-black text-blue-400 ml-1">
                        ${matchup.market_odds_away.toFixed(2)}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Player Props Section toggle */}
              {matchup.player_props && matchup.player_props.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => toggleExpand(matchup.game_id)}
                    className="flex items-center justify-between w-full text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer py-1"
                  >
                    <span className="flex items-center gap-1.5 text-cyan-300">
                      <Zap size={14} />
                      <span>Same Game Multi (SGM) Player Props ({matchup.player_props.length} available)</span>
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800">
                      {matchup.player_props.map((prop) => {
                        const propInSlip = bets.some((b) => b.selection === `${prop.player_name} ${prop.line}`);
                        return (
                          <div
                            key={prop.id}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">{prop.player_name}</span>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <span>{prop.line}</span>
                                {prop.edge_pct > 10 && (
                                  <span className="text-emerald-400 font-bold">+{prop.edge_pct}% EV</span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                addBet(
                                  {
                                    sport: matchup.sport,
                                    event_id: matchup.game_id,
                                    event_name: `${matchup.home_team} vs ${matchup.away_team}`,
                                    selection: `${prop.player_name} ${prop.line}`,
                                    bet_type: "prop",
                                    odds: prop.market_odds,
                                    stake: 10,
                                    fair_odds: prop.fair_odds,
                                    edge_pct: prop.edge_pct,
                                  },
                                  true
                                );
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                                propInSlip
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700"
                              }`}
                            >
                              {propInSlip ? <Check size={12} /> : <Plus size={12} />}
                              <span>${prop.market_odds.toFixed(2)}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
