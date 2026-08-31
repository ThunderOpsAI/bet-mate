  return (
    <>
      <ErrorBoundary sectionName="Blackbook content">

      <div className="flex flex-col min-h-screen bg-slate-50 overflow-hidden">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-cyan-600" />
            <div>
              <h1 className="text-xl font-bold m-0">Blackbook Engine & Dashboard</h1>
              <p className="text-sm text-slate-500 m-0 mt-1">
                Track individual runners, jockeys, trainers, or build high-ROI combinatorial partnership watchlists.
              </p>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="text-slate-400" size={18} />
            </div>
            <input
              type="text"
              placeholder="Search horses, jockeys, trainers..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all text-sm font-medium"
              onFocus={() => setIsSearchOpen(true)}
              readOnly
            />
          </div>
          <div className="flex justify-end mt-2">
            <button 
              onClick={() => setShowComboBuilder(true)}
              className="text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-100 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
            >
              <Plus size={16} /> Manually Add Entry / Combo
            </button>
          </div>
        </div>

        {showComboBuilder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-lg">Manually Add to Blackbook</h3>
                <button onClick={() => setShowComboBuilder(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
              </div>
              <form onSubmit={saveCombination} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Type</label>
                  <select 
                    value={comboDraft.combinationType}
                    onChange={(e) => setComboDraft({...comboDraft, combinationType: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm"
                  >
                    <option value="RUNNER">Single Runner</option>
                    <option value="JOCKEY">Single Jockey</option>
                    <option value="TRAINER">Single Trainer</option>
                    <option value="JOCKEY_TRAINER">Jockey + Trainer</option>
                    <option value="JOCKEY_HORSE">Jockey + Horse</option>
                    <option value="TRAINER_TRACK">Trainer + Track</option>
                  </select>
                </div>

                {["RUNNER", "JOCKEY_HORSE"].includes(comboDraft.combinationType) && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Horse Name</label>
                    <input type="text" required value={comboDraft.horseName} onChange={e => setComboDraft({...comboDraft, horseName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. Winx" />
                  </div>
                )}
                
                {["JOCKEY", "JOCKEY_TRAINER", "JOCKEY_HORSE"].includes(comboDraft.combinationType) && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Jockey Name</label>
                    <input type="text" required value={comboDraft.jockeyName} onChange={e => setComboDraft({...comboDraft, jockeyName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. J McDonald" />
                  </div>
                )}
                
                {["TRAINER", "JOCKEY_TRAINER", "TRAINER_TRACK"].includes(comboDraft.combinationType) && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Trainer Name</label>
                    <input type="text" required value={comboDraft.trainerName} onChange={e => setComboDraft({...comboDraft, trainerName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. C Waller" />
                  </div>
                )}

                {comboDraft.combinationType === "TRAINER_TRACK" && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Track Name</label>
                    <input type="text" required value={comboDraft.trackName} onChange={e => setComboDraft({...comboDraft, trackName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. Flemington" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
                  <textarea value={comboDraft.notes} onChange={e => setComboDraft({...comboDraft, notes: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm resize-none" rows={2} placeholder="Why are you watching this?"></textarea>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowComboBuilder(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={savingCombo} className="px-4 py-2 text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg disabled:opacity-50">
                    {savingCombo ? "Saving..." : "Save Entry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <BlackbookSearchBar 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
          onSelect={(item) => {
            const typeMap: Record<string, "horse" | "jockey" | "trainer" | "combination"> = {
              RUNNER: "horse",
              JOCKEY: "jockey",
              TRAINER: "trainer",
              COMBINATION: "combination"
            };
            setSearchEntity({
              id: item.id,
              name: item.name,
              type: typeMap[item.category] || "horse",
              jockeyName: item.jockeyName,
              trainerName: item.trainerName,
              horseName: item.horseName,
            });
            setIsRuleBuilderOpen(true);
            setIsSearchOpen(false);
          }}
        />
        <BlackbookRuleBuilderSheet 
          isOpen={isRuleBuilderOpen} 
          onClose={() => setIsRuleBuilderOpen(false)} 
          entity={searchEntity} 
          onSave={() => void fetchConfigs()} 
        />

        <div className="bg-white border-b border-slate-200 px-6 flex space-x-6">
          <button 
            onClick={() => setActiveTab("list")}
            className={`font-bold py-3 border-b-2 transition-colors ${activeTab === "list" ? "border-cyan-600 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            My Blackbook
          </button>
          <button 
            onClick={() => setActiveTab("explore")}
            className={`font-bold py-3 border-b-2 transition-colors ${activeTab === "explore" ? "border-cyan-600 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Explore
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === "list" ? (
            <div className="space-y-8 py-6">
              {/* Running Today Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700">
                  <h2 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2 m-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Running Today ({runningTodayConfigs.length})
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {runningTodayConfigs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No runners scheduled for today.
                    </div>
                  ) : (
                    runningTodayConfigs.map((cfg) => {
                      const match = dailyRunners.find(
                        (r) =>
                          r.name?.toLowerCase() === cfg.runner.toLowerCase() ||
                          r.horseName?.toLowerCase() === cfg.runner.toLowerCase()
                      );
                      return (
                        <div key={cfg.runner} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-base m-0 text-slate-950">{cfg.runner}</h3>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded">
                                Running Today
                              </span>
                            </div>
                            {match?.details && (
                              <p className="text-xs text-slate-500 m-0">{match.details}</p>
                            )}
                          </div>
                          <button onClick={() => removeConfig(cfg.runner)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Remove">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Active Alerts Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700">
                  <h2 className="text-sm font-black uppercase text-slate-200 tracking-wider m-0">
                    Active Alerts ({activeAlertsConfigs.length})
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {activeAlertsConfigs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No active alerts.
                    </div>
                  ) : (
                    activeAlertsConfigs.map((combo) => (
                      <div key={combo.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg m-0">{combo.targetName}</h3>
                              <span className="bg-cyan-50 text-cyan-700 border border-cyan-100 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                                {combo.combinationType.replaceAll("_", " + ")}
                              </span>
                            </div>
                            <div className="flex gap-4 text-sm text-slate-500 mt-2">
                              {combo.jockeyName && <span className="flex items-center gap-1"><User size={14} className="text-cyan-600"/> {combo.jockeyName}</span>}
                              {combo.trainerName && <span className="flex items-center gap-1"><Award size={14} className="text-cyan-600"/> {combo.trainerName}</span>}
                              {combo.horseName && <span className="flex items-center gap-1"><Activity size={14} className="text-cyan-600"/> {combo.horseName}</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteCombination(combo.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
              
              {/* Awaiting Next Race Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700">
                  <h2 className="text-sm font-black uppercase text-slate-300 tracking-wider flex items-center gap-1 m-0">
                    <Clock size={14}/> Awaiting Next Race ({awaitingNextRaceConfigs.length})
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {awaitingNextRaceConfigs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No awaiting configs.
                    </div>
                  ) : (
                    awaitingNextRaceConfigs.map((cfg) => (
                      <div key={cfg.runner} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-lg m-0 flex items-center gap-2">
                            {cfg.runner}
                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded capitalize">
                              {cfg.sport}
                            </span>
                          </h3>
                          <button onClick={() => removeConfig(cfg.runner)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex gap-4 text-sm text-slate-500">
                          <span><strong>Paper stake:</strong> ${cfg.stake}</span>
                          <span><strong>Trigger:</strong> win chance at {cfg.probability_threshold}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Today's Runners Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700 mt-6">
                  <h2 className="text-sm font-black uppercase text-slate-300 tracking-wider flex items-center gap-1 m-0">
                    <Calendar size={14}/> Today's Field
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {dailyRunnersLoading ? (
                    <div className="text-sm text-slate-500 text-center py-4">Loading today's field...</div>
                  ) : dailyRunners.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No runners found for today.
                    </div>
                  ) : (
                    dailyRunners.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex justify-between items-center hover:border-cyan-200 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm m-0 text-slate-950">{item.name}</h3>
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                              {item.category || item.type}
                            </span>
                          </div>
                          {item.details && (
                            <p className="text-xs text-slate-500 m-0">{item.details}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const typeMap: Record<string, "horse" | "jockey" | "trainer" | "combination"> = {
                              RUNNER: "horse",
                              JOCKEY: "jockey",
                              TRAINER: "trainer",
                              COMBINATION: "combination",
                              horse: "horse",
                              jockey: "jockey",
                              trainer: "trainer"
                            };
                            setSearchEntity({
                              id: item.id,
                              name: item.name,
                              type: typeMap[item.category || item.type] || "horse",
                              jockeyName: item.jockeyName,
                              trainerName: item.trainerName,
                              horseName: item.horseName,
                            });
                            setIsRuleBuilderOpen(true);
                          }}
                          className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Plus size={14} /> Blackbook
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="p-6">
              <ExploreTab onAddToBlackbook={(entity) => {
                setSearchEntity({ id: entity.name, name: entity.name, type: entity.type as "jockey" | "trainer" | "horse" });
                setIsRuleBuilderOpen(true);
              }} />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
      <PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} />
    </>
  );
}

export default function BlackbookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Blackbook...</div>}>
      <BlackbookPageContent />
    </Suspense>
  );
}
