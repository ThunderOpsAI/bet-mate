import re

with open("apps/web/app/components/VariantA_CyberpunkTerminal.tsx", "r") as f:
    content = f.read()

memo_logic = """
  const targetVenues = ["randwick", "rosehill", "warwick farm", "canterbury", "flemington", "caulfield", "moonee valley", "sandown", "doomben", "eagle farm", "morphettville", "gawler", "sydney", "melbourne", "brisbane", "adelaide", "brissy"];
  const displayRaces = React.useMemo(() => {
    const filtered = racesData.filter(r => targetVenues.some(v => (r.venue || "").toLowerCase().includes(v)));
    return filtered.length > 0 ? filtered : racesData;
  }, [racesData]);

  // Aggregate and sort upcoming sports for Next Sport card
  const nextSportsData = React.useMemo(() => {
    let combined = [
      ...aflGames.map(g => ({ id: g.game_id, sport: 'AFL', date: g.date || '', event: `${g.home_team} vs ${g.away_team}` })),
      ...nbaGames.map(g => ({ id: g.game_id, sport: 'NBA', date: g.date || '', event: `${g.home_team} vs ${g.away_team}` })),
      ...nrlGames.map(g => ({ id: g.game_id, sport: 'NRL', date: g.date || '', event: `${g.home_team} vs ${g.away_team}` })),
      ...soccerGames.map(g => ({ id: g.game_id, sport: 'Soccer', date: g.date || '', event: `${g.home_team} vs ${g.away_team}` })),
      ...golfTournaments.map(g => ({ id: g.tournament_id, sport: 'Golf', date: g.start_time || g.meeting_date || '', event: g.name })),
      ...mmaMatchups.map(g => ({ id: g.game_id, sport: 'MMA', date: g.date || '', event: `${g.home_team} vs ${g.away_team}` })),
    ].filter(g => g.date && new Date(g.date).getTime() > Date.now() - 86400000); // Only include games from yesterday onwards

    // Sort chronologically
    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return combined;
  }, [aflGames, nbaGames, nrlGames, soccerGames, golfTournaments, mmaMatchups]);
"""

# Insert memos at top of component if not already there
if "const targetVenues =" not in content:
    content = content.replace("const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);", "const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);\n" + memo_logic)

grid_start = content.find("{/* 2-Column Grid:")
grid_end = content.find("{/* Footer: App Store Badge")

