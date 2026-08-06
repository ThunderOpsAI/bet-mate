"use client";

import Link from "next/link";
import { CircleDot, Shield, Zap, Globe, Flag, Swords } from "lucide-react";

export type SportCode = "afl" | "nrl" | "nba" | "soccer" | "golf" | "mma";

interface SportCodeFilterProps {
  activeSport: SportCode;
}

const sports = [
  { id: "afl", label: "AFL", icon: CircleDot, href: "/afl" },
  { id: "nrl", label: "NRL", icon: Shield, href: "/nrl" },
  { id: "nba", label: "NBA", icon: Zap, href: "/nba" },
  { id: "soccer", label: "Soccer", icon: Globe, href: "/soccer" },
  { id: "golf", label: "Golf", icon: Flag, href: "/golf" },
  { id: "mma", label: "MMA", icon: Swords, href: "/mma" },
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
