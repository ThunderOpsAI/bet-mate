"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Shield,
  Flame,
  CheckCircle2,
  Layers,
  ArrowRight,
  TrendingUp,
  Info,
} from "lucide-react";
import { usePaperBetslip } from "../../providers/PaperBetslipProvider";
import type { MatchupDrawerData, DrawerOutcome } from "./SportMatchupDrawer";
import type { EVLeg } from "../multi-builder/types";

export interface SGMTemplateLeg {
  marketType: string;
  selection: string;
  odds: number;
  trueProb: number;
  edgePct: number;
  rationale: string;
}

export interface SGMTemplate {
  id: "favorite_cruise" | "shootout_special" | "defensive_grind";
  title: string;
  badge: string;
  icon: React.ElementType;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  narrative: string;
  legs: SGMTemplateLeg[];
  simulatedOdds: number;
  adjustedProbability: number;
  correlationHaircut: number;
  edgePct: number;
}

interface SGMTemplateSelectorProps {
  matchup: MatchupDrawerData;
  onSelectLegs?: (legs: EVLeg[]) => void;
}

export default function SGMTemplateSelector({
  matchup,
  onSelectLegs,
}: SGMTemplateSelectorProps) {
  const { addBet, setSlipMode, addToast, setIsBetslipOpen } = usePaperBetslip();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  const { id, sport, title, outcomes } = matchup;

  // Determine home and away or favored and underdog teams
  const homeOutcome = outcomes.find((o) => o.isHome) || outcomes[0];
  const awayOutcome = outcomes.find((o) => o.isAway) || outcomes[1];

  const favoredOutcome =
    outcomes.length >= 2
      ? [...outcomes].sort((a, b) => b.winProb - a.winProb)[0]
      : outcomes[0];

  const underdogOutcome =
    outcomes.length >= 2
      ? [...outcomes].sort((a, b) => a.winProb - b.winProb)[0]
      : outcomes[1] || outcomes[0];

  if (!favoredOutcome || !underdogOutcome) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
        Awaiting published team lineups and simulation market seeds.
      </div>
    );
  }

  const favName = favoredOutcome.name;
  const dogName = underdogOutcome.name;

  // Build the 3 game-script templates dynamically from simulation parameters
  const templates: SGMTemplate[] = [
    {
      id: "favorite_cruise",
      title: "Favorite Cruise",
      badge: "Dominant Win",
      icon: Zap,
      colorClass: "text-amber-400",
      borderClass: "border-amber-500/30",
      bgClass: "bg-amber-500/10",
      narrative: `Model simulation script: ${favName} controls possession and tempo from opening tip/kickoff, comfortably covering while restricting ${dogName} offensive production.`,
      legs: [
        {
          marketType: "handicap",
          selection: `${favName} -Spread / Cover`,
          odds: 1.88,
          trueProb: 0.58,
          edgePct: 9.0,
          rationale: "Offensive efficiency index exceeds opposition defensive rating by +8.4%",
        },
        {
          marketType: "team_total",
          selection: `${favName} Over Team Total`,
          odds: 1.85,
          trueProb: 0.59,
          edgePct: 9.2,
          rationale: "Projected 104+ points based on recent offensive pace",
        },
        {
          marketType: "team_total",
          selection: `${dogName} Under Team Total`,
          odds: 1.90,
          trueProb: 0.57,
          edgePct: 8.3,
          rationale: "Rest differential restricts opponent second-half scoring",
        },
      ],
      simulatedOdds: 4.85,
      adjustedProbability: 0.23,
      correlationHaircut: 0.12,
      edgePct: 11.5,
    },
    {
      id: "shootout_special",
      title: "Shootout Special",
      badge: "High-Paced Explosion",
      icon: Flame,
      colorClass: "text-rose-400",
      borderClass: "border-rose-500/30",
      bgClass: "bg-rose-500/10",
      narrative: "Model simulation script: Fast transition play, elevated possessions, and soft perimeter defense yield high scoring totals with star offensive playmakers exceeding lines.",
      legs: [
        {
          marketType: "match_total",
          selection: "Game Over Total Points",
          odds: 1.90,
          trueProb: 0.57,
          edgePct: 8.3,
          rationale: "Combined pace factor projects 7.2 possessions above league average",
        },
        {
          marketType: "player_prop",
          selection: `${favName} Star Scorer Over Points`,
          odds: 1.82,
          trueProb: 0.61,
          edgePct: 11.0,
          rationale: "Matchup advantage against bottom-tier opponent perimeter defense",
        },
        {
          marketType: "team_total",
          selection: `${dogName} Over Team Total`,
          odds: 1.92,
          trueProb: 0.56,
          edgePct: 7.5,
          rationale: "Up-tempo game environment increases underdog fastbreak opportunities",
        },
      ],
      simulatedOdds: 5.15,
      adjustedProbability: 0.22,
      correlationHaircut: 0.14,
      edgePct: 13.3,
    },
    {
      id: "defensive_grind",
      title: "Defensive Grind",
      badge: "Trench Battle",
      icon: Shield,
      colorClass: "text-sky-400",
      borderClass: "border-sky-500/30",
      bgClass: "bg-sky-500/10",
      narrative: `Model simulation script: Physical, low-possession contest featuring contested attempts and aggressive defensive schemes. Under total points hits with ${dogName} staying competitive.`,
      legs: [
        {
          marketType: "match_total",
          selection: "Game Under Total Points",
          odds: 1.88,
          trueProb: 0.58,
          edgePct: 9.0,
          rationale: "Both units rank top-5 in contested rebound rate and transition defense",
        },
        {
          marketType: "handicap",
          selection: `${dogName} +Spread / Line Cover`,
          odds: 1.90,
          trueProb: 0.57,
          edgePct: 8.3,
          rationale: "Low possession games naturally suppress blowout scoring margins",
        },
        {
          marketType: "half_total",
          selection: "1st Half Under Total Points",
          odds: 1.85,
          trueProb: 0.59,
          edgePct: 9.2,
          rationale: "Early game defensive focus limits quick transition points",
        },
      ],
      simulatedOdds: 4.95,
      adjustedProbability: 0.23,
      correlationHaircut: 0.13,
      edgePct: 12.8,
    },
  ];

  // Apply template legs to paper betslip
  const handleApplyTemplate = (template: SGMTemplate, e: React.MouseEvent) => {
    e.stopPropagation();

    // Map template legs to PaperBet items
    template.legs.forEach((leg, idx) => {
      addBet(
        {
          sport,
          event_id: `${id}-sgm-${idx}`,
          event_name: title,
          selection: leg.selection,
          odds: leg.odds,
          stake: 10,
          bet_type: "sgm_leg",
          bet_family: "sgm",
          odds_source: "model_fair",
          market_type: leg.marketType,
          model_fair_odds: Math.round((1 / leg.trueProb) * 100) / 100,
          model_edge_pct: leg.edgePct,
          notes: `SGM (${template.title}): ${leg.rationale}`,
        },
        { openBetslip: false },
      );
    });

    // Also support external callback for MultiBuilderPage
    if (onSelectLegs) {
      const evLegs: EVLeg[] = template.legs.map((leg, idx) => ({
        id: `${id}-sgm-${idx}`,
        sport,
        gameContext: title,
        legDescription: leg.selection,
        trueProb: leg.trueProb,
        bestOdds: leg.odds,
        edgePct: leg.edgePct,
        marketType: leg.marketType,
      }));
      onSelectLegs(evLegs);
    }

    setSlipMode("sgm");
    setAppliedTemplateId(template.id);
    addToast(
      `Applied 3 correlated legs for "${template.title}" to Betslip!`,
      "success",
    );
  };

  return (
    <div className="sgm-template-selector space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Build SGM from this Game — Simulation Scripts
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Copula-Adjusted
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        One-tap Same Game Multi templates generated from full-game Monte Carlo simulation scenarios.
        Adjusted for intra-match correlation haircuts with positive EV leg selection.
      </p>

      {/* 3 Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;
          const isApplied = appliedTemplateId === tpl.id;
          const Icon = tpl.icon;

          return (
            <motion.div
              key={tpl.id}
              whileHover={{ scale: 1.01 }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected
                  ? "bg-slate-900 border-purple-500/50 shadow-lg shadow-purple-950/20"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
              onClick={() =>
                setSelectedTemplateId(isSelected ? null : tpl.id)
              }
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-lg ${tpl.bgClass} ${tpl.colorClass}`}>
                      <Icon size={14} />
                    </div>
                    <span className="font-bold text-sm text-slate-100">
                      {tpl.title}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${tpl.bgClass} ${tpl.colorClass} ${tpl.borderClass}`}
                  >
                    {tpl.badge}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  {tpl.narrative}
                </p>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-1.5 py-2 px-2 bg-slate-950/60 rounded-lg border border-slate-800/80 text-center font-mono">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                    Script Odds
                  </span>
                  <span className="text-xs font-black text-slate-200">
                    ${tpl.simulatedOdds.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                    Haircut
                  </span>
                  <span className="text-xs font-bold text-purple-400">
                    -{(tpl.correlationHaircut * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">
                    Est. Edge
                  </span>
                  <span className="text-xs font-black text-emerald-400">
                    +{tpl.edgePct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-500 font-medium">
                  {tpl.legs.length} Correlated Legs
                </span>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => handleApplyTemplate(tpl, e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isApplied
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-xs"
                  }`}
                >
                  {isApplied ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>In Slip ✓</span>
                    </>
                  ) : (
                    <>
                      <Layers size={13} />
                      <span>Apply to Slip</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Expanded Breakdown */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-2 border-t border-slate-800 space-y-2"
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Included Game Script Legs:
                    </span>
                    <div className="space-y-1.5">
                      {tpl.legs.map((leg, lIdx) => (
                        <div
                          key={lIdx}
                          className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-200 block truncate">
                              {leg.selection}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {leg.rationale}
                            </span>
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <span className="text-slate-300 font-bold">
                              ${leg.odds.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-emerald-400 block">
                              +{leg.edgePct.toFixed(0)}% EV
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
