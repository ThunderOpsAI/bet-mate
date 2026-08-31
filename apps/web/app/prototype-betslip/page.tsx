"use client";

import React, { useState, Suspense } from "react";
import { X, Check, Info } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// --- Mock Data ---
interface MockBet {
  id: string;
  eventName: string;
  selection: string;
  odds: number;
  type: "Win" | "Place" | "Each Way";
  stake: number;
  inMulti: boolean;
}

const INITIAL_BETS: MockBet[] = [
  { id: "1", eventName: "R1 Flemington", selection: "1. Leap To Fame", odds: 2.5, type: "Win", stake: 10, inMulti: true },
  { id: "2", eventName: "R2 Randwick", selection: "4. J. McDonald", odds: 3.2, type: "Win", stake: 0, inMulti: true },
  { id: "3", eventName: "R3 Caulfield", selection: "7. Victa Damian", odds: 4.8, type: "Win", stake: 0, inMulti: true },
  { id: "4", eventName: "R4 Rosehill", selection: "2. Ironclad Spirit", odds: 8.0, type: "Place", stake: 0, inMulti: true },
  { id: "5", eventName: "R5 Moonee Valley", selection: "9. Catch Me", odds: 15.0, type: "Win", stake: 0, inMulti: true },
  { id: "6", eventName: "R6 Ascot", selection: "3. Western Star", odds: 5.5, type: "Win", stake: 0, inMulti: false },
  { id: "7", eventName: "R7 Doomben", selection: "5. Queenslander", odds: 1.8, type: "Win", stake: 0, inMulti: false },
  { id: "8", eventName: "R8 Eagle Farm", selection: "11. Last Chance", odds: 21.0, type: "Each Way", stake: 5, inMulti: false },
];

