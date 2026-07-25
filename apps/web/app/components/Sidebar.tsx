"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
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
      <li className="sidebar-section-title accordion-header" onClick={() => toggleSection("racing")} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", marginTop: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Trophy size={18} />
          <span>Racing</span>
        </div>
        {expanded.racing ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </li>
      {expanded.racing && (
        <>
          <li>
            <Link href="/racing?type=T" className={isRacingTypeActive("T") ? "active" : ""} onClick={onClose}>
              <Trophy size={18} />
              Thoroughbred
            </Link>
          </li>
          <li>
            <Link href="/racing?type=G" className={isRacingTypeActive("G") ? "active" : ""} onClick={onClose}>
              <CircleDot size={18} />
              Greyhounds
            </Link>
          </li>
          <li>
            <Link href="/racing?type=H" className={isRacingTypeActive("H") ? "active" : ""} onClick={onClose}>
              <Flag size={18} />
              Harness
            </Link>
          </li>
        </>
      )}

      {/* Sport Accordion */}
      <li className="sidebar-section-title accordion-header" onClick={() => toggleSection("sport")} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", marginTop: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap size={18} />
          <span>Sport</span>
        </div>
        {expanded.sport ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </li>
      {expanded.sport && (
        <>
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
        </>
      )}

      {/* Tools Accordion */}
      <li className="sidebar-section-title accordion-header" onClick={() => toggleSection("tools")} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", marginTop: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bot size={18} />
          <span>Tools</span>
        </div>
        {expanded.tools ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </li>
      {expanded.tools && (
        <>
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
        </>
      )}
    </ul>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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
