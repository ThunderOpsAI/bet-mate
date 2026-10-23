"use client";
import { ArrowLeft, Clock, Layers } from "lucide-react";

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
  onOpenQuaddie?: () => void;
}

export default function MeetingOverview({ venue, races, onBack, onSelectRace, selectedRaceId, onOpenQuaddie }: MeetingOverviewProps) {
  const sorted = [...races].sort((a, b) => a.race_number - b.race_number);

  return (
    <div className="meeting-overview">
      <div className="meeting-overview-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" className="meeting-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <h3 className="meeting-overview-title">{venue}</h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="meeting-overview-count">{sorted.length} races</span>
          {onOpenQuaddie && sorted.length >= 4 && (
            <button
              type="button"
              onClick={onOpenQuaddie}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-500/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Layers size={13} className="text-purple-400" />
              <span>Quaddie Planner</span>
            </button>
          )}
        </div>
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
