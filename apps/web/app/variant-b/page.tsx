"use client";

export const dynamic = 'force-dynamic';

import React from "react";
import VariantB_SplitWorkspace from "../components/VariantB_SplitWorkspace";

export default function VariantBPage() {
  return (
    <div className="min-h-screen bg-[#07090E] text-white">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-sm font-extrabold tracking-wider text-purple-400 uppercase">
          VARIANT B — DUAL-COLUMN SPLIT WORKSPACE
        </h1>
        <div className="flex items-center gap-3 text-xs">
          <a href="/variant-a" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">← Switch to Variant A</a>
          <a href="/variant-c" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">Switch to Variant C →</a>
        </div>
      </div>

      <VariantB_SplitWorkspace
        racesData={[
          { race_id: "r1", venue: "Flemington", race_number: 7, distance: 1200, horses: [{ name: "Imperatriz", betfair_back_price: 2.40 }] },
          { race_id: "r2", venue: "Randwick", race_number: 5, distance: 1400, horses: [{ name: "Via Sistina", betfair_back_price: 3.10 }] },
          { race_id: "r3", venue: "Caulfield", race_number: 8, distance: 1600, horses: [{ name: "Mr Brightside", betfair_back_price: 1.95 }] },
        ]}
        allOpportunities={[
          { id: "o1", selection: "Imperatriz", event: "Flemington R7", edge: 14.2 },
          { id: "o2", selection: "Via Sistina", event: "Randwick R5", edge: 9.8 },
        ]}
        isLoading={false}
        onOpenPaperBet={() => {}}
        onOpenBobModal={() => {}}
      />
    </div>
  );
}
