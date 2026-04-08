"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Auth pages don't need shell
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <h2>{getPageTitle(pathname)}</h2>
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
