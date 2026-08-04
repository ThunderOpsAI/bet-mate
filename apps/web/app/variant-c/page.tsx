"use client";

export const dynamic = 'force-dynamic';

import React from "react";
import VariantC_TimelineStream from "../components/VariantC_TimelineStream";

export default function VariantCPage() {
  return (
    <div className="min-h-screen bg-[#07090E] text-white">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-sm font-extrabold tracking-wider text-cyan-400 uppercase">
          VARIANT C — CHRONOLOGICAL TIMELINE STREAM
        </h1>
        <div className="flex items-center gap-3 text-xs">
          <a href="/variant-a" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">← Switch to Variant A</a>
          <a href="/variant-b" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">← Switch to Variant B</a>
        </div>
      </div>

      <VariantC_TimelineStream
        racesData={[
          { race_id: "rc1", venue: "Flemington", race_number: 1, distance: 1000, start_time: "2026-08-04T12:30:00Z", horses: [{ name: "Storm Boy", betfair_back_price: 1.80 }] },
          { race_id: "rc2", venue: "Rosehill", race_number: 3, distance: 1500, start_time: "2026-08-04T14:15:00Z", horses: [{ name: "Fangirl", betfair_back_price: 2.20 }] },
          { race_id: "rc3", venue: "Doomben", race_number: 6, distance: 1200, start_time: "2026-08-04T16:00:00Z", horses: [{ name: "Giga Kick", betfair_back_price: 3.50 }] },
        ]}
        allOpportunities={[]}
        isLoading={false}
        onOpenPaperBet={() => {}}
        onOpenBobModal={() => {}}
      />
    </div>
  );
}
