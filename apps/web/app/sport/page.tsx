"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Zap,
  Flame,
  CircleDot,
  Shield,
  Globe,
  Swords,
  Flag,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { ML_API } from "../lib/mlApi";
import { safeResponseJson } from "../lib/api";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { rankOpportunities, type OpportunityCandidate } from "../lib/opportunityScore";
import { getConfidenceSignal, getUrgencySignal } from "../lib/predictionSignals";
import OpportunitySection from "../components/OpportunitySection";
import SportCard from "../components/sport/SportCard";
import SportMatchupDrawer, { type MatchupDrawerData } from "../components/sport/SportMatchupDrawer";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import RefreshControls from "../components/RefreshControls";

type SportKey = "all" | "afl" | "nrl" | "nba" | "soccer" | "mma" | "golf";

interface BaseGame {
  game_id: string;
  sport: "afl" | "nrl" | "nba" | "soccer" | "mma" | "golf";
  home_team: string;
  away_team: string;
  date?: string;
  venue?: string;
  round?: number;
  features?: Record<string, any>;
  complete?: number;
  hscore?: number | null;
  ascore?: number | null;
  squiggle_tip?: string;
  squiggle_confidence?: number | string | null;
}

interface SportMeta {
  id: SportKey;
  name: string;
  icon: React.ElementType;
  href?: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
}

const SPORTS_META: SportMeta[] = [
  { id: "all", name: "All Sports", icon: Trophy, colorClass: "text-emerald-400", borderClass: "border-emerald-500/40", bgClass: "bg-emerald-500/10" },
  { id: "afl", name: "AFL", icon: CircleDot, href: "/afl", colorClass: "text-emerald-400", borderClass: "border-emerald-500/40", bgClass: "bg-emerald-500/10" },
  { id: "nrl", name: "NRL", icon: Shield, href: "/nrl", colorClass: "text-amber-400", borderClass: "border-amber-500/40", bgClass: "bg-amber-500/10" },
  { id: "nba", name: "NBA", icon: Zap, href: "/nba", colorClass: "text-sky-400", borderClass: "border-sky-500/40", bgClass: "bg-sky-500/10" },
  { id: "soccer", name: "Soccer", icon: Globe, href: "/soccer", colorClass: "text-violet-400", borderClass: "border-violet-500/40", bgClass: "bg-violet-500/10" },
  { id: "mma", name: "MMA", icon: Swords, href: "/mma", colorClass: "text-orange-400", borderClass: "border-orange-500/40", bgClass: "bg-orange-500/10" },
  { id: "golf", name: "Golf", icon: Flag, href: "/golf", colorClass: "text-teal-400", borderClass: "border-teal-500/40", bgClass: "bg-teal-500/10" },
];

