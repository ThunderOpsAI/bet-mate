"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, DollarSign, Home, List, LogOut, Settings, Trophy } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/bets", label: "My Bets", icon: List },
  { href: "/bankroll", label: "Bankroll", icon: DollarSign },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

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
          {user && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{user.username}</span>
              <button onClick={logout} className="btn btn-sm btn-secondary" style={{ gap: "0.3rem" }}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
          <p style={{ marginTop: "0.75rem" }}>18+ | Gamble Responsibly</p>
        </div>
      </aside>
    </>
  );
}
