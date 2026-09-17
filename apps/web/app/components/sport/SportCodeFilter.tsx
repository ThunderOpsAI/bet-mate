"use client";

import Link from "next/link";
import { CircleDot, Shield, Zap, Globe, Flag, Swords, Flame } from "lucide-react";

export type SportCode = "nba" | "nfl" | "afl" | "nrl" | "soccer" | "mma" | "golf";

interface SportCodeFilterProps {
  activeSport: SportCode;
}

const sports = [
  { id: "nba", label: "NBA", icon: Zap, href: "/nba" },
  { id: "nfl", label: "NFL", icon: Flame, href: "/nfl" },
  { id: "afl", label: "AFL", icon: CircleDot, href: "/afl" },
  { id: "nrl", label: "NRL", icon: Shield, href: "/nrl" },
  { id: "soccer", label: "Soccer", icon: Globe, href: "/soccer" },
  { id: "mma", label: "MMA", icon: Swords, href: "/mma" },
  { id: "golf", label: "Golf", icon: Flag, href: "/golf" },
] as const;

export default function SportCodeFilter({ activeSport }: SportCodeFilterProps) {
  return (
    <div className="race-code-filter" style={{ marginBottom: "1rem" }}>
      <div className="race-code-filter-group" style={{ flexWrap: "wrap" }}>
        {sports.map((sport) => {
          const Icon = sport.icon;
          const isActive = activeSport === sport.id;
          return (
            <Link
              key={sport.id}
              href={sport.href}
              className={`race-code-pill ${isActive ? "active" : ""}`}
            >
              <Icon size={14} />
              {sport.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
