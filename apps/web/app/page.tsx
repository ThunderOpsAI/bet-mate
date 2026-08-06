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

  // High EV state
  const [opportunities, setOpportunities] = useState<RankedOpportunity[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [oppsError, setOppsError] = useState<string | null>(null);

  // Blackbook state
  const [blackbookItems, setBlackbookItems] = useState<BlackbookItem[]>([]);
  const [blackbookLoading, setBlackbookLoading] = useState(true);

  // Racing state
  const [upcomingRaces, setUpcomingRaces] = useState<UpcomingRaceItem[]>([]);
  const [racesLoading, setRacesLoading] = useState(true);
  const [racesError, setRacesError] = useState<string | null>(null);

  // Sports state
  const [upcomingSports, setUpcomingSports] = useState<UpcomingSportItem[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);

  // Fetch Racing data (used for both High EV and Next Racing tabs)
  useEffect(() => {
    async function loadRacingData() {
      setOppsLoading(true);
      setRacesLoading(true);
      setOppsError(null);
      setRacesError(null);

      try {
        let racesRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=${raceType}`, { timeoutMs: 5000 });
        if (!racesRes.ok && raceType !== "T") {
          racesRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=T`, { timeoutMs: 5000 });
        }
        if (!racesRes.ok) throw new Error("Racing feed unavailable");

        let racesData: Race[] = (await safeResponseJson(racesRes)) || [];

        if (racesData.length === 0 && raceType !== "T") {
          const fallbackRes = await fetchWithTimeout(`${ML_API}/api/races/today?type=T`, { timeoutMs: 5000 });
          if (fallbackRes.ok) {
            racesData = (await safeResponseJson(fallbackRes)) || [];
          }
        }

        if (racesData.length > 0) {
          const predsRes = await fetchWithTimeout(
            `${ML_API}/api/predict/racing`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ races: racesData }),
              timeoutMs: 6000,
            }
          );

          if (predsRes.ok) {
            const predsData: Record<string, RacePrediction> =
              (await safeResponseJson(predsRes)) || {};

            // High EV Candidates
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

            const ranked = rankOpportunities(candidates);
            setOpportunities(ranked.slice(0, 5));

            // Upcoming Races mapping
            const mappedRaces: UpcomingRaceItem[] = racesData.slice(0, 6).map((race) => {
              const pred = predsData[race.race_id];
              const topPick = pred?.predictions?.[0];
              const horse = topPick
                ? race.horses.find((h) => h.horse_id === topPick.horse_id)
                : undefined;

              return {
                race_id: race.race_id,
                venue: race.venue,
                race_number: race.race_number,
                start_time: race.start_time,
                meeting_date: race.meeting_date,
                topRunner: topPick
                  ? {
                      horse_id: topPick.horse_id,
                      name: topPick.name,
                      win_probability: topPick.win_probability,
                      fair_odds: topPick.fair_odds,
                      market_odds: horse?.betfair_back_price ?? null,
                    }
                  : undefined,
              };
            });

            setUpcomingRaces(mappedRaces);
          } else {
            setUpcomingRaces([]);
            setOpportunities([]);
          }
        } else {
          setUpcomingRaces([]);
          setOpportunities([]);
        }
      } catch (err) {
        console.error("Racing fetch error:", err);
        setOppsError("Could not fetch live high-EV opportunities.");
        setRacesError("Could not fetch live racing cards.");
      } finally {
        setOppsLoading(false);
        setRacesLoading(false);
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
      setBlackbookLoading(true);
      try {
        const res = await fetch(`${ML_API}/blackbook`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await safeResponseJson(res);
          setBlackbookItems(data?.configs || []);
        } else {
          setBlackbookItems([]);
        }
      } catch (err) {
        console.error("Home blackbook fetch error:", err);
        setBlackbookItems([]);
      } finally {
        setBlackbookLoading(false);
      }
    }

    void loadBlackbook();
  }, [token, isGuest]);

  // Fetch Sports data (AFL / NBA / NRL / Soccer)
  useEffect(() => {
    async function loadSportsData() {
      setSportsLoading(true);
      setSportsError(null);

      const items: UpcomingSportItem[] = [];

      try {
        // Fetch NBA games
        const nbaRes = await fetchWithTimeout(`${ML_API}/api/nba/games/today`, { timeoutMs: 4000 });
        if (nbaRes.ok) {
          const nbaData = await safeResponseJson(nbaRes);
          const games = (nbaData?.games ?? []) as any[];
          for (const game of games.slice(0, 3)) {
            let pred: any = null;
            try {
              const predRes = await fetchWithTimeout(`${ML_API}/api/predict/nba`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(game),
                timeoutMs: 3000,
              });
              if (predRes.ok) pred = await safeResponseJson(predRes);
            } catch (e) {
              // ignore single game prediction error
            }

            items.push({
              id: game.game_id || `nba-${game.id}`,
              sport: "nba",
              home_team: game.home_team,
              away_team: game.away_team,
              match_time: game.game_time || game.start_time,
              predicted_winner: pred?.predicted_winner || game.home_team,
              win_probability: pred?.win_probability,
              fair_odds: pred?.fair_odds,
              market_odds: game.market_odds,
            });
          }
        }
      } catch (err) {
        console.error("Sports fetch error:", err);
      }

      try {
        // Fetch AFL games
        const aflRes = await fetchWithTimeout(`${ML_API}/api/afl/games/upcoming`, { timeoutMs: 4000 });
        if (aflRes.ok) {
          const aflData = await safeResponseJson(aflRes);
          const games = (aflData?.games ?? []) as any[];
          for (const game of games.slice(0, 3)) {
            items.push({
              id: game.game_id || `afl-${game.id}`,
              sport: "afl",
              home_team: game.home_team,
              away_team: game.away_team,
              match_time: game.start_time,
              predicted_winner: game.home_team,
              win_probability: 0.55,
              fair_odds: 1.82,
            });
          }
        }
      } catch (err) {
        console.error("AFL fetch error:", err);
      }

      setUpcomingSports(items);
      setSportsLoading(false);
    }

    void loadSportsData();
  }, []);

  const racingLinkHref = raceType !== "T" ? `/racing?type=${raceType}` : "/racing";

  return (
    <ErrorBoundary sectionName="Home Landing">
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
        {/* Welcome / Quick Hub Header Banner */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1">
                <Sparkles size={16} />
                <span>AI-Powered Betting Intelligence</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
                BetMate Dashboard
              </h1>
              <p className="text-slate-400 text-sm md:text-base mt-1 max-w-2xl">
                Real-time value opportunities, model predictions across racing &amp; sports, and automated Blackbook watch rules.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={racingLinkHref} className="btn btn-primary text-sm flex items-center gap-2">
                <Trophy size={16} />
                <span>Racing Cards</span>
              </Link>
              <Link href="/strategy" className="btn btn-secondary text-sm flex items-center gap-2">
                <Bot size={16} />
                <span>Strategies</span>
              </Link>
            </div>
          </div>

          {/* Quick Sport Links Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-6">
            <Link
              href={racingLinkHref}
              className="p-3 bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
            >
              <Trophy size={20} className="text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-slate-200">Racing</span>
            </Link>
            <Link
              href="/afl"
              className="p-3 bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
            >
              <Zap size={20} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-slate-200">AFL</span>
            </Link>
            <Link
              href="/nba"
              className="p-3 bg-slate-950/60 border border-slate-800 hover:border-sky-500/50 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
            >
              <Zap size={20} className="text-sky-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-slate-200">NBA</span>
            </Link>
            <Link
              href="/nrl"
              className="p-3 bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
            >
              <Shield size={20} className="text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-slate-200">NRL</span>
            </Link>
            <Link
              href="/soccer"
              className="p-3 bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
            >
              <Globe size={20} className="text-cyan-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-slate-200">Soccer</span>
            </Link>
            <Link
              href="/blackbook"
              className="p-3 bg-slate-950/60 border border-slate-800 hover:border-purple-500/50 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
            >
              <BookOpen size={20} className="text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-slate-200">Blackbook</span>
            </Link>
          </div>
        </section>

        {/* Refactored Single Primary Card Component */}
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
