"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Trophy, Zap, CircleDot, Receipt, Wallet } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/racing", label: "Racing", icon: Trophy },
  { href: "/afl", label: "AFL", icon: CircleDot },
  { href: "/nba", label: "NBA", icon: Zap },
  { href: "/bets", label: "Paper Bets", icon: Receipt },
  { href: "/bankroll", label: "Bankroll", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 35 }} onClick={onClose} className="sidebar-backdrop" />}
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <Trophy size={24} style={{ color: "var(--accent)" }} />
          <h1>BetMate</h1>
        </div>
        <nav>
          <ul className="sidebar-nav">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className={pathname === href ? "active" : ""} onClick={onClose}>
                  <Icon size={18} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
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
