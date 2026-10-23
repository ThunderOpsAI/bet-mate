"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import VariantNavigationShell from "./VariantNavigationShell";
import VariantRacingFilters from "./VariantRacingFilters";
import { FALLBACK_MEETINGS } from "../../lib/prototypes/prototypeData";
import { MapPin, ChevronRight, Clock } from "lucide-react";
import "./prototypes.css";

interface VariantRacingViewProps {
  variant: "a" | "b" | "c";
}

function RacingViewContent({ variant }: VariantRacingViewProps) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get("type") || "T";
  const activeRegion = searchParams.get("region") || "all";
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  // Filter meetings
  const filteredMeetings = FALLBACK_MEETINGS.filter((m) => {
    if (activeType && m.code !== activeType) return false;
    if (activeRegion === "aunz") {
      return ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NZ"].includes(m.region);
    }
    if (activeRegion === "intl") {
      return !["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NZ"].includes(m.region);
    }
    return true;
  });

  return (
    <VariantNavigationShell activeVariant={variant}>
      <VariantRacingFilters />

      <div className="prototype-page-container">
        <div className="view-header" style={{ marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>
            Level 1: Venue List View ({variant === "a" ? "Variant A - Sportsbet Density" : variant === "b" ? "Variant B - Elevated 3D Cards" : "Variant C - Command View"})
          </h1>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Select a venue to drill down into meeting schedule (Level 2).
          </p>
        </div>

        {filteredMeetings.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", background: "#0f172a", borderRadius: "8px", color: "#94a3b8" }}>
            No meetings found matching current filters.
          </div>
        ) : (
          <div className="prototype-venue-grid">
            {filteredMeetings.map((meeting) => (
              <div key={meeting.venue} className="prototype-venue-card">
                <div className="venue-card-header">
                  <Link
                    href={`/variant-${variant}/racing/${encodeURIComponent(meeting.venue)}${queryString}`}
                    className="venue-title"
                  >
                    {meeting.venue}
                  </Link>
                  <span className="venue-region">{meeting.region}</span>
                </div>

                <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.75rem" }}>
                  <Clock size={12} />
                  <span>{meeting.races.length} Races Scheduled</span>
                </div>

                <div className="venue-races-row">
                  {meeting.races.map((race) => (
                    <Link
                      key={race.race_id}
                      href={`/variant-${variant}/racing/${encodeURIComponent(meeting.venue)}/races/${race.race_id}${queryString}`}
                      className="race-chip"
                    >
                      R{race.race_number}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </VariantNavigationShell>
  );
}

export default function VariantRacingView({ variant }: VariantRacingViewProps) {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#fff" }}>Loading Racing View...</div>}>
      <RacingViewContent variant={variant} />
    </Suspense>
  );
}
