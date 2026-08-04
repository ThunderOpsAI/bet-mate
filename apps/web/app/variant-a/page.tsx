"use client";

export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import VariantA_CyberpunkTerminal from "../components/VariantA_CyberpunkTerminal";

export default function VariantAPage() {
  const [activeExplanation, setActiveExplanation] = useState<any>(null);

  return (
    <div className="min-h-screen bg-[#07090E] text-white">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-sm font-extrabold tracking-wider text-emerald-400 uppercase">
          VARIANT A — CYBERPUNK HIGH-DENSITY TERMINAL
        </h1>
        <div className="flex items-center gap-3 text-xs">
          <a href="/variant-b" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">Switch to Variant B →</a>
          <a href="/variant-c" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">Switch to Variant C →</a>
        </div>
      </div>

      <VariantA_CyberpunkTerminal
        racesData={[]}
        allOpportunities={[]}
        aflData={[]}
        nbaData={[]}
        nrlData={[]}
        soccerData={[]}
        golfData={[]}
        mmaData={[]}
        isLoading={false}
        onOpenPaperBet={() => {}}
        onOpenBobModal={() => {}}
      />
    </div>
  );
}
