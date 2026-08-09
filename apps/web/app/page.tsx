"use client";

import { Suspense, useEffect, useState } from "react";
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

  // High EV state — start empty, load from live API only
  const [opportunities, setOpportunities] = useState<RankedOpportunity[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [oppsError, setOppsError] = useState<string | null>(null);

  // Blackbook state
  const [blackbookItems, setBlackbookItems] = useState<BlackbookItem[]>([]);
  const [blackbookLoading, setBlackbookLoading] = useState(false);

  // Racing state — start empty, load from live API only
  const [upcomingRaces, setUpcomingRaces] = useState<UpcomingRaceItem[]>([]);
  const [racesLoading, setRacesLoading] = useState(true);
  const [racesError, setRacesError] = useState<string | null>(null);

  // Sports state — start empty, load from live API only
  const [upcomingSports, setUpcomingSports] = useState<UpcomingSportItem[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);



  // Clear any legacy stale cache from sessionStorage on mount
  useEffect(() => {
    try {
      sessionStorage.removeItem("bm_home_cache");
    } catch {}
  }, []);

  // Background live fetch for Racing & High EV opportunities (fast 4s timeout)
  useEffect(() => {
    async function loadRacingData() {
      setRacesLoading(true);
      setOppsLoading(true);
      try {
        let racesRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=${raceType}`, { timeoutMs: 30000 }).catch(() => null);
        if ((!racesRes || !racesRes.ok) && raceType !== "T") {
          racesRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=T`, { timeoutMs: 30000 }).catch(() => null);
        }

        let responseJson = racesRes && racesRes.ok ? await safeResponseJson(racesRes) : null;
        let racesData: Race[] = (Array.isArray(responseJson?.races)
          ? responseJson.races
          : Array.isArray(responseJson)
          ? responseJson
          : []) as Race[];

        if (racesData.length > 0) {
          // 1. Map upcoming races IMMEDIATELY from racesData
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

          setUpcomingRaces(mappedRaces);

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
                href: raceType !== "T" ? `/racing?type=${raceType}` : "/racing",
              };
            });
          });

          const rankedFallback = rankOpportunities(fallbackCandidates);
          if (rankedFallback.length > 0) {
            setOpportunities(rankedFallback.slice(0, 5));
          }

          // 3. Asynchronously fetch ML predictions in background
          fetchWithTimeout(`${ML_API}/api/predict/racing/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ races: racesData }),
            timeoutMs: 5000,
          })
            .then(async (predsRes) => {
              if (predsRes.ok) {
                const predsData: Record<string, RacePrediction> =
                  (await safeResponseJson(predsRes)) || {};

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
                      href: raceType !== "T" ? `/racing?type=${raceType}` : "/racing",
                    };
                  });
                });

                if (candidates.length > 0) {
                  const ranked = rankOpportunities(candidates);
                  setOpportunities(ranked.slice(0, 5));
                }
              }
            })
            .catch(() => {});
        } else {
          // API returned no races — ensure we show the empty state, not stale data
          setUpcomingRaces([]);
          setOpportunities([]);
        }
      } catch (err) {
        console.warn("Background racing fetch note:", err);
        setRacesError("Unable to load live racing data.");
        setOppsError("Unable to load value opportunities.");
      } finally {
        setRacesLoading(false);
        setOppsLoading(false);
      }
    }

    void loadRacingData();
  }, [raceType]);

  // Fetch Blackbook data
  useEffect(() => {
    async function loadBlackbook() {
      if (isGuest || !token) {
        setBlackbookLoading(false);
        return;
      }
      try {
        const res = await fetch(`${ML_API}/blackbook`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await safeResponseJson(res);
          setBlackbookItems(data?.configs || []);
        }
      } catch (err) {
        console.warn("Blackbook fetch note:", err);
      }
    }

    void loadBlackbook();
  }, [token, isGuest]);

  // Background live fetch for Sports data (fast 4s timeout)
  useEffect(() => {
    async function loadSportsData() {
      setSportsLoading(true);
      try {
        const results = await Promise.allSettled([
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
                match_time: game.game_time || game.start_time,
                predicted_winner: game.predicted_winner || game.home_team,
                win_probability: game.win_probability ?? 0.55,
                fair_odds: game.fair_odds ?? 1.82,
                market_odds: game.market_odds ?? null,
              }));
            })
            .catch(() => []),
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
                match_time: game.start_time || game.game_time,
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
                match_time: game.start_time || game.game_time,
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
                match_time: game.match_time || game.start_time,
                predicted_winner: game.predicted_winner || game.home_team,
                win_probability: game.win_probability ?? 0.55,
                fair_odds: game.fair_odds ?? 1.82,
                market_odds: game.market_odds ?? null,
              }));
            })
            .catch(() => []),
        ]);

        const items: UpcomingSportItem[] = [];
        for (const res of results) {
          if (res.status === "fulfilled" && Array.isArray(res.value) && res.value.length > 0) {
            items.push(...res.value.slice(0, 3));
          }
        }

        setUpcomingSports(items.length > 0 ? items.slice(0, 6) : []);
      } catch (err) {
        console.warn("Sports background fetch note:", err);
        setSportsError("Unable to load sports data.");
      } finally {
        setSportsLoading(false);
      }
    }

    void loadSportsData();
  }, []);

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