export default function SportDashboardPage() {
  const [activeSport, setActiveSport] = useState<SportKey>("all");
  const [games, setGames] = useState<BaseGame[]>([]);
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [drawerMatchup, setDrawerMatchup] = useState<MatchupDrawerData | null>(null);
  const isMountedRef = useRef(true);

  const loadData = async () => {
    try {
      setRefreshing(true);
      setRefreshFailed(false);

      // Fetch upcoming games from all sports concurrently with timeout
      const [aflRes, nrlRes, nbaRes, soccerRes, mmaRes, golfRes] = await Promise.allSettled([
        fetchWithTimeout(`${ML_API}/api/afl/games/upcoming`, { timeoutMs: 15000 }).then(r => r.ok ? safeResponseJson(r) : null),
        fetchWithTimeout(`${ML_API}/api/nrl/games/upcoming`, { timeoutMs: 15000 }).then(r => r.ok ? safeResponseJson(r) : null),
        fetchWithTimeout(`${ML_API}/api/nba/games/today`, { timeoutMs: 15000 }).then(r => r.ok ? safeResponseJson(r) : null),
        fetchWithTimeout(`${ML_API}/api/soccer/games/today`, { timeoutMs: 15000 }).then(r => r.ok ? safeResponseJson(r) : null),
        fetchWithTimeout(`${ML_API}/api/mma/games/today`, { timeoutMs: 15000 }).then(r => r.ok ? safeResponseJson(r) : null),
        fetchWithTimeout(`${ML_API}/api/golf/games/today`, { timeoutMs: 15000 }).then(r => r.ok ? safeResponseJson(r) : null),
      ]);

      const allGames: BaseGame[] = [];

      // Helper to map and sanitize games
      const sanitizeGames = (rawList: any[], sport: BaseGame["sport"]) => {
        if (!Array.isArray(rawList)) return;
        for (const g of rawList) {
          const home = g.home_team || g.fighter1 || g.player1 || g.team1;
          const away = g.away_team || g.fighter2 || g.player2 || g.team2;
          if (
            !home ||
            !away ||
            home === "Team None" ||
            away === "Team None" ||
            home.toLowerCase() === "none" ||
            away.toLowerCase() === "none"
          ) {
            continue;
          }
          allGames.push({
            game_id: g.game_id || `${sport}-${g.id || `${home}-${away}`}`,
            sport,
            home_team: home,
            away_team: away,
            date: g.date || g.match_time || g.game_time || g.start_time,
            venue: g.venue,
            round: g.round,
            features: g.features || {},
            complete: g.complete,
            hscore: g.hscore,
            ascore: g.ascore,
            squiggle_tip: g.squiggle_tip,
            squiggle_confidence: g.squiggle_confidence,
          });
        }
      };

      if (aflRes.status === "fulfilled" && aflRes.value) {
        sanitizeGames(aflRes.value.games || aflRes.value, "afl");
      }
      if (nrlRes.status === "fulfilled" && nrlRes.value) {
        sanitizeGames(nrlRes.value.games || nrlRes.value, "nrl");
      }
      if (nbaRes.status === "fulfilled" && nbaRes.value) {
        sanitizeGames(nbaRes.value.games || nbaRes.value, "nba");
      }
      if (soccerRes.status === "fulfilled" && soccerRes.value) {
        sanitizeGames(soccerRes.value.games || soccerRes.value, "soccer");
      }
      if (mmaRes.status === "fulfilled" && mmaRes.value) {
        sanitizeGames(mmaRes.value.games || mmaRes.value, "mma");
      }
      if (golfRes.status === "fulfilled" && golfRes.value) {
        sanitizeGames(golfRes.value.games || golfRes.value, "golf");
      }

      // Fetch predictions for all parsed games concurrently
      const predsMap: Record<string, any> = {};
      await Promise.all(
        allGames.map(async (game) => {
          try {
            const predRes = await fetchWithTimeout(`${ML_API}/api/predict/${game.sport}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(game),
              timeoutMs: 12000,
            });
            if (predRes.ok) {
              const predData = await safeResponseJson(predRes);
              if (predData) {
                predsMap[game.game_id] = predData;
              }
            }
          } catch {
            // Game prediction skipped if model unavailable
          }
        })
      );

      if (isMountedRef.current) {
        setGames(allGames);
        setPredictions(predsMap);
        setLastUpdated(Date.now());
        setLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setRefreshFailed(true);
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Compute overall ranked opportunities across all sports
  const opportunities = useMemo(() => {
    const candidates: OpportunityCandidate[] = [];

    for (const game of games) {
      const pred = predictions[game.game_id];
      if (!pred || !pred.predictions) continue;

      const p = pred.predictions;
      const homeProb = p.home_win_probability ?? 50;
      const awayProb = p.away_win_probability ?? 50;
      const homeWins = homeProb > awayProb;

      const rawProb = homeWins ? homeProb : awayProb;
      const normalizedProb = rawProb > 1 ? rawProb / 100 : rawProb;
      const fairOdds = homeWins ? p.fair_odds_home : p.fair_odds_away;
      const marketOdds = homeWins ? p.market_odds_home : p.market_odds_away;

      if (!fairOdds || fairOdds <= 1) continue;

      candidates.push({
        id: game.game_id,
        sport: game.sport,
        selectionName: homeWins ? game.home_team : game.away_team,
        eventLabel: `${game.home_team} vs ${game.away_team}`,
        probability: normalizedProb,
        fairOdds,
        marketOdds: marketOdds && marketOdds > 1 ? marketOdds : null,
        confidenceSignal: getConfidenceSignal(pred.ai_insights_context),
        urgencySignal: getUrgencySignal({ startTime: game.date }),
        eventTime: game.date,
        href: `/${game.sport}`,
      });
    }

    return rankOpportunities(candidates).slice(0, 6);
  }, [games, predictions]);

  // Counts of games by sport
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: games.length };
    for (const g of games) {
      counts[g.sport] = (counts[g.sport] || 0) + 1;
    }
    return counts;
  }, [games]);

  // Filtered games based on active tab
  const filteredGames = useMemo(() => {
    if (activeSport === "all") return games;
    return games.filter((g) => g.sport === activeSport);
  }, [games, activeSport]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 py-6">
      {/* 1. Header with Live Status and Refresh Controls */}
      <section className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-emerald-400 font-extrabold text-xs mb-1.5 flex items-center gap-2 tracking-wider uppercase">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Sports Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Sports Dashboard
          </h1>
          <p className="text-slate-400 mt-1 text-xs sm:text-sm max-w-2xl leading-relaxed">
            AI-driven win probabilities, mathematical value edges, and game analytics across AFL, NRL, NBA, Soccer, MMA & Golf.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
          <RefreshControls
            lastUpdated={lastUpdated}
            isRefreshing={refreshing}
            onRefresh={() => void loadData()}
          />
        </div>
      </section>

      {/* 2. Sport Category Filter Bar with Live Counters */}
      <div className="overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {SPORTS_META.map((sport) => {
            const Icon = sport.icon;
            const count = sportCounts[sport.id] ?? 0;
            const isActive = activeSport === sport.id;

            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setActiveSport(sport.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isActive
                    ? "bg-slate-800 text-slate-100 border-emerald-500/60 shadow-md shadow-emerald-950/20"
                    : "bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Icon size={14} className={isActive ? sport.colorClass : "text-slate-400"} />
                <span>{sport.name}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300 font-extrabold"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Top Value Opportunities Across All Sports */}
      <ErrorBoundary sectionName="Top Value Opportunities">
        <OpportunitySection
          title={activeSport === "all" ? "Top Value Opportunities" : `${activeSport.toUpperCase()} Opportunities`}
          opportunities={opportunities.filter((o) => activeSport === "all" || o.sport === activeSport)}
          emptyMessage="No mathematical value edges detected in current live feeds. Check back as bookmaker markets open."
          href={activeSport === "all" ? "/sport" : `/${activeSport}`}
          linkLabel={activeSport === "all" ? "All Edges" : `Open ${activeSport.toUpperCase()}`}
        />
      </ErrorBoundary>

      {/* 4. Upcoming Games Slate */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 flex items-center gap-2">
              <Clock size={18} className="text-sky-400" />
              <span>
                {activeSport === "all" ? "All Upcoming Matchups" : `${activeSport.toUpperCase()} Matchups`}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Machine learning win probabilities vs current market pricing
            </p>
          </div>

          {activeSport !== "all" && (
            <Link
              href={`/${activeSport}`}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <span>Full {activeSport.toUpperCase()} Hub</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="skeleton h-36 rounded-2xl" />
            <div className="skeleton h-36 rounded-2xl" />
            <div className="skeleton h-36 rounded-2xl" />
            <div className="skeleton h-36 rounded-2xl" />
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-950/70 border border-slate-800 text-center flex flex-col items-center justify-center space-y-2">
            <Trophy size={28} className="text-slate-600 mb-1" />
            <p className="text-sm font-bold text-slate-200">
              No Upcoming {activeSport === "all" ? "Sports" : activeSport.toUpperCase()} Games
            </p>
            <p className="text-xs text-slate-400 max-w-sm">
              Live fixtures have settled or are awaiting new schedule releases from official leagues.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGames.map((game) => {
              const pred = predictions[game.game_id];
              const homeProb = pred?.predictions?.home_win_probability ?? 50;
              const awayProb = pred?.predictions?.away_win_probability ?? 50;
              const fairHome = pred?.predictions?.fair_odds_home;
              const fairAway = pred?.predictions?.fair_odds_away;
              const mktHome = pred?.predictions?.market_odds_home;
              const mktAway = pred?.predictions?.market_odds_away;

              const matchupData: MatchupDrawerData = {
                id: game.game_id,
                sport: game.sport,
                title: `${game.home_team} vs ${game.away_team}`,
                subTitle: game.round ? `Round ${game.round}` : game.venue,
                date: game.date,
                venue: game.venue,
                roundOrLeague: game.round ? `Round ${game.round}` : undefined,
                outcomes: [
                  {
                    name: game.home_team,
                    isHome: true,
                    winProb: homeProb,
                    fairOdds: fairHome || 1.9,
                    marketOdds: mktHome,
                  },
                  {
                    name: game.away_team,
                    isAway: true,
                    winProb: awayProb,
                    fairOdds: fairAway || 1.9,
                    marketOdds: mktAway,
                  },
                ],
                metadata: {
                  squiggleTip: game.squiggle_tip,
                  squiggleConfidence: game.squiggle_confidence,
                  confidenceSignal: getConfidenceSignal(pred?.ai_insights_context),
                  urgencySignal: getUrgencySignal({ startTime: game.date }),
                },
                featureImpact: pred?.feature_impact,
                aiInsightsContext: pred?.ai_insights_context,
                modelMetadata: pred?.model_metadata,
              };

              return (
                <SportCard
                  key={game.game_id}
                  matchup={matchupData}
                  onOpenDrawer={(m) => setDrawerMatchup(m)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Deep Matchup Analysis Drawer */}
      <SportMatchupDrawer
        isOpen={drawerMatchup !== null}
        onClose={() => setDrawerMatchup(null)}
        matchup={drawerMatchup}
      />
    </div>
  );
}
