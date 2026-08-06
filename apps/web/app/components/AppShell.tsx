"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LogIn,
  LogOut,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Home,
  Trophy,
  Zap,
  FlaskConical,
  Bot,
  Settings,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import PromoCarousel from "./PromoCarousel";

const PaperBetslip = dynamic(() => import("./PaperBetslip"), { ssr: false });
const AskBobBubble = dynamic(() => import("./AskBobBubble"), { ssr: false });
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { useAuth } from "../providers/AuthProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toasts, removeToast } = usePaperBetslip();
  const { user, logout } = useAuth();
  const isGuest = !user || user.id === "guest";
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isAuthPage) return <>{children}</>;

  const startingBaseline = 10000;
  const currentBalance = user?.currentBankroll ?? startingBaseline;
  const pnl = currentBalance - startingBaseline;

  return (
    <div className="app-shell flex flex-col min-h-screen">
      <div className="main-area flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="top-header">
          <div className="top-header-primary">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/brand/betmate-logo.png"
                alt="BetMate"
                width={120}
                height={32}
                style={{ width: "auto", height: "30px", objectFit: "contain" }}
                priority
              />
            </Link>
            <h2 className="hidden sm:block text-slate-200 text-sm font-semibold ml-2 border-l border-slate-700/60 pl-3">
              {getPageTitle(pathname)}
            </h2>
          </div>

          <div className="flex-1 mx-4 hidden md:block max-w-xl">
            <PromoCarousel />
          </div>

          <div className="relative" ref={dropdownRef}>
            {!isGuest ? (
              <div>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="user-badge flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 transition-all text-xs font-medium"
                  aria-expanded={profileDropdownOpen}
                  aria-label="User Profile Menu"
                >
                  <UserIcon size={14} className="text-emerald-400" />
                  <span className="max-w-[100px] truncate">{user.username}</span>
                  <span className="text-emerald-400 font-semibold">
                    (${currentBalance.toLocaleString()})
                  </span>
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <p className="text-sm font-bold text-white">{user.username}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[180px]">
                          {user.email || "Virtual Strategy Trader"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    {/* Bankroll Summary Card */}
                    <div className="my-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Starting Baseline</span>
                        <span className="font-semibold text-slate-300">
                          ${startingBaseline.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Virtual Balance</span>
                        <span className="font-bold text-emerald-400 text-sm">
                          ${currentBalance.toLocaleString()}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Net Return</span>
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {pnl >= 0 ? "+" : ""}
                          ${pnl.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="space-y-1">
                      <Link
                        href="/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Settings size={14} className="text-slate-400" />
                        <span>Profile & Settings</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={`/login?returnUrl=${encodeURIComponent(pathname)}`}
                className="btn btn-sm btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content flex-1">{children}</main>

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
                  <Icon
                    size={18}
                    className={`toast-icon-${toast.type}`}
                    style={{ flexShrink: 0, marginTop: "2px" }}
                  />
                  <div className="toast-content">
                    <div className="toast-title">{title}</div>
                    <div className="toast-message">{toast.message}</div>
                  </div>
                  <button
                    type="button"
                    className="toast-close"
                    onClick={() => removeToast(toast.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Footer & Responsible Gambling Compliance */}
        <footer className="w-full bg-slate-950/90 border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-400 mt-auto mb-16 md:mb-0">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-slate-300 font-medium">
              <Link
                href="/how-it-works"
                className="hover:text-emerald-400 transition-colors underline decoration-slate-700 underline-offset-4"
              >
                How It Works
              </Link>
              <Link
                href="/strategy"
                className="hover:text-emerald-400 transition-colors"
              >
                Strategy Lab
              </Link>
              <Link
                href="/racing"
                className="hover:text-emerald-400 transition-colors"
              >
                Racing Models
              </Link>
              <Link
                href="/settings"
                className="hover:text-emerald-400 transition-colors"
              >
                Settings
              </Link>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 max-w-2xl mx-auto text-slate-300 font-semibold space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-amber-400">
                <ShieldAlert size={15} />
                <span>Gamble Responsibly</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                18+ | Gamble Responsibly | Australian Users: Gambling Help Online 1800 858 858
              </p>
            </div>

            <p className="text-[11px] text-slate-500">
              BetMate is an AI prediction and simulated paper-betting strategy platform for educational and research purposes.
            </p>
          </div>
        </footer>

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-bottom-nav">
          <Link
            href="/"
            className={`bottom-nav-item ${pathname === "/" ? "active" : ""}`}
          >
            <Home size={20} />
            <span>Home</span>
          </Link>
          <Link
            href="/racing"
            className={`bottom-nav-item ${
              pathname === "/racing" || pathname.startsWith("/races")
                ? "active"
                : ""
            }`}
          >
            <Trophy size={20} />
            <span>Racing</span>
          </Link>
          <Link
            href="/afl"
            className={`bottom-nav-item ${
              pathname === "/afl" ||
              pathname === "/nrl" ||
              pathname === "/nba" ||
              pathname === "/soccer"
                ? "active"
                : ""
            }`}
          >
            <Zap size={20} />
            <span>Sport</span>
          </Link>
          <Link
            href="/strategy"
            className={`bottom-nav-item ${
              pathname === "/strategy" || pathname === "/analytics"
                ? "active"
                : ""
            }`}
          >
            <FlaskConical size={20} />
            <span>Lab</span>
          </Link>
          <button
            type="button"
            className="bottom-nav-item"
            onClick={() => window.dispatchEvent(new CustomEvent("open-ask-bob"))}
          >
            <Bot size={20} />
            <span>Ask Bob</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function getPageTitle(path: string) {
  if (path === "/") return "Home";
  if (path === "/racing") return "Racing Predictions";
  if (path === "/afl") return "AFL Predictions";
  if (path === "/nba") return "NBA Predictions";
  if (path === "/nrl") return "NRL Predictions";
  if (path === "/soccer") return "Soccer Predictions";
  if (path === "/golf") return "Golf Predictions";
  if (path === "/mma") return "MMA Predictions";
  if (path === "/strategy") return "Strategies";
  if (path.startsWith("/races")) return "Race Detail";
  if (path === "/analytics") return "Analytics";
  if (path === "/blackbook") return "Black Book";
  if (path === "/settings") return "Settings";
  if (path === "/how-it-works") return "How It Works";
  return "BetMate";
}

