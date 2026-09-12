"use client";

import React, { useState } from "react";
import { 
  Home, Trophy, Activity, MessageCircle, ChevronRight, 
  BarChart3, TrendingUp, Bot, X, Zap, Target, BookOpen, 
  ListOrdered
} from "lucide-react";

// --- PROTOTYPE DATA ---
const SPORTS = ["NBA", "NFL", "AFL", "NRL", "SOCCER", "MMA", "GOLF"];

const UPCOMING_NFL_GAMES = [
  { id: 1, home: "Chiefs", away: "Ravens", time: "Tomorrow, 8:20 PM", spread: "KC -3.0", overUnder: "46.5" },
  { id: 2, home: "Eagles", away: "Packers", time: "Fri, 8:15 PM", spread: "PHI -2.5", overUnder: "48.5" },
];

const GAME_DETAILS = {
  home: {
    name: "Kansas City Chiefs",
    short: "KC",
    form: ["W", "W", "L", "W", "W"],
    stats: { ppg: 29.2, passYds: 284.5, rushYds: 104.9, defPpg: 17.3 },
    formDetails: ["W 25-22 vs SF", "W 17-10 @ BAL", "W 27-24 @ BUF", "W 26-7 vs MIA", "L 14-20 vs LV"]
  },
  away: {
    name: "Baltimore Ravens",
    short: "BAL",
    form: ["L", "W", "W", "W", "W"],
    stats: { ppg: 28.4, passYds: 213.8, rushYds: 156.5, defPpg: 16.5 },
    formDetails: ["L 10-17 vs KC", "W 34-10 vs HOU", "L 10-17 vs PIT", "W 56-19 vs MIA", "W 33-19 @ SF"]
  },
  analysis: "This AFC Championship rematch features the ultimate clash of styles. The Chiefs' defense proved they could contain Lamar Jackson in January, holding the Ravens to just 10 points. However, Baltimore has revamped their rushing attack with Derrick Henry, adding a punishing downhill element that Kansas City's lighter defensive front hasn't seen. The key matchup will be Patrick Mahomes against Baltimore's disguised coverage schemes—Mahomes boasts a 114.2 passer rating against the blitz, meaning the Ravens must generate pressure with four."
};

// --- COMPONENTS ---

