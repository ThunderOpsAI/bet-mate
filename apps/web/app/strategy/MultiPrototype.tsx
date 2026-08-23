"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import PaperBetAction from "../components/PaperBetAction";

const MOCK_LEGS = [
  { event_name: "Goulburn R3", selection: "Peace Bird (5)", odds_used: 2.5 },
  { event_name: "Goulburn R3", selection: "Purple Rose (2)", odds_used: 1.8 },
  { event_name: "Goulburn R3", selection: "The Eyes Have It (1)", odds_used: 1.5 },
];

function MultiBetCardPrototypeInner({ bet, cardDisplayName, cardProfileKey }: any) {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") || "A";

  const legs = bet.legs || MOCK_LEGS;

  const renderVariantA = () => (
    <div className="bg-slate-900 border-2 border-emerald-500/20 rounded-xl overflow-hidden shadow-lg mb-4">
      {/* Sportsbet style header */}
      <div className="bg-[#1268b3] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white text-xs">M</span>
          <span className="text-sm font-bold text-white">Same Race Multi</span>
        </div>
        <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">11s</div>
      </div>
      
      {/* Body */}
      <div className="p-3 bg-white text-slate-900">
        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
          <div className="text-lg font-black">{bet.odds_used.toFixed(2)} <span className="text-sm font-normal text-slate-500">· {legs.length} legs</span></div>
          <div className="bg-slate-200 text-slate-600 text-[10px] px-2 py-1 rounded-full font-semibold">Top 4</div>
        </div>
        
        <div className="space-y-2 mb-4">
          {legs.map((leg: any, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-4 bg-yellow-400 rounded-sm mt-0.5 shrink-0 border border-slate-300"></div>
              <div className="flex-1">
                <div className="text-xs font-bold">{leg.selection}</div>
                <div className="text-[10px] text-slate-500">{leg.event_name}</div>
              </div>
            </div>
          ))}
        </div>
        
        <PaperBetAction
          variant="phase1"
          label={`Add to Bet Slip @ ${bet.odds_used.toFixed(2)}`}
          loggedLabel="Added to slip"
          cancelLabel="Remove from slip"
          fullWidth
          bet={{
            sport: "racing",
            event_id: bet.event_id,
            event_name: "Multi",
            selection: bet.selection,
            odds: bet.odds_used,
            bet_type: "multi",
            stake: bet.stake,
            notes: JSON.stringify({ strategy_name: cardDisplayName }),
            odds_source: "market",
          }}
        />
      </div>
    </div>
  );

  const renderVariantB = () => (
    <div className="bg-slate-950/70 border border-emerald-500/50 hover:border-emerald-400/80 rounded-xl p-3 space-y-2 mb-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-xl"></div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="badge badge-accent bg-emerald-500 text-white font-bold px-2 py-0.5 rounded text-[10px]">MULTI</span>
          <span className="text-xs text-slate-300 font-semibold">{legs.length} Legs</span>
        </div>
        <div className="text-sm font-bold text-emerald-400">${bet.stake.toFixed(2)} @ {bet.odds_used.toFixed(2)}</div>
      </div>
      
      <div className="flex flex-wrap gap-1.5 mt-2">
        {legs.map((leg: any, i: number) => (
          <div key={i} className="bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded-md text-slate-300">
            <span className="text-emerald-400 font-bold mr-1">{leg.selection.split(' ')[0]}</span> 
            {leg.selection.split(' ').slice(1).join(' ')}
          </div>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t border-slate-800/50">
        <PaperBetAction
            variant="phase1"
            label="Copy Multi to Slip"
            loggedLabel="Copied!"
            cancelLabel="Remove"
            fullWidth
            bet={{
              sport: "racing",
              event_id: bet.event_id,
              event_name: "Multi",
              selection: bet.selection,
              odds: bet.odds_used,
              bet_type: "multi",
              stake: bet.stake,
              notes: JSON.stringify({ strategy_name: cardDisplayName }),
              odds_source: "market",
            }}
          />
      </div>
    </div>
  );

  const renderVariantC = () => (
    <div className="bg-slate-900 rounded-xl mb-4 shadow-sm border border-slate-800">
      <div className="p-3 border-b border-slate-800 flex justify-between items-center">
         <div>
            <div className="text-xs font-bold text-slate-100 uppercase tracking-wider text-emerald-400">Same Race Multi</div>
            <div className="text-[10px] text-slate-500">{legs[0].event_name}</div>
         </div>
         <div className="text-right">
            <div className="text-lg font-bold text-white">{bet.odds_used.toFixed(2)}</div>
            <div className="text-[10px] text-emerald-500">${bet.stake.toFixed(2)} Stake</div>
         </div>
      </div>
      <div className="divide-y divide-slate-800/50">
        {legs.map((leg: any, i: number) => (
          <div key={i} className="p-2.5 px-3 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
            <div className="text-xs text-slate-300">{leg.selection}</div>
            <div className="text-[10px] text-slate-500">Leg {i+1}</div>
          </div>
        ))}
      </div>
      <div className="p-2 bg-slate-950 rounded-b-xl">
         <PaperBetAction
            variant="phase1"
            label="Add Multi"
            loggedLabel="Added"
            cancelLabel="Remove"
            fullWidth
            bet={{
              sport: "racing",
              event_id: bet.event_id,
              event_name: "Multi",
              selection: bet.selection,
              odds: bet.odds_used,
              bet_type: "multi",
              stake: bet.stake,
              notes: JSON.stringify({ strategy_name: cardDisplayName }),
              odds_source: "market",
            }}
          />
      </div>
    </div>
  );

  return (
    <div>
      {variant === "A" && renderVariantA()}
      {variant === "B" && renderVariantB()}
      {variant === "C" && renderVariantC()}
    </div>
  );
}

export function MultiBetCardPrototype(props: any) {
  return (
    <Suspense fallback={<div>Loading prototype...</div>}>
      <MultiBetCardPrototypeInner {...props} />
    </Suspense>
  );
}

function PrototypeSwitcherInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") || "A";
  
  if (process.env.NODE_ENV === "production") return null;

  const variants = ["A", "B", "C"];
  const currentIndex = variants.indexOf(variant);
  
  const handleNext = () => {
    const next = variants[(currentIndex + 1) % variants.length];
    router.replace(`${pathname}?variant=${next}`);
  };
  
  const handlePrev = () => {
    const prev = variants[(currentIndex - 1 + variants.length) % variants.length];
    router.replace(`${pathname}?variant=${prev}`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-1 py-1 gap-1 text-sm font-medium">
      <button onClick={handlePrev} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
        ←
      </button>
      <div className="px-4 py-1 text-slate-200 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        PROTOTYPE: Variant {variant}
      </div>
      <button onClick={handleNext} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
        →
      </button>
    </div>
  );
}

export function PrototypeSwitcher() {
  return (
    <Suspense fallback={null}>
      <PrototypeSwitcherInner />
    </Suspense>
  );
}
