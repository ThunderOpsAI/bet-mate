"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Zap, BookOpen, Trophy, Activity, ArrowRight, Plus, Check, Sparkles, Clock, ExternalLink, Shield } from "lucide-react";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { RankedOpportunity } from "../lib/opportunityScore";

export type HomeTabKey = "high-ev" | "blackbook" | "next-racing" | "next-sport";

export interface BlackbookItem {
  runner: string;
  sport: string;
  bet_type: string;
  stake: number;
  enabled: boolean;
  probability_threshold: number;
}

export interface UpcomingRaceItem {
  race_id: string;
  venue: string;
  race_number: number;
  start_time?: string;
  meeting_date?: string;
  topRunner?: {
    horse_id: string;
    name: string;
    win_probability: number;
    fair_odds: number;
    market_odds?: number | null;
  };
}

export interface UpcomingSportItem {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  match_time?: string;
  predicted_winner?: string;
  win_probability?: number;
  fair_odds?: number;
  market_odds?: number | null;
}

interface HomePrimaryCardProps {
  // High EV tab
  opportunities: RankedOpportunity[];
  oppsLoading: boolean;
  oppsError: string | null;

  // Blackbook tab
  blackbookItems: BlackbookItem[];
  blackbookLoading: boolean;
  isGuest: boolean;

  // Next Racing tab
  upcomingRaces: UpcomingRaceItem[];
  racesLoading: boolean;
  racesError: string | null;

  // Next Sport tab
  upcomingSports: UpcomingSportItem[];
  sportsLoading: boolean;
  sportsError: string | null;
}

