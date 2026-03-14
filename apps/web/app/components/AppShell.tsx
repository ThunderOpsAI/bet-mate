"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Show loading state
  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="skeleton" style={{ width: 200, height: 24 }} />
      </div>
    );
  }

  // Auth pages don't need shell
  if (isAuthPage) return <>{children}</>;

  // Redirect to login if not authenticated
  if (!user) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

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
          <div className="user-badge" onClick={() => router.push("/settings")}>
            {user.username} · {formatCurrency(user.currentBankroll)}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function getPageTitle(path: string) {
  if (path === "/") return "Dashboard";
  if (path.startsWith("/races")) return "Race Detail";
  if (path === "/bets/new") return "Log a Bet";
  if (path === "/bets") return "My Bets";
  if (path === "/bankroll") return "Bankroll";
  if (path === "/analytics") return "Analytics";
  if (path === "/settings") return "Settings";
  return "BetMate";
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}
