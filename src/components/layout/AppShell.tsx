import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  Calendar,
  Trophy,
  Activity,
  FlaskConical,
  BookOpen,
  Settings,
  RotateCw,
  User as UserIcon,
  LogOut,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Bot,
  Layers,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  Users
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBetslip } from "../../context/BetslipContext";
import { buildBobExplanation } from "../../lib/bob/explainer";
import type { BobExplanation } from "../../lib/bob/explainer";

interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenBob: (explanation: BobExplanation) => void;
  children: React.ReactNode;
}

const PROMOS = [
  "⚡ XGBoost Model Ensembles Live: 14 Active +EV Overlays Detected",
  "🎯 Copula Multi Builder: Automated SGM Correlation Haircuts",
  "🏇 Flemington & Randwick Saturday Metro Cards Now Analyzed",
  "🧪 Strategy Lab: Fractional Kelly Staking Backtester Ready"
];

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onNavigate,
  onOpenBob,
  children,
}) => {
  const { user, logout } = useAuth();
  const { bets, activeBets, isBetslipOpen, setIsBetslipOpen, setActiveTab, toasts, removeToast } = useBetslip();

  const [profileOpen, setProfileOpen] = useState(false);
  const [promoIdx, setPromoIdx] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cycle promos
  useEffect(() => {
    const timer = setInterval(() => {
      setPromoIdx((prev) => (prev + 1) % PROMOS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const startingBaseline = user.startingBaseline || 10000;
  const currentBalance = user.currentBankroll;
  const pnl = currentBalance - startingBaseline;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const getPageTitle = (view: string) => {
    switch (view) {
      case "home":
        return "Home Overview";
      case "today":
        return "Today's Schedule";
      case "racing":
        return "Racing Predictions";
      case "sport":
        return "Sports Hub";
      case "multi-builder":
        return "Copula Multi Builder";
      case "bets":
        return "My Bets & History";
      case "blackbook":
        return "Blackbook Alerts";
      case "strategy":
        return "Strategy Lab";
      case "analytics":
        return "Analytics & Calibration";
      case "mates":
        return "Bet With Mates";
      case "settings":
        return "Platform Settings";
      case "how-it-works":
        return "How BetMate Works";
      case "legal":
        return "Terms & Privacy";
      default:
        return "BetMate";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Brand & Page Title */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
          >
            <img
              src="/brand/betmate-logo.png"
              alt="BetMate"
              className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </button>

          <span className="hidden md:inline-block text-xs font-bold text-slate-400 pl-3 border-l border-slate-800">
            {getPageTitle(currentView)}
          </span>

          <button
            type="button"
            onClick={() => onNavigate("today")}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ml-2 cursor-pointer ${
              currentView === "today"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            <Calendar size={13} className="text-cyan-400" />
            <span>Today</span>
          </button>
        </div>

        {/* Center: Promo Banner Carousel */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-4 overflow-hidden justify-center">
          <div className="px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate">{PROMOS[promoIdx]}</span>
          </div>
        </div>

        {/* Right: Controls & Header Betslip */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Refresh Data Feeds"
          >
            <RotateCw size={15} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
          </button>

          {/* Settings button */}
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
              currentView === "settings"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white"
            }`}
            title="Settings"
          >
            <Settings size={15} />
          </button>

          {/* Profile Capsule (Virtual Bankroll) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all text-xs font-bold cursor-pointer"
            >
              <UserIcon size={14} className="text-emerald-400 shrink-0" />
              <span className="font-mono font-black text-emerald-400 tracking-tight">
                ${currentBalance.toLocaleString()}
              </span>
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-white">{user.username}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Pro Model
                  </span>
                </div>

                {/* Bankroll PnL summary */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Starting Baseline:</span>
                    <span className="font-semibold text-slate-200">${startingBaseline.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Virtual Equity:</span>
                    <span className="font-bold text-emerald-400">${currentBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Net Return:</span>
                    <span className={`font-black flex items-center gap-1 ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {pnl >= 0 ? "+" : ""}${pnl.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate("settings");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    Settings &amp; Bankroll Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate("mates");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    Bet With Mates Syndicates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut size={13} />
                    <span>Sign Out (Switch Profile)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Header Betslip & Active Dual Pill */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full border border-slate-700/80 bg-slate-950/95 shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setActiveTab("active");
                setIsBetslipOpen(true);
              }}
              className={`px-3 sm:px-3.5 h-8 rounded-full flex items-center gap-2 text-xs font-black tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isBetslipOpen && activeTab === "active"
                  ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/80"
              }`}
              title="Open My Active Bets"
            >
              <span>My Bets</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-black min-w-5 text-center leading-none ${
                  isBetslipOpen && activeTab === "active"
                    ? "bg-emerald-950 text-emerald-200 border border-emerald-400/40"
                    : activeBets.length > 0
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {activeBets.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("slip");
                setIsBetslipOpen(true);
              }}
              className={`px-3 sm:px-3.5 h-8 rounded-full flex items-center gap-2 text-xs font-black tracking-tight whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isBetslipOpen && activeTab === "slip"
                  ? "bg-cyan-600 text-white shadow-md ring-1 ring-cyan-400/50"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/80"
              }`}
              title="Open Betslip"
            >
              <span>Slip</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-black min-w-5 text-center leading-none ${
                  isBetslipOpen && activeTab === "slip"
                    ? "bg-cyan-950 text-cyan-200 border border-cyan-400/40"
                    : bets.length > 0
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {bets.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main App Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-16">
        {children}
      </main>

      {/* Floating Interactive Bob AI Bubble */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-40">
        <button
          type="button"
          onClick={() => {
            const generalExpl = buildBobExplanation({
              sport: "racing",
              selectionName: "Today's Quant Edge Overview",
              probability: 44,
              fairOdds: 2.25,
              marketOdds: 2.80,
              featureImpact: { speed_rating: 0.35, track_conditions: 0.25, barrier_draw: 0.15 },
            });
            onOpenBob(generalExpl);
          }}
          className="group px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs shadow-xl shadow-cyan-500/25 hover:brightness-110 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
        >
          <Bot size={18} className="text-slate-950" />
          <span>Ask Bob AI</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-950/20 text-slate-950">
            Active
          </span>
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-6 py-2 px-1 text-center">
        {[
          { id: "home", label: "Home", icon: Home },
          { id: "today", label: "Today", icon: Calendar },
          { id: "racing", label: "Racing", icon: Activity },
          { id: "sport", label: "Sport", icon: Trophy },
          { id: "strategy", label: "Lab", icon: FlaskConical },
          { id: "blackbook", label: "Blackbook", icon: BookOpen },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-colors cursor-pointer ${
                isActive ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`p-3.5 rounded-2xl shadow-2xl border text-xs flex items-center justify-between gap-3 pointer-events-auto backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150 ${
                toast.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
                  : toast.type === "warning"
                  ? "bg-amber-950/90 border-amber-500/40 text-amber-200"
                  : toast.type === "error"
                  ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
                  : "bg-slate-950/90 border-slate-700 text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === "success" && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                {toast.type === "warning" && <AlertTriangle size={16} className="text-amber-400 shrink-0" />}
                {toast.type === "error" && <X size={16} className="text-rose-400 shrink-0" />}
                {toast.type === "info" && <Info size={16} className="text-cyan-400 shrink-0" />}
                <span className="font-semibold">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Responsible Gambling Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 max-w-xl mx-auto text-slate-300 font-semibold space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-amber-400">
              <ShieldAlert size={15} />
              <span>Gamble Responsibly</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              18+ | Gamble Responsibly | Australian Users: Gambling Help Online 1800 858 858
            </p>
          </div>

          <div className="flex justify-center gap-4 text-xs text-slate-400 pt-1">
            <button
              type="button"
              onClick={() => onNavigate("how-it-works")}
              className="hover:text-emerald-400 underline decoration-slate-600 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigate("legal")}
              className="hover:text-emerald-400 underline decoration-slate-600 transition-colors cursor-pointer"
            >
              Privacy Policy &amp; Terms
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigate("analytics")}
              className="hover:text-emerald-400 underline decoration-slate-600 transition-colors cursor-pointer"
            >
              Model Calibration
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            BetMate is an AI prediction and simulated paper-betting platform for statistical analysis and educational research.
          </p>
        </div>
      </footer>
    </div>
  );
};