export default function HomePrimaryCard({
  opportunities,
  oppsLoading,
  oppsError,
  blackbookItems,
  blackbookLoading,
  isGuest,
  upcomingRaces,
  racesLoading,
  racesError,
  upcomingSports,
  sportsLoading,
  sportsError,
}: HomePrimaryCardProps) {
  const [activeTab, setActiveTab] = useState<HomeTabKey>("high-ev");
  const { addBet, bets } = usePaperBetslip();

  const isItemInSlip = (selection: string, eventName: string) => {
    return bets.some(
      (b) => b.selection === selection && b.event_name === eventName
    );
  };

  const handleAddBet = (
    sport: string,
    eventId: string,
    eventName: string,
    selection: string,
    odds?: number | null
  ) => {
    addBet(
      {
        sport,
        event_id: eventId,
        event_name: eventName,
        selection,
        odds: odds && odds > 1 ? odds : undefined,
        stake: 10,
        bet_type: "win",
        odds_source: odds && odds > 1 ? "market" : "model_fair",
      },
      { openBetslip: true }
    );
  };

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Primary Card Top Tab Header */}
      <div className="border-b border-slate-800 bg-slate-950/70 p-2 sm:p-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab("high-ev")}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              activeTab === "high-ev"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Zap size={16} className={activeTab === "high-ev" ? "text-emerald-400" : "text-slate-400"} />
            <span>High EV chances</span>
            {opportunities.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/30 text-emerald-300">
                {opportunities.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("blackbook")}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              activeTab === "blackbook"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-md shadow-purple-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <BookOpen size={16} className={activeTab === "blackbook" ? "text-purple-400" : "text-slate-400"} />
            <span>Blackbook</span>
            {blackbookItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/30 text-purple-300">
                {blackbookItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("next-racing")}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              activeTab === "next-racing"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Trophy size={16} className={activeTab === "next-racing" ? "text-amber-400" : "text-slate-400"} />
            <span>Next Racing</span>
            {upcomingRaces.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/30 text-amber-300">
                {upcomingRaces.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("next-sport")}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              activeTab === "next-sport"
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-md shadow-sky-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Activity size={16} className={activeTab === "next-sport" ? "text-sky-400" : "text-slate-400"} />
            <span>Next Sport</span>
            {upcomingSports.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/30 text-sky-300">
                {upcomingSports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels Content */}
      <div className="p-4 sm:p-6">
        {/* Tab 1: High EV chances */}
        {activeTab === "high-ev" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-400" />
                  <span>Top High EV Opportunities</span>
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                  Real-time algorithmic picks with maximum positive model edge.
                </p>
              </div>
              <Link href="/racing" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
                <span>View All Racing</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {oppsLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            ) : oppsError ? (
              <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <p className="text-sm font-semibold text-rose-400 mb-1">{oppsError}</p>
                <p className="text-xs text-slate-400">Please check back shortly for live market feed updates.</p>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                <Zap size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-bold text-slate-300">No High EV Opportunities Active</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  No positive value gaps detected in live feeds right now. Model scans update automatically with market odds.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => {
                  const inBetslip = isItemInSlip(opp.selectionName, opp.eventLabel);
                  const evVal = Math.round(opp.probability * 100);
                  const displayOdds = opp.marketOdds ?? opp.fairOdds;

                  return (
                    <div
                      key={opp.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                            {opp.sport}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">{opp.eventLabel}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-100">{opp.selectionName}</h3>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5">
                          <span>
                            Win Prob: <strong className="text-emerald-400">{evVal}%</strong>
                          </span>
                          <span>
                            Fair Odds: <strong className="text-slate-200">${opp.fairOdds.toFixed(2)}</strong>
                          </span>
                          {opp.marketOdds && (
                            <span>
                              Market Odds: <strong className="text-amber-400">${opp.marketOdds.toFixed(2)}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() =>
                            handleAddBet(
                              opp.sport,
                              opp.id,
                              opp.eventLabel,
                              opp.selectionName,
                              displayOdds
                            )
                          }
                          disabled={inBetslip}
                          className={`btn text-xs py-2 px-3.5 flex items-center gap-1.5 transition-all ${
                            inBetslip
                              ? "bg-slate-800 text-emerald-400 cursor-default border border-slate-700"
                              : "btn-primary shadow-sm"
                          }`}
                        >
                          {inBetslip ? (
                            <>
                              <Check size={14} className="text-emerald-400" />
                              <span>In Betslip</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>Add to Betslip</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Blackbook */}
        {activeTab === "blackbook" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <BookOpen size={18} className="text-purple-400" />
                  <span>Next Blackbookers</span>
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                  Tracked runners &amp; teams matching your automated alert filters.
                </p>
              </div>
              <Link
                href="/blackbook"
                className="btn btn-sm btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Manage Full Blackbook</span>
                <ExternalLink size={14} />
              </Link>
            </div>

            {blackbookLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            ) : isGuest ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <BookOpen size={32} className="mx-auto text-purple-400 mb-3" />
                <h3 className="text-base font-bold text-slate-200">Blackbook Tracking Locked</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Sign in to manage custom watch rules, track upcoming blackbookers, and set threshold notifications.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Link href="/login" className="btn btn-sm btn-primary text-xs">
                    Sign In
                  </Link>
                  <Link href="/blackbook" className="btn btn-sm btn-secondary text-xs">
                    Manage Full Blackbook
                  </Link>
                </div>
              </div>
            ) : blackbookItems.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <BookOpen size={32} className="mx-auto text-slate-600 mb-2" />
                <h3 className="text-base font-bold text-slate-300">No Active Blackbook Rules</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You haven&apos;t added any runners or teams to your personal watch list yet.
                </p>
                <div className="mt-4">
                  <Link href="/blackbook" className="btn btn-sm btn-secondary text-xs inline-flex items-center gap-1.5">
                    <Plus size={14} />
                    <span>Manage Full Blackbook</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {blackbookItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-100 text-sm">{item.runner}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {item.sport}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Type: <span className="text-slate-200 capitalize">{item.bet_type}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2.5 border-t border-slate-800/80">
                      <span>Default Stake: <strong>${item.stake}</strong></span>
                      <span>Min Prob: <strong>{item.probability_threshold}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Next Racing */}
        {activeTab === "next-racing" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-400" />
                  <span>Next Live Racing Cards</span>
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                  Live meetings &amp; top model-rated selections for upcoming races.
                </p>
              </div>
              <Link href="/racing" className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
                <span>All Race Cards</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {racesLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-20 rounded-xl" />
                <div className="skeleton h-20 rounded-xl" />
              </div>
            ) : racesError ? (
              <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <p className="text-sm font-semibold text-rose-400 mb-1">{racesError}</p>
                <p className="text-xs text-slate-400">Unable to load live racing data feed.</p>
              </div>
            ) : upcomingRaces.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <Trophy size={32} className="mx-auto text-slate-600 mb-2" />
                <h3 className="text-base font-bold text-slate-300">Awaiting Race Feeds</h3>
                <p className="text-xs text-slate-400 mt-1">
                  No upcoming race cards returned from the live engine right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {upcomingRaces.map((race) => {
                  const runner = race.topRunner;
                  const eventLabel = `${race.venue} R${race.race_number}`;
                  const inBetslip = runner ? isItemInSlip(runner.name, eventLabel) : false;
                  const displayOdds = runner?.market_odds ?? runner?.fair_odds;

                  return (
                    <div
                      key={race.race_id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {race.venue} R{race.race_number}
                            </span>
                            {race.start_time && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock size={12} />
                                <span>{race.start_time}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {runner ? (
                          <div className="mt-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Top Model Selection</div>
                            <div className="text-sm font-bold text-slate-100">{runner.name}</div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                              <span>Win Prob: <strong className="text-emerald-400">{Math.round(runner.win_probability * 100)}%</strong></span>
                              <span>Fair: <strong className="text-slate-200">${runner.fair_odds.toFixed(2)}</strong></span>
                              {runner.market_odds && (
                                <span>Market: <strong className="text-amber-400">${runner.market_odds.toFixed(2)}</strong></span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic mt-2">Field predictions pending model sync</div>
                        )}
                      </div>

                      {runner && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex justify-end">
                          <button
                            onClick={() =>
                              handleAddBet(
                                "racing",
                                `${race.race_id}-${runner.horse_id}`,
                                eventLabel,
                                runner.name,
                                displayOdds
                              )
                            }
                            disabled={inBetslip}
                            className={`btn text-xs py-1.5 px-3 flex items-center gap-1.5 transition-all ${
                              inBetslip
                                ? "bg-slate-800 text-emerald-400 cursor-default border border-slate-700"
                                : "btn-primary shadow-sm"
                            }`}
                          >
                            {inBetslip ? (
                              <>
                                <Check size={14} className="text-emerald-400" />
                                <span>In Betslip</span>
                              </>
                            ) : (
                              <>
                                <Plus size={14} />
                                <span>Add to Betslip</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Next Sport */}
        {activeTab === "next-sport" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Activity size={18} className="text-sky-400" />
                  <span>Next Sports Matches</span>
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                  Upcoming AFL, NBA, NRL, and Soccer fixtures with model probability outputs.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Link href="/afl" className="text-sky-400 hover:text-sky-300 font-semibold">AFL</Link>
                <span className="text-slate-600">•</span>
                <Link href="/nba" className="text-sky-400 hover:text-sky-300 font-semibold">NBA</Link>
                <span className="text-slate-600">•</span>
                <Link href="/nrl" className="text-sky-400 hover:text-sky-300 font-semibold">NRL</Link>
                <span className="text-slate-600">•</span>
                <Link href="/soccer" className="text-sky-400 hover:text-sky-300 font-semibold">Soccer</Link>
              </div>
            </div>

            {sportsLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-20 rounded-xl" />
                <div className="skeleton h-20 rounded-xl" />
              </div>
            ) : sportsError ? (
              <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <p className="text-sm font-semibold text-rose-400 mb-1">{sportsError}</p>
                <p className="text-xs text-slate-400">Unable to load sports prediction feed.</p>
              </div>
            ) : upcomingSports.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <Shield size={32} className="mx-auto text-slate-600 mb-2" />
                <h3 className="text-base font-bold text-slate-300">No Sports Fixtures Live</h3>
                <p className="text-xs text-slate-400 mt-1">
                  No upcoming sports matches found in the prediction pipeline right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {upcomingSports.map((sportItem) => {
                  const eventLabel = `${sportItem.home_team} vs ${sportItem.away_team}`;
                  const selection = sportItem.predicted_winner || sportItem.home_team;
                  const inBetslip = isItemInSlip(selection, eventLabel);
                  const displayOdds = sportItem.market_odds ?? sportItem.fair_odds;

                  return (
                    <div
                      key={sportItem.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                            {sportItem.sport}
                          </span>
                          {sportItem.match_time && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock size={12} />
                              <span>{sportItem.match_time}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-100 mt-1">{eventLabel}</h3>

                        {sportItem.predicted_winner && (
                          <div className="mt-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-slate-400">Model Pick: </span>
                              <strong className="text-sky-300">{sportItem.predicted_winner}</strong>
                            </div>
                            {sportItem.win_probability && (
                              <div className="text-emerald-400 font-bold">
                                {Math.round(sportItem.win_probability * 100)}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                          {displayOdds && (
                            <span>Odds: <strong className="text-slate-200">${displayOdds.toFixed(2)}</strong></span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleAddBet(
                              sportItem.sport,
                              sportItem.id,
                              eventLabel,
                              selection,
                              displayOdds
                            )
                          }
                          disabled={inBetslip}
                          className={`btn text-xs py-1.5 px-3 flex items-center gap-1.5 transition-all ${
                            inBetslip
                              ? "bg-slate-800 text-emerald-400 cursor-default border border-slate-700"
                              : "btn-primary shadow-sm"
                          }`}
                        >
                          {inBetslip ? (
                            <>
                              <Check size={14} className="text-emerald-400" />
                              <span>In Betslip</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>Add to Betslip</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