function BetslipPrototypeContent() {
  const [bets, setBets] = useState<MockBet[]>(INITIAL_BETS);
  const [activeTab, setActiveTab] = useState<"Singles" | "Multi">("Singles");
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const variant = searchParams.get("variant") || "A";

  const updateBet = (id: string, updates: Partial<MockBet>) => {
    setBets(bets.map(b => b.id === id ? { ...b, ...updates } : b));
  };
  const removeBet = (id: string) => setBets(bets.filter(b => b.id !== id));

  const multiLegs = bets.filter(b => b.inMulti);
  const multiOdds = multiLegs.reduce((acc, bet) => acc * bet.odds, 1);
  const totalStake = bets.reduce((acc, bet) => acc + (bet.type === "Each Way" ? bet.stake * 2 : bet.stake), 0);
  const multiStake = 10;

  const oddsColor = variant === "B" ? "text-rose-300" : variant === "C" ? "text-fuchsia-200" : "text-orange-200";

  const renderSingleBet = (bet: MockBet) => (
    <div key={bet.id} className="p-3 mb-2 bg-slate-950 border border-slate-700 rounded-lg shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-2">
          <div className="text-[13px] text-slate-400 font-medium mb-1">{bet.eventName}</div>
          <div className="font-bold text-slate-100 text-[17px] leading-tight">{bet.selection}</div>
        </div>
        <button onClick={() => removeBet(bet.id)} className="text-slate-500 hover:text-slate-300 p-1 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col space-y-3">
        <div className="flex space-x-2">
          {["Win", "Place", "Each Way"].map((t) => {
            const isActive = bet.type === t;
            let activeClass = "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50";
            if (t === "Place") activeClass = "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50";
            if (t === "Each Way") activeClass = "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50";

            return (
              <button 
                key={t}
                onClick={() => updateBet(bet.id, { type: t as any })}
                className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                  isActive 
                    ? activeClass 
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {t === "Each Way" ? "E/W" : t}
              </button>
            );
          })}
        </div>
        
        <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
           <div className={`text-[17.5px] font-black ${oddsColor} ml-2`}>{bet.odds.toFixed(2)}</div>
           <div className="flex items-center space-x-2">
              <span className="text-[13px] font-bold text-slate-400 uppercase">Stake</span>
              <div className="relative w-24">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input 
                  type="number" 
                  value={bet.stake || ""} 
                  onChange={(e) => updateBet(bet.id, { stake: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 pl-6 pr-2 text-white text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-right"
                  placeholder="0"
                />
              </div>
           </div>
        </div>
        
        {bet.type === "Each Way" && (
          <div className="text-[13px] text-right text-slate-400 font-medium pr-1">Total Return: ${(bet.stake * 2 * bet.odds).toFixed(2)} | Cost: ${(bet.stake * 2).toFixed(2)}</div>
        )}
      </div>
    </div>
  );

  const renderMultiLeg = (bet: MockBet) => (
    <div key={bet.id} className="flex items-center justify-between p-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <button 
          onClick={() => updateBet(bet.id, { inMulti: !bet.inMulti })}
          className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${bet.inMulti ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600"}`}
        >
          {bet.inMulti && <Check size={14} />}
        </button>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-200 truncate">{bet.selection}</div>
          <div className="flex items-center space-x-2 text-[13px]">
            <span className="text-slate-400">{bet.eventName}</span>
            <span className="text-slate-600">•</span>
            <button 
              onClick={() => updateBet(bet.id, { type: bet.type === "Win" ? "Place" : "Win" })}
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              {bet.type}
            </button>
          </div>
        </div>
      </div>
      <div className={`text-[15px] font-black ${oddsColor} ml-4 shrink-0`}>
        {bet.inMulti ? bet.odds.toFixed(2) : <span className="text-slate-600 line-through">{bet.odds.toFixed(2)}</span>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row pb-20">
      <div className="flex-1 p-8 border-r border-slate-800 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Betslip UI Prototype</h1>
        <p className="text-slate-400 mb-6">Exploring UI variations for betslip visibility and multi construction.</p>
        <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300">
          State Dump:
          <pre className="mt-2 text-emerald-300">{JSON.stringify(bets.map(b => ({ id: b.id, type: b.type, inMulti: b.inMulti, stake: b.stake })), null, 2)}</pre>
        </div>
      </div>

      <div className="w-full md:w-[380px] bg-slate-900 flex flex-col h-screen border-l border-slate-800 shadow-2xl relative">
        <div className="bg-slate-800 border-b border-slate-700 p-3 flex justify-between items-center shrink-0">
          <div className="font-extrabold text-slate-100 flex items-center space-x-2">
            <span>Bet Slip</span>
            <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">{bets.length}</span>
          </div>
          <X className="text-slate-400 cursor-pointer" size={18} />
        </div>

        <div className="flex bg-slate-950 border-b border-slate-800 shrink-0">
          <button 
            onClick={() => setActiveTab("Singles")}
            className={`flex-1 py-3 text-sm font-bold text-center transition-colors border-b-2 ${activeTab === "Singles" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:bg-slate-800"}`}
          >
            Singles
          </button>
          <button 
            onClick={() => setActiveTab("Multi")}
            className={`flex-1 py-3 text-sm font-bold text-center transition-colors border-b-2 ${activeTab === "Multi" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:bg-slate-800"}`}
          >
            Multi ({multiLegs.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
          {activeTab === "Singles" && <div className="space-y-1">{bets.map(renderSingleBet)}</div>}
          {activeTab === "Multi" && (
            <div className="p-2">
              <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-sm mb-4">
                <div className="bg-slate-800 p-3 border-b border-slate-700 rounded-t-lg flex justify-between items-center">
                  <div className="font-bold text-slate-100">{multiLegs.length}-Leg Multi</div>
                  <div className={`text-lg font-black ${oddsColor}`}>{multiOdds.toFixed(2)}</div>
                </div>
                <div className="py-1">{bets.map(renderMultiLeg)}</div>
                <div className="p-3 border-t border-slate-800 bg-slate-950 rounded-b-lg flex justify-end">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Stake</span>
                    <div className="relative w-24">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                      <input 
                        type="number" 
                        value={multiStake} 
                        readOnly 
                        className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 pl-6 pr-2 text-white text-sm font-bold text-right" 
                        placeholder="0" 
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 text-center px-4">
                <Info size={12} className="inline mr-1" />
                Uncheck legs to exclude them from this multi, or toggle Win/Place to adjust odds.
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-950 border-t border-slate-800 p-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-slate-400 text-sm">Total Stake</span>
            <span className="text-lg font-bold text-white">${activeTab === "Singles" ? totalStake.toFixed(2) : multiStake.toFixed(2)}</span>
          </div>
          <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors flex justify-center items-center">
            Place Bets
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-700 p-3 flex items-center justify-center gap-4 z-50">
        <span className="text-sm text-slate-400">PROTOTYPE VARIATIONS:</span>
        <button onClick={() => router.push(pathname + "?variant=A")} className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${variant === "A" ? "bg-orange-200 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>A: Pastel Peach</button>
        <button onClick={() => router.push(pathname + "?variant=B")} className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${variant === "B" ? "bg-rose-300 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>B: Soft Rose</button>
        <button onClick={() => router.push(pathname + "?variant=C")} className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${variant === "C" ? "bg-fuchsia-200 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>C: Light Lavender</button>
      </div>
    </div>
  );
}

export default function BetslipPrototype() {
  return (
    <Suspense fallback={<div>Loading Prototype...</div>}>
      <BetslipPrototypeContent />
    </Suspense>
  );
}
