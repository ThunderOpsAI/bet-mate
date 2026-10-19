import React, { useState } from "react";
import {
  Trophy,
  Activity,
  Layers,
  Sparkles,
  Bot,
  Plus,
  Check,
  Bookmark,
  Calendar,
  Compass,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Info,
  Zap,
} from "lucide-react";
import { MOCK_RACES } from "../../data/mockData";
import { useBetslip } from "../../context/BetslipContext";
import { useBlackbook } from "../../context/BlackbookContext";
import { buildBobExplanation } from "../../lib/bob/explainer";
import { QuaddieModal } from "../racing/QuaddieModal";
import type { Race, Runner, RacingCode } from "../../types";
import type { BobExplanation } from "../../lib/bob/explainer";

interface RacingViewProps {
  onOpenBob: (explanation: BobExplanation) => void;
}

export const RacingView: React.FC<RacingViewProps> = ({ onOpenBob }) => {
  const { addBet, bets, openQuickBet } = useBetslip();
  const { isBookmarked, quickAdd } = useBlackbook();

  const [selectedCode, setSelectedCode] = useState<"ALL" | RacingCode>("ALL");
  const [activeVenue, setActiveVenue] = useState<string>("Flemington");
  const [activeRaceId, setActiveRaceId] = useState<string>("flem-r1");
  const [selectedRunnerDrawer, setSelectedRunnerDrawer] = useState<Runner | null>(null);
  const [isQuaddieOpen, setIsQuaddieOpen] = useState(false);

  // Filter races by code
  const filteredRaces = MOCK_RACES.filter((r) =>
    selectedCode === "ALL" ? true : r.race_type === selectedCode
  );

  // Unique venues in filtered set
  const venues = Array.from(new Set(filteredRaces.map((r) => r.venue)));

  // If current activeVenue is not in filtered set, reset to first
  const currentVenue = venues.includes(activeVenue) ? activeVenue : venues[0] || "Flemington";

  const venueRaces = filteredRaces.filter((r) => r.venue === currentVenue);
  const currentRace = venueRaces.find((r) => r.race_id === activeRaceId) || venueRaces[0] || MOCK_RACES[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="text-orange-400" size={24} />
            <span>Racing Predictions &amp; Speed Maps</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ensemble XGBoost win probabilities, fair odds lines, pace bias, and sectional ratings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQuaddieOpen(true)}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Layers size={14} className="text-amber-400" />
            <span>Quaddie Planner</span>
          </button>
        </div>
      </div>

      {/* Code Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { code: "ALL" as const, label: "All Codes" },
          { code: "T" as const, label: "🐎 Thoroughbreds" },
          { code: "H" as const, label: "🏇 Harness" },
          { code: "G" as const, label: "🐕 Greyhounds" },
        ].map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => {
              setSelectedCode(item.code);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              selectedCode === item.code
                ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Venue Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {venues.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setActiveVenue(v);
              const firstRace = filteredRaces.find((r) => r.venue === v);
              if (firstRace) setActiveRaceId(firstRace.race_id);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              currentVenue === v
                ? "bg-slate-800 text-white border border-slate-600 shadow-md"
                : "bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-white"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Race Number Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-800">
        {venueRaces.map((r) => (
          <button
            key={r.race_id}
            type="button"
            onClick={() => setActiveRaceId(r.race_id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              currentRace?.race_id === r.race_id
                ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20"
                : "bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>R{r.race_number}</span>
            <span className="text-[10px] font-normal opacity-80">{r.distance}m</span>
          </button>
        ))}
      </div>

      {/* Active Race Details Banner */}
      {currentRace && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
                Race {currentRace.race_number}
              </span>
              <h2 className="text-lg font-black text-white">{currentRace.venue}</h2>
              <span className="text-xs text-slate-400">• {currentRace.distance}m</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>Track: <strong className="text-slate-200">{currentRace.track_condition}</strong></span>
              <span>•</span>
              <span>Prize Money: <strong className="text-slate-200">{currentRace.prize_money}</strong></span>
              <span>•</span>
              <span>Weather: <strong className="text-slate-200">{currentRace.weather}</strong></span>
            </div>
          </div>

          {/* Speed Map Summary */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
            <Compass size={15} className="text-cyan-400 shrink-0" />
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Pace Scenario</span>
              <span className="text-slate-200 font-semibold">
                {currentRace.horses.find((h) => h.speed_map_position === "Leader")?.name || "Even Tempo"} Expected to Lead
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Runners Matrix Table */}
      {currentRace && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Field &amp; Algorithmic Odds Matrix ({currentRace.horses.length} Runners)
            </span>
            <span className="text-[11px] text-slate-500">Live prices sourced from Betfair Exchange</span>
          </div>

          <div className="space-y-2">
            {currentRace.horses.map((horse, idx) => {
              const inSlip = bets.some((b) => b.selection === horse.name);
              const bookmarked = isBookmarked(horse.name);
              const isTopPick = idx === 0;

              return (
                <div
                  key={horse.horse_id}
                  className={`p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isTopPick ? "border-orange-500/40 bg-gradient-to-r from-orange-950/10 to-slate-950" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Left: Saddlecloth, Name, Jockey, Trainer, Barrier, Map position */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {horse.saddlecloth}
                    </span>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-extrabold text-white truncate">{horse.name}</h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          B{horse.barrier} • {horse.weight > 0 ? `${horse.weight}kg` : "Pacer"}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {horse.speed_map_position}
                        </span>
                        {horse.edge_pct > 10 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            +{horse.edge_pct}% EV
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span>J: <strong className="text-slate-300">{horse.jockey_name}</strong></span>
                        <span>•</span>
                        <span>T: <strong className="text-slate-300">{horse.trainer_name}</strong></span>
                        <span>•</span>
                        <span>Form: <strong className="text-slate-300 font-mono">{horse.form}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quant Stats, Price, and Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                    {/* Prob & Fair Odds */}
                    <div className="text-right space-y-0.5">
                      <div className="text-xs text-slate-400">
                        Win Prob: <strong className="text-white font-bold">{horse.win_probability}%</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Fair: <strong className="text-emerald-400 font-mono">${horse.fair_odds.toFixed(2)}</strong>
                      </div>
                    </div>

                    {/* Betfair Market Odds */}
                    <div className="text-center px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80">
                      <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">
                        Betfair Back
                      </span>
                      <span className="text-sm sm:text-base font-black text-emerald-400 font-mono leading-tight">
                        ${horse.betfair_back_price.toFixed(2)}
                      </span>
                    </div>

                    {/* Ask Bob */}
                    <button
                      type="button"
                      onClick={() => {
                        const expl = buildBobExplanation({
                          sport: "racing",
                          selectionName: horse.name,
                          probability: horse.win_probability,
                          fairOdds: horse.fair_odds,
                          marketOdds: horse.betfair_back_price,
                          featureImpact: horse.feature_impact,
                        });
                        onOpenBob(expl);
                      }}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                      title="Ask Bob quant analysis"
                    >
                      <Bot size={16} />
                    </button>

                    {/* Quick Bookmark */}
                    <button
                      type="button"
                      onClick={() => quickAdd(horse.name, "RUNNER", "racing")}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                        bookmarked
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                      title={bookmarked ? "Bookmarked in Blackbook" : "Quick-add to Blackbook"}
                    >
                      <Bookmark size={16} />
                    </button>

                    {/* Quick Bet Button */}
                    <button
                      type="button"
                      onClick={() => {
                        openQuickBet({
                          sport: "racing",
                          event_id: currentRace.race_id,
                          event_name: `${currentRace.venue} R${currentRace.race_number}`,
                          selection: horse.name,
                          bet_type: "win",
                          odds: horse.betfair_back_price,
                          stake: 20,
                          fair_odds: horse.fair_odds,
                          edge_pct: horse.edge_pct,
                        });
                      }}
                      className="px-2.5 py-2 rounded-xl text-xs font-black bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                      title="Quick Bet without leaving view"
                    >
                      <Zap size={14} className="fill-amber-400 text-amber-400" />
                      <span className="hidden sm:inline">Quick</span>
                    </button>

                    {/* Add to Betslip Button */}
                    <button
                      type="button"
                      onClick={() => {
                        addBet(
                          {
                            sport: "racing",
                            event_id: currentRace.race_id,
                            event_name: `${currentRace.venue} R${currentRace.race_number}`,
                            selection: horse.name,
                            bet_type: "win",
                            odds: horse.betfair_back_price,
                            stake: 10,
                            fair_odds: horse.fair_odds,
                            edge_pct: horse.edge_pct,
                          },
                          true
                        );
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer ${
                        inSlip
                          ? "bg-emerald-600 text-white"
                          : "bg-orange-500 hover:bg-orange-400 text-slate-950 shadow-sm"
                      }`}
                    >
                      {inSlip ? <Check size={14} /> : <Plus size={14} />}
                      <span>{inSlip ? "In Slip" : "Bet"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quaddie Modal */}
      {isQuaddieOpen && (
        <QuaddieModal
          isOpen={isQuaddieOpen}
          onClose={() => setIsQuaddieOpen(false)}
          races={venueRaces}
          venue={currentVenue}
        />
      )}
    </div>
  );
};
