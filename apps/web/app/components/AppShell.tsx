"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, User } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import BobMascot from "./BobMascot";
import Sidebar from "./Sidebar";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback", "/terms", "/privacy"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, hasCompletedCompliance, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicPage = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const needsCompliance = Boolean(user && !hasCompletedCompliance && pathname !== "/compliance");

  useEffect(() => {
    if (isPublicPage || isLoading) return;
    if (!user) {
      router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (needsCompliance) {
      router.replace("/compliance");
    }
  }, [isLoading, isPublicPage, needsCompliance, pathname, router, user]);

  if (isPublicPage) return <>{children}</>;

  if (isLoading || !user || needsCompliance) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BobMascot className="brand-mark" />
          <p>Loading your BetMate account...</p>
        </div>
      </div>
    );
  }

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
          <div className="header-actions">
            <Link href="/settings" className="user-badge">
              <User size={15} />
              <span>{user.displayName}</span>
            </Link>
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              onClick={() => {
                void logout().then(() => router.replace("/login"));
              }}
            >
              <LogOut size={15} /> Sign out
            </button>
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
  if (path === "/compliance") return "Account Confirmation";
  return "BetMate";
}
