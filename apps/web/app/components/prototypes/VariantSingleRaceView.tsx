"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import VariantNavigationShell from "./VariantNavigationShell";
import VariantRacingFilters from "./VariantRacingFilters";
import VariantRunnerTable from "./VariantRunnerTable";
import { FALLBACK_MEETINGS, getMockPredictions } from "../../lib/prototypes/prototypeData";
import { ArrowLeft, Sparkles } from "lucide-react";
import "./prototypes.css";

interface VariantSingleRaceViewProps {
  variant: "a" | "b" | "c";
  venue: string;
  raceId: string;
}

function SingleRaceViewContent({ variant, venue, raceId }: VariantSingleRaceViewProps) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const decodedVenue = decodeURIComponent(venue);
  const [activeMarket, setActiveMarket] = useState<"win" | "srm" | "exotics">("win");

  const meeting = FALLBACK_MEETINGS.find(
    (m) => m.venue.toLowerCase() === decodedVenue.toLowerCase()
  ) || FALLBACK_MEETINGS[0];

  const race = meeting.races.find((r) => r.race_id === raceId) || meeting.races[0];
  const prediction = getMockPredictions(race);

  return (
    <VariantNavigationShell activeVariant={variant}>
      <VariantRacingFilters />

      <div className="prototype-page-container">
        {/* Back Link to Level 2 Meeting Overview */}
        <Link
          href={`/variant-${variant}/racing/${encodeURIComponent(meeting.venue)}${queryString}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "#94a3b8",
            fontSize: "0.85rem",
            textDecoration: "none",
            marginBottom: "0.75rem",
          }}
        >
          <ArrowLeft size={16} /> Back to {meeting.venue} Overview (Level 2)
        </Link>

        {/* Level 3: Header Card */}
        <div style={{
          background: "rgba(15, 23, 42, 0.92)",
          border: variant === "b" ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: variant === "b" ? "12px" : "8px",
          boxShadow: variant === "b" ? "0 4px 14px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.25)",
          padding: "1rem",
          marginBottom: "1rem",
        }}>
          {/* Quick Race Switcher Bar R1-R9 */}
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.75rem", marginBottom: "0.75rem", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
            {meeting.races.map((r) => (
              <Link
                key={r.race_id}
                href={`/variant-${variant}/racing/${encodeURIComponent(meeting.venue)}/races/${r.race_id}${queryString}`}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  background: r.race_id === race.race_id ? "#06b6d4" : "rgba(255, 255, 255, 0.04)",
                  color: r.race_id === race.race_id ? "#020617" : "#94a3b8",
                  border: r.race_id === race.race_id ? "1px solid #06b6d4" : "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                R{r.race_number}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>
                Level 3: {meeting.venue} Race {race.race_number} — {race.race_name || `${race.distance}m Handicap`}
              </h1>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                {race.distance}m • {race.horses.length} Runners • Track Good 4
              </span>
            </div>
            {variant === "c" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(52, 211, 153, 0.15)", color: "#34d399", padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
                <Sparkles size={14} /> EV Badges Active
              </span>
            )}
          </div>

          {/* Market Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => setActiveMarket("win")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeMarket === "win" ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.04)",
                color: activeMarket === "win" ? "#22d3ee" : "#94a3b8",
              }}
            >
              Win / Place
            </button>
            <button
              type="button"
              onClick={() => setActiveMarket("srm")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeMarket === "srm" ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.04)",
                color: activeMarket === "srm" ? "#22d3ee" : "#94a3b8",
              }}
            >
              Same Race Multi
            </button>
            <button
              type="button"
              onClick={() => setActiveMarket("exotics")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeMarket === "exotics" ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.04)",
                color: activeMarket === "exotics" ? "#22d3ee" : "#94a3b8",
              }}
            >
              Exotics
            </button>
          </div>
        </div>

        {/* Runner Table Component */}
        <VariantRunnerTable race={race} prediction={prediction} variant={variant} />
      </div>
    </VariantNavigationShell>
  );
}

export default function VariantSingleRaceView({ variant, venue, raceId }: VariantSingleRaceViewProps) {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#fff" }}>Loading Race Card...</div>}>
      <SingleRaceViewContent variant={variant} venue={venue} raceId={raceId} />
    </Suspense>
  );
}

export { VariantSingleRaceView };