if grid_start != -1 and grid_end != -1:
    new_grid = """{/* 2x2 Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full items-stretch pb-10">
          
          {/* Top Left: Next Racing Card */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col h-[340px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 px-1 shrink-0">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Next Racing
              </h2>
              <Link href="/racing" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition-colors">
                Race Hub <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex-1">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-400 font-medium">Connecting to live race feeds...</p>
              </div>
            ) : displayRaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex-1">
                <Clock className="w-6 h-6 text-slate-500 mb-2" />
                <p className="text-sm text-slate-300 font-medium">No races currently</p>
                <p className="text-xs text-slate-500 mt-1">Live Betfair feeds returned no meetings.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2.5 pt-1 overflow-y-auto pr-1 custom-scrollbar">
                {displayRaces.slice(0, 4).map((race, idx) => (
                  <div key={race.race_id || idx} className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/60 flex items-center justify-between hover:bg-slate-800 transition-all duration-200 group gap-2 flex-shrink-0">
                    <div className="flex flex-col gap-0.5 w-full sm:w-auto overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">R{race.race_number} {race.venue}</span>
                        <span className="text-[11px] text-slate-400 truncate">{race.distance}m</span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                        <span className="truncate">{race.horses?.[0]?.name || "TBD"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end shrink-0 gap-2">
                      <Link href={`/races/${race.race_id}`} className="text-slate-400 hover:text-white font-medium text-[10px] hidden sm:flex items-center gap-1">
                        Card <ArrowUpRight className="w-3 h-3" />
                      </Link>
                      {race.horses?.[0]?.betfair_back_price ? (
                        <button className="bg-slate-700 hover:bg-slate-600 h-7 w-12 flex items-center justify-center rounded-md font-mono text-xs font-bold text-white shrink-0">
                          ${race.horses[0].betfair_back_price.toFixed(2)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Right: Next Sport Card */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col h-[340px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 px-1 shrink-0">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                Next Sport
              </h2>
              <span className="text-xs text-slate-400 font-mono">Upcoming Fixtures</span>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex-1">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-400 font-medium">Connecting to live sport feeds...</p>
              </div>
            ) : nextSportsData && nextSportsData.length > 0 ? (
              <div className="flex-1 flex flex-col gap-2.5 pt-1 overflow-y-auto pr-1 custom-scrollbar">
                {nextSportsData.slice(0, 4).map((game, idx) => (
                  <div key={game.id || idx} className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/60 flex items-center justify-between hover:bg-slate-800 transition-all duration-200 group gap-2 flex-shrink-0">
                    <div className="flex flex-col gap-0.5 w-full sm:w-auto overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{game.sport}</span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {new Date(game.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                        <span className="truncate">{game.event}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end shrink-0 gap-2">
                      <Link href={`/${game.sport.toLowerCase()}`} className="text-slate-400 hover:text-white font-medium text-[10px] hidden sm:flex items-center gap-1">
                        View <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex-1">
                <Trophy className="w-6 h-6 text-slate-500 mb-2" />
                <p className="text-sm text-slate-300 font-medium">No upcoming sports</p>
                <p className="text-xs text-slate-500 mt-1">Check back later for fixtures.</p>
              </div>
            )}
          </div>

          {/* Bottom Left: HIGH EV FEED Section */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col h-[340px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 px-1 shrink-0">
              <h2 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                HIGH EV FEED
              </h2>
              <span className="text-xs text-slate-400 font-mono">Ranked by EV %</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex-1">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-400 font-medium">Fetching EV model signals...</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1 custom-scrollbar">
                {Array.from({ length: 4 }).map((_, idx) => {
                  const opp = filteredOpps[idx];
                  if (opp) {
                    let SportIcon = Zap;
                    if (opp.sport?.toLowerCase() === "racing") SportIcon = Trophy;
                    else if (opp.sport?.toLowerCase() === "nba") SportIcon = Flame;
                    else if (opp.sport?.toLowerCase() === "soccer") SportIcon = Activity;
                    else if (opp.sport?.toLowerCase() === "mma") SportIcon = ShieldCheck;
                    else if (opp.sport?.toLowerCase() === "golf") SportIcon = Flag;

                    return (
                      <div key={opp.id || idx} className="relative bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 hover:bg-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 group flex flex-col justify-between shadow-lg flex-shrink-0">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800/40 w-full overflow-hidden">
                          <div className="flex items-center gap-2 text-slate-400 truncate">
                            <SportIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="text-[9px] font-mono uppercase tracking-widest bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 truncate">
                              {opp.sport} • {opp.event}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono tracking-tight shrink-0">JUST NOW</span>
                        </div>
                        <div className="flex items-center justify-between z-10 relative pt-1 gap-2">
                          <div className="flex-1 overflow-hidden space-y-0.5">
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">MODEL SELECTION</div>
                            <div className="text-xs font-bold text-white font-sans leading-snug truncate">{opp.selection}</div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0 justify-center">
                            {opp.marketOdds ? (
                              <button className="bg-slate-700 hover:bg-slate-600 h-6 w-12 flex items-center justify-center rounded-md font-mono text-xs font-bold text-white">${opp.marketOdds.toFixed(2)}</button>
                            ) : (
                              <span className="inline-flex items-center justify-center h-6 px-1.5 bg-emerald-500/10 text-emerald-400 font-bold font-mono tracking-widest rounded-md border border-emerald-500/30 text-[9px]">{opp.edge ? `+${opp.edge}%` : "SIG"}</span>
                            )}
                            {opp.marketOdds && opp.edge && <div className="text-[9px] font-mono text-emerald-400 mt-1 font-bold">+{opp.edge}% EV</div>}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return <div key={`empty-ev-${idx}`} className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-4 flex items-center justify-center min-h-[50px] flex-shrink-0"><span className="text-xs text-slate-500">No active games</span></div>;
                  }
                })}
              </div>
            )}
          </div>

          {/* Bottom Right: Next Blackbooker Section */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col h-[340px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 px-1 shrink-0">
              <h2 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-cyan-400" />
                Next Blackbooker
              </h2>
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold uppercase tracking-wider border border-cyan-500/30 hover:border-cyan-400/50 rounded-md px-2 py-1 transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add to Blackbook
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1 custom-scrollbar">
              {blackbookRunners.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center flex-1 min-h-[120px] bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
                  <Bookmark className="w-6 h-6 text-slate-600 mb-2 opacity-50" />
                  <p className="text-xs text-slate-400 font-medium">Blackbook slot available</p>
                  <p className="text-[10px] text-slate-500 mt-1">Track runners and get alerts.</p>
                </div>
              ) : (
                blackbookRunners.slice(0, 4).map((item) => (
                  <div key={item.id} className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between hover:border-cyan-500/50 transition-all duration-300 group flex-shrink-0">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                          item.type === "horse" ? "bg-amber-500/20 text-amber-400" :
                          item.type === "dog" ? "bg-cyan-500/20 text-cyan-400" :
                          "bg-purple-500/20 text-purple-400"
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{item.venue} • {item.time}</span>
                      </div>
                      <button onClick={() => removeBlackbookItem(item.id)} className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white tracking-wide">{item.runner}</span>
                        {item.note && <span className="text-[10px] text-slate-500 mt-0.5">{item.note}</span>}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-mono font-bold text-white">{item.odds}</span>
                        {item.edge && <span className="text-[9px] text-emerald-400 font-bold tracking-wider">{item.edge}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        """
    content = content[:grid_start] + new_grid + content[grid_end:]

    with open("apps/web/app/components/VariantA_CyberpunkTerminal.tsx", "w") as f:
        f.write(content)
    print("Successfully replaced layout")
else:
    print(f"Could not find grid boundaries: start={grid_start}, end={grid_end}")