export default function PrototypePage() {
  const [currentTab, setCurrentTab] = useState("home");
  const [currentScreen, setCurrentScreen] = useState("main"); // main, sport_list, game_detail
  const [selectedSport, setSelectedSport] = useState("");
  const [variant, setVariant] = useState(1);
  const [isBobOpen, setIsBobOpen] = useState(false);

  const navigateToSport = (sport: string) => {
    setSelectedSport(sport);
    setCurrentScreen("sport_list");
  };

  const navigateToGame = () => {
    setCurrentScreen("game_detail");
  };

  const navigateBack = () => {
    if (currentScreen === "game_detail") setCurrentScreen("sport_list");
    else if (currentScreen === "sport_list") setCurrentScreen("main");
  };

  // Determines if Bob bubble should be shown
  const showBob = ["racing", "sport", "lab"].includes(currentTab);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-950 text-white relative border-x border-gray-800 shadow-2xl overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          {currentScreen !== "main" && (
            <button onClick={navigateBack} className="p-1 -ml-1 text-gray-400 hover:text-white">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
          )}
          <h1 className="text-xl font-black italic tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            BETMATE
          </h1>
        </div>
        <div className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded">PROTOTYPE</div>
      </div>

      {/* PROTOTYPE VARIANT SWITCHER (Only visible on Game Details) */}
      {currentScreen === "game_detail" && (
        <div className="bg-indigo-950 border-b border-indigo-900 p-2 flex justify-center gap-2 shrink-0 shadow-lg relative z-30">
          <div className="text-[10px] text-indigo-300 font-bold uppercase mr-2 flex items-center">Variants</div>
          <button onClick={() => setVariant(1)} className={`text-xs px-3 py-1 rounded-full ${variant === 1 ? 'bg-indigo-500 text-white font-bold' : 'bg-indigo-900/50 text-indigo-300'}`}>1: Analyst</button>
          <button onClick={() => setVariant(2)} className={`text-xs px-3 py-1 rounded-full ${variant === 2 ? 'bg-indigo-500 text-white font-bold' : 'bg-indigo-900/50 text-indigo-300'}`}>2: Quant</button>
          <button onClick={() => setVariant(3)} className={`text-xs px-3 py-1 rounded-full ${variant === 3 ? 'bg-indigo-500 text-white font-bold' : 'bg-indigo-900/50 text-indigo-300'}`}>3: Visual</button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-6 relative">
        
        {/* === HOME TAB === */}
        {currentTab === "home" && currentScreen === "main" && (
          <div className="p-4 space-y-6 flex flex-col min-h-full">
            
            {/* High EV Feed (Top) */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <h2 className="text-lg font-bold">HIGH EV FEED</h2>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                        +8.5% EV
                      </div>
                      <div className="text-xs text-gray-400">NFL • KC @ BAL</div>
                    </div>
                    <div className="font-medium text-lg">Travis Kelce Any Time TD</div>
                    <div className="flex justify-between mt-3 text-sm">
                      <span className="text-gray-400">Best Odds: <span className="text-white font-bold">$2.40</span></span>
                      <span className="text-gray-400">True Prob: <span className="text-white font-bold">45%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Split Buttons (Bottom of Home) */}
            <div className="grid grid-cols-2 gap-3 pt-6 mt-auto">
              <button 
                onClick={() => { setCurrentTab("sport"); setCurrentScreen("main"); }}
                className="bg-gradient-to-br from-blue-900 to-indigo-900 border border-blue-700/50 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(59,130,246,0.15)]"
              >
                <Trophy className="w-10 h-10 text-blue-400" />
                <span className="text-xl font-black tracking-widest text-blue-100">SPORT</span>
              </button>
              
              <button 
                onClick={() => { setCurrentTab("racing"); setCurrentScreen("main"); }}
                className="bg-gradient-to-br from-orange-900 to-red-900 border border-orange-700/50 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(249,115,22,0.15)]"
              >
                <Activity className="w-10 h-10 text-orange-400" />
                <span className="text-xl font-black tracking-widest text-orange-100">RACING</span>
              </button>
            </div>
          </div>
        )}

        {/* === SPORT TAB (Menu) === */}
        {currentTab === "sport" && currentScreen === "main" && (
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-bold mb-4">SPORTS</h2>
            <div className="flex flex-col gap-2">
              {SPORTS.map(sport => (
                <button 
                  key={sport} 
                  onClick={() => navigateToSport(sport)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 p-4 rounded-xl flex justify-between items-center transition-colors"
                >
                  <span className="font-bold text-lg">{sport}</span>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* === SPORT MATCH LIST === */}
        {currentTab === "sport" && currentScreen === "sport_list" && (
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-bold mb-4">{selectedSport} - Upcoming Matches</h2>
            <div className="space-y-3">
              {UPCOMING_NFL_GAMES.map(game => (
                <button 
                  key={game.id}
                  onClick={navigateToGame}
                  className="w-full bg-gray-900 border border-gray-800 p-4 rounded-xl text-left hover:border-gray-600 transition-colors shadow-md"
                >
                  <div className="text-xs text-gray-400 mb-2">{game.time}</div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-lg">{game.away}</span>
                    <span className="text-gray-500 font-semibold">@</span>
                    <span className="font-bold text-lg">{game.home}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-800">
                    <span className="text-gray-400">Spread: {game.spread}</span>
                    <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                      Deep Stats & Analysis <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* === GAME STATS (3 VARIANTS) === */}
        {currentTab === "sport" && currentScreen === "game_detail" && (
          <div>
            {/* Common Header */}
            <div className="bg-gray-900 p-6 border-b border-gray-800 text-center">
              <div className="flex justify-center items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-black">{GAME_DETAILS.away.short}</div>
                  <div className="text-xs text-gray-400">Away</div>
                </div>
                <div className="text-gray-500 font-bold">VS</div>
                <div className="text-center">
                  <div className="text-2xl font-black">{GAME_DETAILS.home.short}</div>
                  <div className="text-xs text-gray-400">Home</div>
                </div>
              </div>
            </div>

            {/* VARIANT 1: The Analyst (Text/Insight Heavy) */}
            {variant === 1 && (
              <div className="p-4 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-lg">Matchup Analysis</h3>
                </div>
                <div className="bg-purple-900/10 border border-purple-500/20 p-5 rounded-xl leading-relaxed text-gray-300 text-sm">
                  {GAME_DETAILS.analysis}
                </div>
                
                <h3 className="font-bold text-lg pt-4 border-t border-gray-800">Recent Form Summary</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-gray-400 mb-2">{GAME_DETAILS.home.name}</h4>
                    <p className="text-sm text-gray-300">
                      Won 4 of their last 5, including tight victories over SF and BUF. Only recent stumble was a low-scoring divisional loss to LV.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-400 mb-2">{GAME_DETAILS.away.name}</h4>
                    <p className="text-sm text-gray-300">
                      Coming off a loss to KC, but previously dominated 4 straight opponents including massive blowouts over MIA and HOU.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VARIANT 2: The Quant (Data/Table Heavy) */}
            {variant === 2 && (
              <div className="p-4 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <ListOrdered className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-lg">Statistical Breakdown</h3>
                </div>
                
                <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                  <table className="w-full text-sm text-center">
                    <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="py-2 pl-3 text-left font-medium">Metric</th>
                        <th className="py-2 font-medium">{GAME_DETAILS.away.short}</th>
                        <th className="py-2 font-medium">{GAME_DETAILS.home.short}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      <tr>
                        <td className="py-3 pl-3 text-left text-gray-400">Pts/Game</td>
                        <td className="py-3 font-mono">{GAME_DETAILS.away.stats.ppg}</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{GAME_DETAILS.home.stats.ppg}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pl-3 text-left text-gray-400">Pass Yds</td>
                        <td className="py-3 font-mono">{GAME_DETAILS.away.stats.passYds}</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{GAME_DETAILS.home.stats.passYds}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pl-3 text-left text-gray-400">Rush Yds</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{GAME_DETAILS.away.stats.rushYds}</td>
                        <td className="py-3 font-mono">{GAME_DETAILS.home.stats.rushYds}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pl-3 text-left text-gray-400">Def Pts/G</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{GAME_DETAILS.away.stats.defPpg}</td>
                        <td className="py-3 font-mono">{GAME_DETAILS.home.stats.defPpg}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="font-bold text-lg pt-4 border-t border-gray-800">Last 5 Games Log</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-bold mb-2 text-center text-sm">{GAME_DETAILS.away.short} Log</div>
                    <div className="space-y-1">
                      {GAME_DETAILS.away.formDetails.map((g, i) => (
                        <div key={i} className="text-xs font-mono bg-gray-900 p-2 rounded text-center border border-gray-800">
                          <span className={g.startsWith('W') ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{g[0]}</span> {g.slice(1)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold mb-2 text-center text-sm">{GAME_DETAILS.home.short} Log</div>
                    <div className="space-y-1">
                      {GAME_DETAILS.home.formDetails.map((g, i) => (
                        <div key={i} className="text-xs font-mono bg-gray-900 p-2 rounded text-center border border-gray-800">
                          <span className={g.startsWith('W') ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{g[0]}</span> {g.slice(1)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VARIANT 3: The Visualizer (Bars/Cards) */}
            {variant === 3 && (
              <div className="p-4 space-y-8">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-lg">Head-to-Head Visuals</h3>
                </div>

                <div className="space-y-6 bg-gray-900 p-5 rounded-xl border border-gray-800">
                  {/* Visual Stat Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 text-gray-400 font-bold tracking-wider">
                      <span>{GAME_DETAILS.away.short} PPG ({GAME_DETAILS.away.stats.ppg})</span>
                      <span>{GAME_DETAILS.home.short} PPG ({GAME_DETAILS.home.stats.ppg})</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500" style={{ width: '49%' }}></div>
                      <div className="h-full bg-red-500" style={{ width: '51%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5 text-gray-400 font-bold tracking-wider">
                      <span>{GAME_DETAILS.away.short} PASS ({GAME_DETAILS.away.stats.passYds})</span>
                      <span>{GAME_DETAILS.home.short} PASS ({GAME_DETAILS.home.stats.passYds})</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500" style={{ width: '43%' }}></div>
                      <div className="h-full bg-red-500" style={{ width: '57%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5 text-gray-400 font-bold tracking-wider">
                      <span>{GAME_DETAILS.away.short} RUSH ({GAME_DETAILS.away.stats.rushYds})</span>
                      <span>{GAME_DETAILS.home.short} RUSH ({GAME_DETAILS.home.stats.rushYds})</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500" style={{ width: '60%' }}></div>
                      <div className="h-full bg-red-500" style={{ width: '40%' }}></div>
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-lg pt-2">Visual Form Guide</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
                    <span className="font-black text-lg w-12">{GAME_DETAILS.away.short}</span>
                    <div className="flex gap-2">
                      {GAME_DETAILS.away.form.map((res, i) => (
                        <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${res === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
                          {res}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
                    <span className="font-black text-lg w-12">{GAME_DETAILS.home.short}</span>
                    <div className="flex gap-2">
                      {GAME_DETAILS.home.form.map((res, i) => (
                        <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${res === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
                          {res}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* FLOATING BOB BUBBLE */}
      {showBob && (
        <div className="absolute bottom-20 right-4 z-40">
          <button 
            onClick={() => setIsBobOpen(!isBobOpen)}
            className="w-14 h-14 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center hover:scale-105 transition-transform border-2 border-white/10"
          >
            <Bot className="w-7 h-7 text-white" />
          </button>
          
          {/* Mock Chat Popup */}
          {isBobOpen && (
            <div className="absolute bottom-16 right-0 w-64 bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-2xl">
              <div className="flex justify-between items-start mb-3">
                <div className="font-bold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-400" /> Ask Bob
                </div>
                <button onClick={() => setIsBobOpen(false)}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button>
              </div>
              <div className="text-sm text-gray-300 mb-3 bg-gray-800 p-3 rounded-lg rounded-tr-none">
                "Want me to crunch the numbers on this matchup?"
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Type..." className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-cyan-500" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM NAV MENU */}
      <div className="h-16 bg-gray-950 border-t border-gray-800 flex items-center justify-around px-2 z-50 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <button onClick={() => setCurrentTab("home")} className={`flex flex-col items-center gap-1 p-2 ${currentTab === "home" ? "text-white" : "text-gray-500 hover:text-gray-400"}`}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => setCurrentTab("racing")} className={`flex flex-col items-center gap-1 p-2 ${currentTab === "racing" ? "text-white" : "text-gray-500 hover:text-gray-400"}`}>
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium">Racing</span>
        </button>
        <button onClick={() => { setCurrentTab("sport"); setCurrentScreen("main"); }} className={`flex flex-col items-center gap-1 p-2 ${currentTab === "sport" ? "text-white" : "text-gray-500 hover:text-gray-400"}`}>
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-medium">Sport</span>
        </button>
        <button onClick={() => setCurrentTab("lab")} className={`flex flex-col items-center gap-1 p-2 ${currentTab === "lab" ? "text-white" : "text-gray-500 hover:text-gray-400"}`}>
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] font-medium">Lab</span>
        </button>
        <button onClick={() => setCurrentTab("ask_bob")} className={`flex flex-col items-center gap-1 p-2 ${currentTab === "ask_bob" ? "text-cyan-400" : "text-gray-500 hover:text-gray-400"}`}>
          <Bot className="w-5 h-5" />
          <span className="text-[10px] font-medium">Ask Bob</span>
        </button>
      </div>

    </div>
  );
}
