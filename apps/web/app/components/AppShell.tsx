"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import PaperBetslip from "./PaperBetslip";
import OnboardingTour from "./OnboardingTour";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Auth pages don't need shell
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app-shell">
      <OnboardingTour />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="top-header">
          <div className="top-header-primary">
            <div className="top-header-title-row">
              <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                <Menu size={22} />
              </button>
              <Image
                src="/brand/betmate-logo.png"
                alt="BetMate"
                width={112}
                height={35}
                className="top-header-logo"
                priority
              />
              <h2>{getPageTitle(pathname)}</h2>
            </div>
            <div className="header-live-badge header-live-badge-inline">
              <span className="live-dot" /> ML Engine Live
            </div>
          </div>
          <div className="header-live-badge header-live-badge-desktop">
            <span className="live-dot" /> ML Engine Live
          </div>
        </header>
        <main className="page-content">{children}</main>
        <PaperBetslip />
      </div>
    </div>
  );
}

function getPageTitle(path: string) {
  if (path === "/") return "Dashboard";
  if (path === "/racing") return "🏇 Racing Predictions";
  if (path === "/afl") return "🏈 AFL Predictions";
  if (path === "/nba") return "🏀 NBA Predictions";
  if (path.startsWith("/races")) return "Race Detail";
  if (path === "/bets/new") return "Log a Bet";
  if (path === "/bets") return "Bankroll";
  if (path === "/bankroll") return "Bankroll";
  if (path === "/analytics") return "Analytics";
  if (path === "/how-it-works") return "How BetMate Works";
  if (path === "/settings") return "Settings";
  return "BetMate";
}
