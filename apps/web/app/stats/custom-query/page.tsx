"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  BookmarkPlus,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  BarChart2,
  Layers,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Sliders,
  ChevronRight,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import { NoData, AwaitingFeed } from "../../../components/common/EmptyStates";

interface QueryResultGame {
  gameId: string;
  gameDate: string;
  opponent: string;
  isHome: boolean;
  minutes: number | null;
  statValue: number;
  isHit: boolean;
}

interface QuerySummary {
  totalGames: number;
  hits: number;
  misses: number;
  hitRatePct: number;
  averageValue: number;
}

interface SavedScreenItem {
  id: string;
  name: string;
  filterJson: Record<string, any>;
  createdAt: string;
}

export default function CustomStatQueryPage() {
  const { token } = useAuth();

  // Builder inputs
  const [sport, setSport] = useState("NBA");
  const [playerName, setPlayerName] = useState("Luka Doncic");
  const [stat, setStat] = useState("points");
  const [condition, setCondition] = useState("GT");
  const [value, setValue] = useState(30);
  const [split, setSplit] = useState<"ALL" | "HOME" | "AWAY">("ALL");
  const [teammateOutName, setTeammateOutName] = useState("");

  // Execution states
  const [running, setRunning] = useState(false);
  const [queryResults, setQueryResults] = useState<{
    summary: QuerySummary;
    games: QueryResultGame[];
    player: any;
    note?: string | null;
  } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Saved screens
  const [savedScreens, setSavedScreens] = useState<SavedScreenItem[]>([]);
  const [screenName, setScreenName] = useState("");
  const [savingScreen, setSavingScreen] = useState(false);
  const [executedScreenResults, setExecutedScreenResults] = useState<{
    screenName: string;
    results: any[];
  } | null>(null);
  const [executingScreenId, setExecutingScreenId] = useState<string | null>(null);

  const fetchSavedScreens = async () => {
    try {
      const res = await fetch(`${API_BASE}/saved-screens`, {
        headers: {
          ...(token && token !== "guest" ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await safeResponseJson(res);
        if (json && Array.isArray(json.savedScreens)) {
          setSavedScreens(json.savedScreens);
        }
      }
    } catch {}
  };

  useEffect(() => {
    void fetchSavedScreens();
  }, [token]);

  const handleRunQuery = async () => {
    if (!playerName.trim()) return;

    setRunning(true);
    setQueryError(null);

    try {
      const res = await fetch(`${API_BASE}/stats/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sport,
          playerName: playerName.trim(),
          stat,
          condition,
          value: Number(value),
          split,
          teammateOutName: teammateOutName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to execute custom query");
      }

      const json = await safeResponseJson(res);

      if (json && json.status === "ok") {
        setQueryResults({
          summary: json.summary,
          games: json.games || [],
          player: json.player,
          note: json.query?.note,
        });
      } else {
        setQueryResults(null);
        setQueryError(json?.message || "No matching historical game data found.");
      }
    } catch (err: any) {
      setQueryError(err.message || "Failed to execute query. Please retry.");
    } finally {
      setRunning(false);
    }
  };

  const handleSaveScreen = async () => {
    const nameToSave = screenName.trim() || `${playerName} ${stat.toUpperCase()} ${condition} ${value}`;
    setSavingScreen(true);

    try {
      const filterJson = {
        sport,
        playerName: playerName.trim(),
        stat,
        condition,
        value: Number(value),
        split,
        teammateOutName: teammateOutName.trim() || undefined,
      };

      const res = await fetch(`${API_BASE}/saved-screens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && token !== "guest" ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: nameToSave,
          filterJson,
        }),
      });

      if (res.ok) {
        setScreenName("");
        void fetchSavedScreens();
      }
    } catch {
    } finally {
      setSavingScreen(false);
    }
  };

  const handleDeleteScreen = async (id: string) => {
    try {
      await fetch(`${API_BASE}/saved-screens/${id}`, {
        method: "DELETE",
        headers: {
          ...(token && token !== "guest" ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setSavedScreens((prev) => prev.filter((s) => s.id !== id));
      if (executedScreenResults?.screenName) {
        setExecutedScreenResults(null);
      }
    } catch {}
  };

  const handleExecuteScreen = async (screen: SavedScreenItem) => {
    setExecutingScreenId(screen.id);
    try {
      const res = await fetch(`${API_BASE}/saved-screens/${screen.id}/execute`, {
        method: "POST",
        headers: {
          ...(token && token !== "guest" ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const json = await safeResponseJson(res);
        setExecutedScreenResults({
          screenName: screen.name,
          results: json?.results || [],
        });
      }
    } catch {
    } finally {
      setExecutingScreenId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-wider uppercase mb-1">
            <Sliders className="w-4 h-4" />
            <span>Quantitative Stat Builder</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Custom Stat Query &amp; Saved Screens
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/stats"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all"
          >
            <span>Live Prop Markets</span>
            <ArrowRight className="w-4 h-4 text-cyan-400" />
          </Link>
        </div>
      </div>

      {/* Main Grid: Query Builder (Left) + Saved Screens (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Interactive Query Builder (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl shadow-black/20 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">
                Interactive Stat Query Builder (Item 33)
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Formulate complex conditional statements (e.g. &ldquo;Luka Doncic Points &gt; 30 when Kyrie Irving is OUT&rdquo;) to calculate empirical hit rates directly from historical game logs.
            </p>

            {/* Form Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sport */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sport</label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="NBA">NBA Basketball</option>
                  <option value="AFL">AFL Australian Rules</option>
                  <option value="NRL">NRL Rugby League</option>
                  <option value="SOCCER">Soccer / Football</option>
                </select>
              </div>

              {/* Player Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Player Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. Luka Doncic, Nick Daicos"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Metric / Stat */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Stat Category</label>
                <select
                  value={stat}
                  onChange={(e) => setStat(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="points">Points (PTS)</option>
                  <option value="rebounds">Rebounds (REB)</option>
                  <option value="assists">Assists (AST)</option>
                  <option value="threes">3-Pointers Made (3PM)</option>
                  <option value="disposals">Disposals (AFL)</option>
                  <option value="goals">Goals (AFL / Soccer)</option>
                  <option value="tackles">Tackles</option>
                </select>
              </div>

              {/* Condition & Target Value */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Condition &amp; Line</label>
                <div className="flex gap-2">
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-28 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="GT">&gt; Over</option>
                    <option value="GTE">&gt;= At Least</option>
                    <option value="LT">&lt; Under</option>
                    <option value="LTE">&lt;= At Most</option>
                    <option value="EQ">= Exact</option>
                  </select>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Split (Home / Away / All) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Venue Split</label>
                <select
                  value={split}
                  onChange={(e) => setSplit(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Venues</option>
                  <option value="HOME">Home Games Only</option>
                  <option value="AWAY">Away Games Only</option>
                </select>
              </div>

              {/* Situational Context: Teammate OUT */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Situational Split: Teammate Inactive / OUT
                </label>
                <input
                  type="text"
                  value={teammateOutName}
                  onChange={(e) => setTeammateOutName(e.target.value)}
                  placeholder="e.g. Kyrie Irving, Marcus Bontempelli"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Run Button */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Query: {playerName} {stat.toUpperCase()} {condition} {value}
                {teammateOutName ? ` (when ${teammateOutName} is OUT)` : ""}
              </span>

              <button
                type="button"
                onClick={handleRunQuery}
                disabled={running}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-cyan-950"
              >
                {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-black" />}
                <span>{running ? "Evaluating..." : "Run Query"}</span>
              </button>
            </div>
          </div>

          {/* Query Results Section */}
          {queryError ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
              {queryError}
            </div>
          ) : queryResults ? (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
              {/* Summary KPIs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {queryResults.player?.fullName} Results
                  </h3>
                  {queryResults.note && (
                    <p className="text-xs text-cyan-400 font-medium">{queryResults.note}</p>
                  )}
                </div>

                {/* Save Screen Input & Action */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={screenName}
                    onChange={(e) => setScreenName(e.target.value)}
                    placeholder="Screen name (optional)"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 w-44"
                  />
                  <button
                    type="button"
                    onClick={handleSaveScreen}
                    disabled={savingScreen}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>{savingScreen ? "Saving..." : "Save as Screen"}</span>
                  </button>
                </div>
              </div>

              {/* Hit Rate Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Hit Rate
                  </span>
                  <span
                    className={`text-xl font-black ${
                      queryResults.summary.hitRatePct >= 65 ? "text-emerald-400" : "text-white"
                    }`}
                  >
                    {queryResults.summary.hitRatePct}%
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Hits / Total
                  </span>
                  <span className="text-xl font-black text-white">
                    {queryResults.summary.hits} / {queryResults.summary.totalGames}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Average Value
                  </span>
                  <span className="text-xl font-black text-cyan-400 font-mono">
                    {queryResults.summary.averageValue}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Target Line
                  </span>
                  <span className="text-xl font-black text-slate-300 font-mono">
                    {condition} {value}
                  </span>
                </div>
              </div>

              {/* Game by Game Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Evaluated Game Logs ({queryResults.games.length})
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Date</th>
                        <th className="py-2.5 px-3 font-semibold">Opponent</th>
                        <th className="py-2.5 px-3 font-semibold">Venue</th>
                        <th className="py-2.5 px-3 font-semibold">Actual {stat.toUpperCase()}</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Hit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {queryResults.games.map((g, idx) => (
                        <tr key={g.gameId || idx} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 text-slate-400 font-mono">
                            {new Date(g.gameDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-white">{g.opponent}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {g.isHome ? "Home" : "Away"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {g.statValue}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {g.isHit ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>HIT</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>MISS</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <AwaitingFeed
              title="Awaiting Query Parameters"
              message="Configure a player and stat criteria above and click 'Run Query' to evaluate historical data."
              statusLabel="Interactive Query Ready"
            />
          )}
        </div>

        {/* Right Column: Saved Screens & 1-Tap Execution (Item 34) */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Saved Screens (Item 34)
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Execute saved custom filters with 1 tap to scan live prop feeds and EV opportunities.
            </p>

            {savedScreens.length > 0 ? (
              <div className="space-y-3">
                {savedScreens.map((screen) => {
                  const isExecuting = executingScreenId === screen.id;
                  const f = screen.filterJson || {};

                  return (
                    <div
                      key={screen.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-white">{screen.name}</h4>
                          <button
                            type="button"
                            onClick={() => handleDeleteScreen(screen.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete screen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {f.sport || "ALL"} • {f.playerName || "All Players"} • {f.stat || "Stats"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExecuteScreen(screen)}
                        disabled={isExecuting}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                      >
                        {isExecuting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{isExecuting ? "Scanning..." : "Execute 1-Tap Screen"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <NoData
                title="No Saved Screens Yet"
                message="Save frequently used filters or query setups to monitor them with 1 tap."
                statusLabel="Zero Screens Saved"
              />
            )}
          </div>

          {/* Executed Screen Results View */}
          {executedScreenResults && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-800/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Live Screen: {executedScreenResults.screenName}
                </h3>
                <span className="text-xs font-bold text-white">
                  {executedScreenResults.results.length} matches
                </span>
              </div>

              {executedScreenResults.results.length > 0 ? (
                <div className="space-y-2.5">
                  {executedScreenResults.results.slice(0, 5).map((match, mIdx) => (
                    <div
                      key={match.id || mIdx}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block">{match.playerName}</span>
                        <span className="text-[10px] text-slate-400">
                          {match.marketType} • Line {match.line}
                        </span>
                      </div>
                      {match.bestOdds && (
                        <div className="text-right">
                          <span className="font-bold text-white block">${match.bestOdds.price}</span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            +{(match.bestOdds.edgePct * 100).toFixed(1)}% EV
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <NoData
                  title="No Live Props Matching Screen"
                  message="No active prop markets currently satisfy this screen's edge or line criteria."
                  statusLabel="Awaiting Live Matches"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
