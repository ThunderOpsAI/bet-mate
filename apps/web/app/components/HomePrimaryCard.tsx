"use client";

import React from "react";
import Link from "next/link";
import { Zap, BookOpen, Trophy, Activity, ArrowRight, Plus, Check, Clock, ExternalLink, Shield } from "lucide-react";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { RankedOpportunity } from "../lib/opportunityScore";

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
  // High EV card
  opportunities: RankedOpportunity[];
  oppsLoading: boolean;
  oppsError: string | null;

  // Blackbook card
  blackbookItems: BlackbookItem[];
  blackbookLoading: boolean;
  isGuest: boolean;

  // Next Racing card
  upcomingRaces: UpcomingRaceItem[];
  racesLoading: boolean;
  racesError: string | null;

  // Next Sport card
  upcomingSports: UpcomingSportItem[];
  sportsLoading: boolean;
  sportsError: string | null;

  racingLinkHref?: string;
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
  racingLinkHref = "/racing",
}: HomePrimaryCardProps) {
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

  // Limit items to max 3 per card
  const topOpportunities = opportunities.slice(0, 3);
  const topBlackbook = blackbookItems.slice(0, 3);
  const topRaces = upcomingRaces.slice(0, 3);
  const topSports = upcomingSports.slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
      {/* Card 1: High EV Chances */}
      <section className="bg-slate-900/90 border border-slate-400/35 hover:border-slate-300/50 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden flex flex-col justify-between p-5 sm:p-6 md:p-7 transition-all">
        <div>
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>High EV Chances</span>
                {opportunities.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {opportunities.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Top algorithmic value picks today</p>
            </div>
            <Link href={racingLinkHref} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {oppsLoading ? (
            <div className="space-y-2.5">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          ) : oppsError ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <p className="text-xs font-semibold text-rose-400 mb-1">{oppsError}</p>
              <p className="text-[11px] text-slate-400">Please check back shortly for live market updates.</p>
            </div>
          ) : topOpportunities.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center flex-1 flex flex-col justify-center items-center">
              <Zap size={24} className="text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-300">No High EV Opportunities Active</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                No positive value gaps detected in live feeds right now.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topOpportunities.map((opp) => {
                const inBetslip = isItemInSlip(opp.selectionName, opp.eventLabel);
                const evVal = Math.round(opp.probability * 100);
                const displayOdds = opp.marketOdds ?? opp.fairOdds;

                return (
                  <div
                    key={opp.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                          {opp.sport}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">{opp.eventLabel}</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{opp.selectionName}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Win: <strong className="text-emerald-400">{evVal}%</strong></span>
                        <span>Fair: <strong className="text-slate-200">${opp.fairOdds.toFixed(2)}</strong></span>
                        {opp.marketOdds && (
                          <span>Mkt: <strong className="text-amber-400">${opp.marketOdds.toFixed(2)}</strong></span>
                        )}
                      </div>
                    </div>

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
                      className={`btn text-[11px] py-1.5 px-2.5 flex items-center gap-1 transition-all shrink-0 ${
                        inBetslip
                          ? "bg-slate-800 text-emerald-400 cursor-default border border-slate-700"
                          : "btn-primary shadow-sm"
                      }`}
                    >
                      {inBetslip ? (
                        <>
                          <Check size={13} className="text-emerald-400" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>+ Add to Betslip</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Card 2: Next Blackbookers */}
      <section className="bg-slate-900/90 border border-slate-400/35 hover:border-slate-300/50 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden flex flex-col justify-between p-5 sm:p-6 md:p-7 transition-all">
        <div>
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Next Blackbookers</span>
                {blackbookItems.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {blackbookItems.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Tracked runners matching alert rules</p>
            </div>
            <Link
              href="/blackbook"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
            >
              <span>Manage Full Blackbook</span>
              <ExternalLink size={13} />
            </Link>
          </div>

          {blackbookLoading ? (
            <div className="space-y-2.5">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          ) : isGuest ? (
            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center flex-1 flex flex-col justify-center items-center">
              <BookOpen size={24} className="text-purple-400 mb-2" />
              <p className="text-xs font-bold text-slate-200">Blackbook Tracking Locked</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                Sign in to manage watch rules and threshold alerts.
              </p>
              <div className="mt-3 flex gap-2">
                <Link href="/login" className="btn btn-sm btn-primary text-[11px] py-1 px-3">
                  Sign In
                </Link>
                <Link href="/blackbook" className="btn btn-sm btn-secondary text-[11px] py-1 px-3">
                  Manage Full Blackbook
                </Link>
              </div>
            </div>
          ) : topBlackbook.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center flex-1 flex flex-col justify-center items-center">
              <BookOpen size={24} className="text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-300">No Active Blackbook Rules</p>
              <p className="text-[11px] text-slate-400 mt-1">No tracked runners in your watch list.</p>
              <Link href="/blackbook" className="mt-3 text-xs font-semibold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1">
                <span>Manage Full Blackbook</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topBlackbook.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 px-4 sm:px-5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 text-xs sm:text-sm truncate">{item.runner}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                      {item.sport}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>Type: <strong className="text-slate-200 capitalize">{item.bet_type}</strong></span>
                    <span>Stake: <strong className="text-slate-200">${item.stake}</strong></span>
                    <span>Min Prob: <strong className="text-purple-300">{item.probability_threshold}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Card 3: Next Racing */}
      <section className="bg-slate-900/90 border border-slate-400/35 hover:border-slate-300/50 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden flex flex-col justify-between p-5 sm:p-6 md:p-7 transition-all">
        <div>
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Next Racing</span>
                {upcomingRaces.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {upcomingRaces.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Upcoming race cards & top runners</p>
            </div>
            <Link href={racingLinkHref} className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
              <span>View All Racing</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {racesLoading ? (
            <div className="space-y-2.5">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          ) : racesError ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <p className="text-xs font-semibold text-rose-400 mb-1">{racesError}</p>
              <p className="text-[11px] text-slate-400">Unable to load live racing data feed.</p>
            </div>
          ) : topRaces.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center flex-1 flex flex-col justify-center items-center">
              <Trophy size={24} className="text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-300">Awaiting Race Feeds</p>
              <p className="text-[11px] text-slate-400 mt-1">No upcoming races returned currently.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topRaces.map((race) => {
                const runner = race.topRunner;
                const eventLabel = `${race.venue} R${race.race_number}`;
                const inBetslip = runner ? isItemInSlip(runner.name, eventLabel) : false;
                const displayOdds = runner?.market_odds ?? runner?.fair_odds;

                return (
                  <div
                    key={race.race_id}
                    className="p-3.5 px-4 sm:px-5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {race.venue} R{race.race_number}
                        </span>
                        {race.start_time && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Clock size={11} />
                            <span>{race.start_time}</span>
                          </span>
                        )}
                      </div>
                      {runner ? (
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">{runner.name}</div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>Win: <strong className="text-emerald-400">{Math.round(runner.win_probability * 100)}%</strong></span>
                            <span>Fair: <strong className="text-slate-200">${runner.fair_odds.toFixed(2)}</strong></span>
                            {runner.market_odds && (
                              <span>Mkt: <strong className="text-amber-400">${runner.market_odds.toFixed(2)}</strong></span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">Predictions pending</div>
                      )}
                    </div>

                    {runner && (
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
                        className={`btn text-[11px] py-1.5 px-2.5 flex items-center gap-1 transition-all shrink-0 ${
                          inBetslip
                            ? "bg-slate-800 text-emerald-400 cursor-default border border-slate-700"
                            : "btn-primary shadow-sm"
                        }`}
                      >
                        {inBetslip ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            <span>+ Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Card 4: Next Sport */}
      <section className="bg-slate-900/90 border border-slate-400/35 hover:border-slate-300/50 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden flex flex-col justify-between p-5 sm:p-6 md:p-7 transition-all">
        <div>
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Next Sport</span>
                {upcomingSports.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {upcomingSports.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Upcoming AFL, NBA, NRL & Soccer</p>
            </div>
            <Link href="/nba" className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors">
              <span>View Sports</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {sportsLoading ? (
            <div className="space-y-2.5">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          ) : sportsError ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <p className="text-xs font-semibold text-rose-400 mb-1">{sportsError}</p>
              <p className="text-[11px] text-slate-400">Unable to load sports prediction feed.</p>
            </div>
          ) : topSports.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center flex-1 flex flex-col justify-center items-center">
              <Shield size={24} className="text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-300">No Sports Fixtures Live</p>
              <p className="text-[11px] text-slate-400 mt-1">No upcoming sports matches found.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topSports.map((sportItem) => {
                const eventLabel = `${sportItem.home_team} vs ${sportItem.away_team}`;
                const selection = sportItem.predicted_winner || sportItem.home_team;
                const inBetslip = isItemInSlip(selection, eventLabel);
                const displayOdds = sportItem.market_odds ?? sportItem.fair_odds;

                return (
                  <div
                    key={sportItem.id}
                    className="p-3.5 px-4 sm:px-5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-sky-500/40 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                          {sportItem.sport}
                        </span>
                        {sportItem.match_time && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 truncate">
                            <Clock size={11} />
                            <span>{sportItem.match_time}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{eventLabel}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        {sportItem.predicted_winner && (
                          <span>Pick: <strong className="text-sky-300">{sportItem.predicted_winner}</strong></span>
                        )}
                        {sportItem.win_probability && (
                          <span>Prob: <strong className="text-emerald-400">{Math.round(sportItem.win_probability * 100)}%</strong></span>
                        )}
                        {displayOdds && (
                          <span>Odds: <strong className="text-slate-200">${displayOdds.toFixed(2)}</strong></span>
                        )}
                      </div>
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
                      className={`btn text-[11px] py-1.5 px-2.5 flex items-center gap-1 transition-all shrink-0 ${
                        inBetslip
                          ? "bg-slate-800 text-emerald-400 cursor-default border border-slate-700"
                          : "btn-primary shadow-sm"
                      }`}
                    >
                      {inBetslip ? (
                        <>
                          <Check size={13} className="text-emerald-400" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>+ Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
