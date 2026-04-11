"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Trophy, Zap, CircleDot, Receipt, Wallet, Bot } from "lucide-react";
import BobMascot from "./BobMascot";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/racing", label: "Racing", icon: Trophy },
  { href: "/afl", label: "AFL", icon: CircleDot },
  { href: "/nba", label: "NBA", icon: Zap },
  { href: "/strategy", label: "Strategies", icon: Bot },
  { href: "/bets", label: "Paper Bets", icon: Receipt },
  { href: "/bankroll", label: "Bankroll", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={onClose}
        />
      )}
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <BobMascot className="brand-mark" />
          <div className="sidebar-brand-copy">
            <h1>BetMate</h1>
            <span>Sports stats and recommendations</span>
          </div>
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
          <p className="responsible-note">
            18+ only. BetMate is informational only.
            <a href="https://www.gamblinghelponline.org.au/" target="_blank" rel="noreferrer">
              Gambling Help Online
            </a>
          </p>
        </div>
      </aside>
    </>
  );
}
