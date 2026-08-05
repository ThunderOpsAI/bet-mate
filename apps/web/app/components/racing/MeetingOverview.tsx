"use client";
import { ArrowLeft, Clock } from "lucide-react";

interface RaceInfo {
  race_id: string;
  race_number: number;
  distance: number;
  start_time?: string;
  horses: { horse_id: string }[];
}

interface MeetingOverviewProps {
  venue: string;
  races: RaceInfo[];
  onBack: () => void;
  onSelectRace: (raceId: string) => void;
  selectedRaceId?: string | null;
}

export default function MeetingOverview({ venue, races, onBack, onSelectRace, selectedRaceId }: MeetingOverviewProps) {
  const sorted = [...races].sort((a, b) => a.race_number - b.race_number);

  return (
    <div className="meeting-overview">
      <div className="meeting-overview-header">
        <button type="button" className="meeting-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h3 className="meeting-overview-title">{venue}</h3>
        <span className="meeting-overview-count">{sorted.length} races</span>
      </div>
      <div className="meeting-race-chips">
        {sorted.map((race) => {
          const timeLabel = race.start_time
            ? new Date(race.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
            : null;
          return (
            <button
              key={race.race_id}
              type="button"
              className={`meeting-race-chip ${selectedRaceId === race.race_id ? "active" : ""}`}
              onClick={() => onSelectRace(race.race_id)}
            >
              <div className="meeting-chip-number">R{race.race_number}</div>
              <div className="meeting-chip-meta">
                <span>{race.distance}m</span>
                {timeLabel ? (
                  <span className="meeting-chip-time">
                    <Clock size={10} />
                    {timeLabel}
                  </span>
                ) : null}
              </div>
              <div className="meeting-chip-runners">{race.horses.length} runners</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
