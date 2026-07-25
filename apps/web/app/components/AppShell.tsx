"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import PaperBetslip from "./PaperBetslip";
import OnboardingTour from "./OnboardingTour";
import AskBobBubble from "./AskBobBubble";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toasts, removeToast } = usePaperBetslip();

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
        <AskBobBubble />
        {/* Global Toasts Container */}
        {toasts && toasts.length > 0 && (
          <div className="toast-container">
            {toasts.map((toast) => {
              let Icon = AlertTriangle;
              let title = "Notification";
              if (toast.type === "warning") {
                title = "Warning";
              } else if (toast.type === "error") {
                Icon = X;
                title = "Error";
              } else if (toast.type === "success") {
                Icon = CheckCircle2;
                title = "Success";
              } else if (toast.type === "info") {
                Icon = Info;
                title = "Info";
              }

              return (
                <div key={toast.id} className={`toast-notification ${toast.type}`}>
                  <Icon size={18} className={`toast-icon-${toast.type}`} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div className="toast-content">
                    <div className="toast-title">{title}</div>
                    <div className="toast-message">{toast.message}</div>
                  </div>
                  <button type="button" className="toast-close" onClick={() => removeToast(toast.id)}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getPageTitle(path: string) {
  if (path === "/") return "Dashboard";
  if (path === "/racing") return "🏇 Racing Predictions";
  if (path === "/afl") return "🏈 AFL Predictions";
  if (path === "/nba") return "🏀 NBA Predictions";
  if (path === "/nrl") return "🛡️ NRL Predictions";
  if (path === "/soccer") return "⚽ Soccer Predictions";
  if (path === "/golf") return "⛳ Golf Predictions";
  if (path === "/mma") return "🥊 MMA Predictions";
  if (path === "/strategy") return "📊 Strategies";
  if (path.startsWith("/races")) return "Race Detail";
  if (path === "/bets/new") return "Log a Bet";
  if (path === "/bets") return "Bankroll";
  if (path === "/bankroll") return "Bankroll";
  if (path === "/analytics") return "Analytics";
  if (path === "/blackbook") return "Black Book";
  if (path === "/how-it-works") return "How BetMate Works";
  if (path === "/settings") return "Settings";
  return "BetMate";
}
