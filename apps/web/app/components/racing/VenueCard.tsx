"use client";
import { MapPin, ChevronRight } from "lucide-react";

interface VenueCardProps {
  venue: string;
  raceCount: number;
  nextRaceTime?: string;
  meetingType?: string;
  region?: string;
  onClick: () => void;
}

export default function VenueCard({ venue, raceCount, nextRaceTime, meetingType, onClick }: VenueCardProps) {
  const timeLabel = nextRaceTime
    ? new Date(nextRaceTime).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <button type="button" className="venue-card" onClick={onClick}>
      <div className="venue-card-left">
        <MapPin size={16} className="venue-card-icon" />
        <div>
          <div className="venue-card-name">{venue}</div>
          <div className="venue-card-meta">
            {raceCount} race{raceCount !== 1 ? "s" : ""}
            {meetingType && meetingType !== "unknown" ? (
              <span className="venue-card-type">{meetingType}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="venue-card-right">
        {timeLabel ? (
          <span className="venue-card-time">{timeLabel}</span>
        ) : null}
        <ChevronRight size={18} className="venue-card-chevron" />
      </div>
    </button>
  );
}
