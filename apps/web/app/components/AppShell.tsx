"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import BobMascot from "./BobMascot";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Auth pages don't need shell
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="top-header">
          <div className="header-title-wrap">
            <button className="mobile-menu-btn" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <BobMascot className="brand-mark brand-mark-sm header-mascot-slot" />
            <div className="header-title-copy">
              <span className="header-kicker">BetMate</span>
              <h2>{getPageTitle(pathname)}</h2>
            </div>
          </div>
          <div className="header-live-badge">
            <span className="live-dot" /> ML Engine Live
          </div>
        </header>
        <main className="page-content">{children}</main>
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
  if (path === "/bets") return "My Bets";
  if (path === "/bankroll") return "Bankroll";
  if (path === "/analytics") return "Analytics";
  if (path === "/settings") return "Settings";
  return "BetMate";
}
