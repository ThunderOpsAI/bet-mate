"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
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
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";

function SidebarNavList({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [expanded, setExpanded] = useState({
    racing: false,
    sport: false,
    tools: false,
  });

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isRacingTypeActive = (type: string) => {
    return pathname === "/racing" && searchParams.get("type") === type;
  };

  return (
    <ul className="sidebar-nav">
      <li>
        <Link href="/" className={pathname === "/" ? "active" : ""} onClick={onClose}>
          <Home size={18} />
          Dashboard
        </Link>
      </li>

      {/* Racing Accordion */}
      <li className="sidebar-section-title accordion-header" onClick={() => toggleSection("racing")}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Trophy size={18} />
          <span>Racing</span>
        </div>
        {expanded.racing ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </li>
      {expanded.racing && (
        <ul className="sidebar-sub-nav">
          <li>
            <Link href="/racing?type=T" className={`sidebar-sub-item ${isRacingTypeActive("T") ? "active" : ""}`} onClick={onClose}>
              <Trophy size={16} />
              Thoroughbred
            </Link>
          </li>
          <li>
            <Link href="/racing?type=G" className={`sidebar-sub-item ${isRacingTypeActive("G") ? "active" : ""}`} onClick={onClose}>
              <CircleDot size={16} />
              Greyhounds
            </Link>
          </li>
          <li>
            <Link href="/racing?type=H" className={`sidebar-sub-item ${isRacingTypeActive("H") ? "active" : ""}`} onClick={onClose}>
              <Flag size={16} />
              Harness
            </Link>
          </li>
        </ul>
      )}

      {/* Sport Accordion */}
      <li className="sidebar-section-title accordion-header" onClick={() => toggleSection("sport")}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap size={18} />
          <span>Sport</span>
        </div>
        {expanded.sport ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </li>
      {expanded.sport && (
        <ul className="sidebar-sub-nav">
          <li>
            <Link href="/afl" className={`sidebar-sub-item ${pathname === "/afl" ? "active" : ""}`} onClick={onClose}>
              <CircleDot size={16} />
              AFL
            </Link>
          </li>
          <li>
            <Link href="/nba" className={`sidebar-sub-item ${pathname === "/nba" ? "active" : ""}`} onClick={onClose}>
              <Zap size={16} />
              NBA
            </Link>
          </li>
          <li>
            <Link href="/nrl" className={`sidebar-sub-item ${pathname === "/nrl" ? "active" : ""}`} onClick={onClose}>
              <Shield size={16} />
              NRL
            </Link>
          </li>
          <li>
            <Link href="/soccer" className={`sidebar-sub-item ${pathname === "/soccer" ? "active" : ""}`} onClick={onClose}>
              <Globe size={16} />
              Soccer
            </Link>
          </li>
          <li>
            <Link href="/golf" className={`sidebar-sub-item ${pathname === "/golf" ? "active" : ""}`} onClick={onClose}>
              <Flag size={16} />
              Golf
            </Link>
          </li>
          <li>
            <Link href="/mma" className={`sidebar-sub-item ${pathname === "/mma" ? "active" : ""}`} onClick={onClose}>
              <Swords size={16} />
              MMA
            </Link>
          </li>
        </ul>
      )}

      {/* Tools Accordion */}
      <li className="sidebar-section-title accordion-header" onClick={() => toggleSection("tools")}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bot size={18} />
          <span>Tools</span>
        </div>
        {expanded.tools ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </li>
      {expanded.tools && (
        <ul className="sidebar-sub-nav">
          <li>
            <Link href="/how-it-works" className={`sidebar-sub-item ${pathname === "/how-it-works" ? "active" : ""}`} onClick={onClose}>
              <CircleHelp size={16} />
              How It Works
            </Link>
          </li>
          <li>
            <Link href="/strategy" className={`sidebar-sub-item ${pathname === "/strategy" ? "active" : ""}`} onClick={onClose}>
              <Bot size={16} />
              Strategies
            </Link>
          </li>
          <li>
            <Link href="/blackbook" className={`sidebar-sub-item ${pathname === "/blackbook" ? "active" : ""}`} onClick={onClose}>
              <BookOpen size={16} />
              Blackbook
            </Link>
          </li>
          <li>
            <Link href="/bets" className={`sidebar-sub-item ${pathname === "/bets" ? "active" : ""}`} onClick={onClose}>
              <Receipt size={16} />
              Bankroll
            </Link>
          </li>
          <li>
            <Link href="/analytics" className={`sidebar-sub-item ${pathname === "/analytics" ? "active" : ""}`} onClick={onClose}>
              <BarChart3 size={16} />
              Analytics
            </Link>
          </li>
        </ul>
      )}
    </ul>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const isGuest = !user || user.id === "guest";

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
          <Suspense fallback={null}>
            <SidebarNavList onClose={onClose} />
          </Suspense>
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: "0.85rem", paddingBottom: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {!isGuest ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                  <UserIcon size={16} style={{ color: "var(--accent-hover)", flexShrink: 0 }} />
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.username}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      ${user.currentBankroll?.toLocaleString() ?? 0}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="btn btn-sm btn-secondary"
                  style={{ padding: "0.3rem 0.5rem" }}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={onClose}
                className="btn btn-sm btn-primary btn-block"
                style={{ fontSize: "0.82rem" }}
              >
                <LogIn size={14} /> Sign In / Register
              </Link>
            )}
          </div>
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
