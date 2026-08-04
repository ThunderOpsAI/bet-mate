"use client";

import React from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Clock, TrendingUp, Trophy, ArrowUpRight, Zap } from "lucide-react";

interface VariantProps {
  racesData: any[];
  allOpportunities: any[];
  aflData?: any[];
  nbaData?: any[];
  nrlData?: any[];
  soccerData?: any[];
  golfData?: any[];
  mmaData?: any[];
  isLoading?: boolean;
  onOpenPaperBet: (bet: any) => void;
  onOpenBobModal: (ctx: any) => void;
}

export default function VariantC_TimelineStream({
  racesData = [],
  allOpportunities = [],
  isLoading = false,
}: VariantProps) {
  return (
    <div className="w-full max-w-[900px] mx-auto p-4 md:p-6 pb-24 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" /> Sequential Timeline Stream
          </h2>
          <p className="text-xs text-slate-400">Chronological feed of upcoming races, sports, and EV signals</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
          Variant C
        </span>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800 animate-pulse">
          Connecting to live timeline stream...
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-slate-800 flex flex-col gap-6">
          {racesData.slice(0, 8).map((race, idx) => (
            <div key={race.race_id || idx} className="relative bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-2">
              <div className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {race.start_time ? format(new Date(race.start_time), 'HH:mm EEE') : 'Upcoming'}
                </span>
                <span className="text-xs text-slate-400">R{race.race_number} • {race.distance}m</span>
              </div>
              <div className="text-sm font-bold text-white">{race.venue}</div>
              {race.horses?.[0] && (
                <div className="text-xs text-slate-300 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span>Top Pick: <strong className="text-white">{race.horses[0].name}</strong></span>
                  {race.horses[0].betfair_back_price && (
                    <span className="font-mono text-emerald-400 font-bold">${race.horses[0].betfair_back_price.toFixed(2)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
