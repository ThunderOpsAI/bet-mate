"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import VariantNavigationShell from "./VariantNavigationShell";
import VariantRacingFilters from "./VariantRacingFilters";
import { FALLBACK_MEETINGS } from "../../lib/prototypes/prototypeData";
import { ArrowLeft, ChevronRight } from "lucide-react";
import "./prototypes.css";

interface VariantMeetingViewProps {
  variant: "a" | "b" | "c";
  venue: string;
}

function MeetingViewContent({ variant, venue }: VariantMeetingViewProps) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const decodedVenue = decodeURIComponent(venue);

  const meeting = FALLBACK_MEETINGS.find(
    (m) => m.venue.toLowerCase() === decodedVenue.toLowerCase()
  ) || FALLBACK_MEETINGS[0];

  return (
    <VariantNavigationShell activeVariant={variant}>
      <VariantRacingFilters />

      <div className="prototype-page-container">
        {/* Back button to Level 1 */}
        <Link
          href={`/variant-${variant}/racing${queryString}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "#94a3b8",
            fontSize: "0.85rem",
            textDecoration: "none",
            marginBottom: "1rem",
          }}
        >
          <ArrowLeft size={16} /> Back to All Venues (Level 1)
        </Link>

        <div className={`meeting-overview-card variant-${variant}-card`} style={{
          background: "rgba(15, 23, 42, 0.92)",
          border: variant === "b" ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: variant === "b" ? "12px" : "8px",
          boxShadow: variant === "b" ? "0 4px 14px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.25)",
          padding: "1.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>
                Level 2: {meeting.venue} Meeting Overview
              </h1>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Region: {meeting.region} • Track: Good 4
              </span>
            </div>
            <span style={{ background: "rgba(6, 182, 212, 0.15)", color: "#06b6d4", padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600 }}>
              {meeting.races.length} RACES
            </span>
          </div>

          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.75rem" }}>
            SELECT A RACE (R1 – R9+ Schedule):
          </h2>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {meeting.races.map((race) => (
              <div
                key={race.race_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>
                    Race {race.race_number} — {race.race_name || `${race.distance}m Handicap`}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {race.distance}m • {race.horses.length} Runners
                  </div>
                </div>

                <Link
                  href={`/variant-${variant}/racing/${encodeURIComponent(meeting.venue)}/races/${race.race_id}${queryString}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.4rem 0.8rem",
                    background: "#06b6d4",
                    color: "#020617",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textDecoration: "none",
                  }}
                >
                  View Race Card <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </VariantNavigationShell>
  );
}

export default function VariantMeetingView({ variant, venue }: VariantMeetingViewProps) {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#fff" }}>Loading Meeting...</div>}>
      <MeetingViewContent variant={variant} venue={venue} />
    </Suspense>
  );
}

export { VariantMeetingView };
