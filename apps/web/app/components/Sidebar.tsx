"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Trophy,
  Zap,
  CircleDot,
  Receipt,
  Bot,
  BookOpen,
  CircleHelp,
  Shield,
  Globe,
  Flag,
  Swords,
} from "lucide-react";
import { getMlCacheDateKey, getMlDataCacheKey, readMlDataCache } from "../lib/cache/mlDataCache";

type VenueItem = { venue?: string };

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<{ racingCount: number; sportsCount: number }>({
    racingCount: 0,
    sportsCount: 0,
  });

  useEffect(() => {
    try {
      const dateKey = getMlCacheDateKey();
      const racingCached = readMlDataCache<VenueItem[]>(getMlDataCacheKey("fixtures", "racing", dateKey));
      const aflCached = readMlDataCache<VenueItem[]>(getMlDataCacheKey("fixtures", "afl", dateKey));
      const nrlCached = readMlDataCache<VenueItem[]>(getMlDataCacheKey("fixtures", "nrl", dateKey));
      const golfCached = readMlDataCache<VenueItem[]>(getMlDataCacheKey("fixtures", "golf", dateKey));
      const mmaCached = readMlDataCache<VenueItem[]>(getMlDataCacheKey("fixtures", "mma", dateKey));

      const racingVenues = new Set((racingCached?.data ?? []).map((r) => r.venue).filter(Boolean));
      const sportsVenues = new Set([
        ...(aflCached?.data ?? []).map((g) => g.venue).filter(Boolean),
        ...(nrlCached?.data ?? []).map((g) => g.venue).filter(Boolean),
        ...(golfCached?.data ?? []).map((t) => t.venue).filter(Boolean),
        ...(mmaCached?.data ?? []).map((m) => m.venue).filter(Boolean),
      ]);

      setCounts({
        racingCount: racingVenues.size,
        sportsCount: sportsVenues.size,
      });
    } catch {
      // safe fallback
    }
  }, [pathname]);

  return (
    <>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 35 }}
          onClick={onClose}
          className="sidebar-backdrop"
        />
      )}
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <Image
            src="/brand/betmate-logo.png"
            alt="BetMate"
            width={156}
            height={50}
            className="sidebar-brand-logo"
            priority
          />
        </div>
        <nav className="sidebar-nav-container">
          <ul className="sidebar-nav">
            <li>
              <Link href="/" className={pathname === "/" ? "active" : ""} onClick={onClose}>
                <Home size={18} />
                Dashboard
              </Link>
            </li>

            <li className="sidebar-section-title">
              <span>Racing</span>
              {counts.racingCount > 0 && (
                <span className="sidebar-section-count">({counts.racingCount} venues)</span>
              )}
            </li>
            <li>
              <Link href="/racing" className={pathname === "/racing" ? "active" : ""} onClick={onClose}>
                <Trophy size={18} />
                Racing {counts.racingCount > 0 ? `(${counts.racingCount} venues)` : ""}
              </Link>
            </li>

            <li className="sidebar-section-title">
              <span>Sports</span>
              {counts.sportsCount > 0 && (
                <span className="sidebar-section-count">({counts.sportsCount} venues)</span>
              )}
            </li>
            <li>
              <Link href="/afl" className={pathname === "/afl" ? "active" : ""} onClick={onClose}>
                <CircleDot size={18} />
                AFL
              </Link>
            </li>
            <li>
              <Link href="/nba" className={pathname === "/nba" ? "active" : ""} onClick={onClose}>
                <Zap size={18} />
                NBA
              </Link>
            </li>
            <li>
              <Link href="/nrl" className={pathname === "/nrl" ? "active" : ""} onClick={onClose}>
                <Shield size={18} />
                NRL
              </Link>
            </li>
            <li>
              <Link href="/soccer" className={pathname === "/soccer" ? "active" : ""} onClick={onClose}>
                <Globe size={18} />
                Soccer
              </Link>
            </li>
            <li>
              <Link href="/golf" className={pathname === "/golf" ? "active" : ""} onClick={onClose}>
                <Flag size={18} />
                Golf
              </Link>
            </li>
            <li>
              <Link href="/mma" className={pathname === "/mma" ? "active" : ""} onClick={onClose}>
                <Swords size={18} />
                MMA
              </Link>
            </li>

            <li className="sidebar-section-title">
              <span>Tools & Hub</span>
            </li>
            <li>
              <Link href="/how-it-works" className={pathname === "/how-it-works" ? "active" : ""} onClick={onClose}>
                <CircleHelp size={18} />
                How It Works
              </Link>
            </li>
            <li>
              <Link href="/strategy" className={pathname === "/strategy" ? "active" : ""} onClick={onClose}>
                <Bot size={18} />
                Strategies
              </Link>
            </li>
            <li>
              <Link href="/blackbook" className={pathname === "/blackbook" ? "active" : ""} onClick={onClose}>
                <BookOpen size={18} />
                Blackbook
              </Link>
            </li>
            <li>
              <Link href="/bets" className={pathname === "/bets" ? "active" : ""} onClick={onClose}>
                <Receipt size={18} />
                Bankroll
              </Link>
            </li>
            <li>
              <Link href="/analytics" className={pathname === "/analytics" ? "active" : ""} onClick={onClose}>
                <BarChart3 size={18} />
                Analytics
              </Link>
            </li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="engine-status">
            <span className="live-dot" />
            <span>ML Engine Active</span>
          </div>
          <p style={{ marginTop: "0.75rem" }}>18+ | Gamble Responsibly</p>
        </div>
      </aside>
    </>
  );
}

