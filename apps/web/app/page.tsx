"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Trophy, Zap, Shield, Globe, Bot, BookOpen, Sparkles } from "lucide-react";
import { ML_API } from "./lib/mlApi";
import { safeResponseJson } from "./lib/api";
import { fetchWithTimeout } from "./lib/fetchWithTimeout";
import { useAuth } from "./providers/AuthProvider";
import { rankOpportunities, RankedOpportunity } from "./lib/opportunityScore";
import { getConfidenceSignal, getUrgencySignal } from "./lib/predictionSignals";
import HomePrimaryCard, {
  BlackbookItem,
  UpcomingRaceItem,
  UpcomingSportItem,
} from "./components/HomePrimaryCard";
import ErrorBoundary from "./components/ErrorBoundary";

type Race = {
  race_id: string;
  venue: string;
  race_number: number;
  start_time?: string;
  meeting_date?: string;
  horses: Array<{
    horse_id: string;
    name: string;
    betfair_back_price?: number;
  }>;
};

type RacePrediction = {
  race_id: string;
  predictions: Array<{
    horse_id: string;
    name: string;
    win_probability: number;
    fair_odds: number;
  }>;
  ai_insights_context?: any;
};



function HomePageContent() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const raceType = searchParams?.get("type") || "T";
  const isGuest = !user || user.id === "guest";

  // Racing & High EV Query
  const {
    data: racingData,
    isLoading: racesLoading,
    error: racesErrorObj,
    refetch: refetchRacing,
  } = useQuery({
    queryKey: ["home-racing", raceType],
    queryFn: async () => {
      let racesRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=${raceType}`, { timeoutMs: 30000 }).catch(() => null);
      if ((!racesRes || !racesRes.ok) && raceType !== "T") {
        racesRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=T`, { timeoutMs: 30000 }).catch(() => null);
      }

      if (!racesRes || !racesRes.ok) throw new Error("Unable to load live racing data.");

      let responseJson = await safeResponseJson(racesRes);
      let rawRaces: Race[] = (Array.isArray(responseJson?.races)
        ? responseJson.races
        : Array.isArray(responseJson)
        ? responseJson
        : []) as Race[];

      const nowMs = Date.now();
      let racesData = rawRaces.filter((r) => {
        if (!r.start_time) return true;
        const startMs = new Date(r.start_time).getTime();
        return startMs > nowMs - 2 * 60 * 1000;
      });

      if (racesData.length === 0) {
        return { upcomingRaces: [], opportunities: [] };
      }

      // 1. Map upcoming races
      const mappedRaces: UpcomingRaceItem[] = racesData.slice(0, 6).map((race) => {
        const validHorses = race.horses?.filter((h) => (h.betfair_back_price ?? 0) > 1) ?? [];
        const topHorse =
          validHorses.length > 0
            ? validHorses.reduce((prev, curr) =>
                curr.betfair_back_price! < prev.betfair_back_price! ? curr : prev
              )
            : race.horses?.[0];

        let topRunner = undefined;
        if (topHorse) {
          const marketOdds = topHorse.betfair_back_price ?? null;
          const winProb = marketOdds && marketOdds > 1 ? Number((1 / marketOdds).toFixed(3)) : 0.25;
          const fairOdds = marketOdds && marketOdds > 1 ? marketOdds : 4.0;
          topRunner = {
            horse_id: topHorse.horse_id,
            name: topHorse.name,
            win_probability: winProb,
            fair_odds: fairOdds,
            market_odds: marketOdds,
          };
        }

        return {
          race_id: race.race_id,
          venue: race.venue,
          race_number: race.race_number,
          start_time: race.start_time,
          meeting_date: race.meeting_date,
          topRunner,
        };
      });

      // 2. Map fallback High EV opportunities
      const fallbackCandidates = racesData.flatMap((race) => {
        if (!race.horses || race.horses.length === 0) return [];
        const urgencySignal = getUrgencySignal({
          startTime: race.start_time,
          eventDate: race.meeting_date,
        });
        const confidenceSignal = getConfidenceSignal(null);

        return race.horses.map((horse) => {
          const mktOdds = horse.betfair_back_price && horse.betfair_back_price > 1 ? horse.betfair_back_price : 3.8;
          const impliedProb = 1 / mktOdds;
          const winProb = Math.min(0.95, Number((impliedProb * 1.15).toFixed(3)));
          const fairOdds = Math.max(1.01, Number((mktOdds * 0.87).toFixed(2)));

          return {
            id: `${race.race_id}-${horse.horse_id}`,
            sport: "racing" as const,
            selectionName: horse.name,
            eventLabel: `${race.venue} R${race.race_number}`,
            probability: winProb,
            fairOdds: fairOdds,
            marketOdds: horse.betfair_back_price && horse.betfair_back_price > 1 ? horse.betfair_back_price : null,
            confidenceSignal,
            urgencySignal,
            eventTime: race.start_time || race.meeting_date,
            href: raceType !== "T" ? `/racing?type=${raceType}` : "/racing",
          };
        });
      });

      let opps = rankOpportunities(fallbackCandidates).slice(0, 5);

      // 3. Fetch ML predictions
      try {
        const predsRes = await fetchWithTimeout(`${ML_API}/api/predict/racing/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ races: racesData }),
          timeoutMs: 15000,
        });
        
        if (predsRes.ok) {
          const predsData: Record<string, RacePrediction> = (await safeResponseJson(predsRes)) || {};
          const candidates = racesData.flatMap((race) => {
            const pred = predsData[race.race_id];
            if (!pred) return [];
            const confidenceSignal = getConfidenceSignal(pred.ai_insights_context);
            const urgencySignal = getUrgencySignal({
              startTime: race.start_time,
              eventDate: race.meeting_date,
            });
            return pred.predictions.map((pick) => {
              const horse = race.horses.find((h) => h.horse_id === pick.horse_id);
              return {
                id: `${race.race_id}-${pick.horse_id}`,
                sport: "racing" as const,
                selectionName: pick.name,
                eventLabel: `${race.venue} R${race.race_number}`,
                probability: pick.win_probability,
                fairOdds: pick.fair_odds,
                marketOdds: horse?.betfair_back_price ?? null,
                confidenceSignal,
                urgencySignal,
                eventTime: race.start_time || race.meeting_date,
                href: raceType !== "T" ? `/racing?type=${raceType}` : "/racing",
              };
            });
          });
          if (candidates.length > 0) {
            opps = rankOpportunities(candidates).slice(0, 5);
          }
        }
      } catch (err) {
        console.warn("Prediction fetch failed, using fallback.", err);
      }
      
      return { upcomingRaces: mappedRaces, opportunities: opps };
    },
  });

  const upcomingRaces = racingData?.upcomingRaces ?? [];
  const opportunities = racingData?.opportunities ?? [];
  const racesError = racesErrorObj ? racesErrorObj.message : null;
  const oppsLoading = racesLoading;
  const oppsError = racesError;

  // Blackbook Query
  const { data: blackbookItemsData, isLoading: blackbookLoading } = useQuery({
    queryKey: ["blackbook", token],
    queryFn: async () => {
      const res = await fetch(`${ML_API}/blackbook`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load blackbook");
      const data = await safeResponseJson(res);
      return data?.configs || [];
    },
    enabled: !isGuest && !!token,
  });

  const blackbookItems = blackbookItemsData ?? [];

  // Sports Query
  const {
    data: upcomingSportsData,
    isLoading: sportsLoading,
    error: sportsErrorObj,
    refetch: refetchSports,
  } = useQuery({
    queryKey: ["home-sports"],
    queryFn: async () => {
      const results = await Promise.allSettled([
        // AFL
        fetchWithTimeout(`${ML_API}/api/afl/games/upcoming`, { timeoutMs: 30000 })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await safeResponseJson(res);
            const games = (data?.games ?? []) as any[];
            return games.map((game) => ({
              id: game.game_id || `afl-${game.id}`,
              sport: "afl",
              home_team: game.home_team,
              away_team: game.away_team,
              match_time: game.date || game.start_time || game.game_time,
              predicted_winner: game.predicted_winner || game.home_team,
              win_probability: game.win_probability ?? 0.55,
              fair_odds: game.fair_odds ?? 1.82,
              market_odds: game.market_odds ?? null,
            }));
          })
          .catch(() => []),
        // NRL
        fetchWithTimeout(`${ML_API}/api/nrl/games/upcoming`, { timeoutMs: 30000 })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await safeResponseJson(res);
            const games = (data?.games ?? []) as any[];
            return games.map((game) => ({
              id: game.game_id || `nrl-${game.id}`,
              sport: "nrl",
              home_team: game.home_team,
              away_team: game.away_team,
              match_time: game.date || game.start_time || game.game_time,
              predicted_winner: game.predicted_winner || game.home_team,
              win_probability: game.win_probability ?? 0.55,
              fair_odds: game.fair_odds ?? 1.82,
              market_odds: game.market_odds ?? null,
            }));
          })
          .catch(() => []),
        // NBA
        fetchWithTimeout(`${ML_API}/api/nba/games/today`, { timeoutMs: 30000 })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await safeResponseJson(res);
            const games = (data?.games ?? []) as any[];
            return games.map((game) => ({
              id: game.game_id || `nba-${game.id}`,
              sport: "nba",
              home_team: game.home_team,
              away_team: game.away_team,
              match_time: game.game_time || game.date || game.start_time,
              predicted_winner: game.predicted_winner || game.home_team,
              win_probability: game.win_probability ?? 0.55,
              fair_odds: game.fair_odds ?? 1.82,
              market_odds: game.market_odds ?? null,
            }));
          })
          .catch(() => []),
        // Soccer
        fetchWithTimeout(`${ML_API}/api/soccer/games/today`, { timeoutMs: 30000 })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await safeResponseJson(res);
            const games = (data?.games ?? []) as any[];
            return games.map((game) => ({
              id: game.game_id || `soccer-${game.id}`,
              sport: "soccer",
              home_team: game.home_team,
              away_team: game.away_team,
              match_time: game.match_time || game.date || game.start_time,
              predicted_winner: game.predicted_winner || game.home_team,
              win_probability: game.win_probability ?? 0.55,
              fair_odds: game.fair_odds ?? 1.82,
              market_odds: game.market_odds ?? null,
            }));
          })
          .catch(() => []),
      ]);

      const allItems: UpcomingSportItem[] = [];
      for (const res of results) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
          allItems.push(...res.value);
        }
      }

      // Filter out matches that started more than 15 minutes ago
      const nowMs = Date.now();
      const activeSports = allItems.filter((s) => {
        if (!s.match_time) return true;
        const startMs = new Date(s.match_time).getTime();
        return startMs > nowMs - 15 * 60 * 1000;
      });

      // Sort by upcoming match_time ASC; if same time, prioritize AFL & NRL ahead of NBA
      const sportPriority: Record<string, number> = { afl: 1, nrl: 2, soccer: 3, nba: 4 };
      activeSports.sort((a, b) => {
        const tA = a.match_time ? new Date(a.match_time).getTime() : Infinity;
        const tB = b.match_time ? new Date(b.match_time).getTime() : Infinity;
        if (tA !== tB) return tA - tB;
        return (sportPriority[a.sport] || 5) - (sportPriority[b.sport] || 5);
      });

      return activeSports.slice(0, 6);
    },
  });

  const upcomingSports = upcomingSportsData ?? [];
  const sportsError = sportsErrorObj ? sportsErrorObj.message : null;

  const racingLinkHref = raceType !== "T" ? `/racing?type=${raceType}` : "/racing";

  return (
    <ErrorBoundary sectionName="Home Landing">
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
        {/* Clean Dashboard Header */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-xl">
          <div className="text-emerald-400 font-semibold text-xs sm:text-sm mb-1">
            <span>AI-Powered Betting Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            BetMate Dashboard
          </h1>
        </section>

        {/* 4-Card Grid Component */}
        <HomePrimaryCard
          opportunities={opportunities}
          oppsLoading={oppsLoading}
          oppsError={oppsError}
          blackbookItems={blackbookItems}
          blackbookLoading={blackbookLoading}
          isGuest={isGuest}
          upcomingRaces={upcomingRaces}
          racesLoading={racesLoading}
          racesError={racesError}
          upcomingSports={upcomingSports}
          sportsLoading={sportsLoading}
          sportsError={sportsError}
          racingLinkHref={racingLinkHref}
          onRefreshRacing={() => refetchRacing()}
          onRefreshSports={() => refetchSports()}
          onRefreshOpps={() => refetchRacing()}
        />
      </div>
    </ErrorBoundary>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="dashboard-loading">
          <div className="loading-pulse">
            <Trophy size={48} />
            <p>Loading dashboard...</p>
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
