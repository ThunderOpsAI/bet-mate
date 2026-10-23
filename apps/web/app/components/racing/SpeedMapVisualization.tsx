"use client";

import { useState } from "react";
import { Zap, Compass, Info, User, ShieldAlert, ChevronRight, Layers } from "lucide-react";

export type SettlingPosition = "leader" | "on_pace" | "midfield" | "backmarker";

export interface SpeedMapHorse {
  horse_id: string;
  name: string;
  barrier: number;
  jockey_name?: string | null;
  trainer_name?: string | null;
  settling_position?: SettlingPosition;
  wide_position?: 1 | 2 | 3; // 1 = Rail, 2 = 2-Wide, 3 = 3-Wide+
  early_speed_score?: number; // 0 to 100
  silk_color?: string;
}

export interface SpeedMapRaceData {
  race_id: string;
  venue: string;
  race_number: number;
  distance: number;
  horses: SpeedMapHorse[];
  predicted_pace?: "Fast" | "Moderate" | "Slow" | "Extreme";
  rail_position?: string;
}

interface SpeedMapVisualizationProps {
  race: SpeedMapRaceData;
}

// Deterministic helper to assign realistic default settling positions if not pre-populated
function getRunnerSettlingPosition(horse: SpeedMapHorse, totalHorses: number): SettlingPosition {
  if (horse.settling_position) return horse.settling_position;
  // Fallback calculation based on barrier or index to populate speed map evenly
  const b = horse.barrier || 1;
  if (b <= 3) return "leader";
  if (b <= Math.ceil(totalHorses * 0.4)) return "on_pace";
  if (b <= Math.ceil(totalHorses * 0.75)) return "midfield";
  return "backmarker";
}

function getRunnerWidePosition(horse: SpeedMapHorse): 1 | 2 | 3 {
  if (horse.wide_position) return horse.wide_position;
  const b = horse.barrier || 1;
  if (b % 3 === 1) return 1;
  if (b % 3 === 2) return 2;
  return 3;
}

// Silk badge background colors based on barrier number
const silkGradients = [
  "from-amber-500 to-red-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-700",
  "from-purple-500 to-pink-600",
  "from-cyan-500 to-blue-700",
  "from-rose-500 to-orange-600",
  "from-yellow-400 to-amber-600",
  "from-[#2B0E76] to-[#0A051D]",
  "from-teal-400 to-emerald-600",
  "from-fuchsia-500 to-purple-800",
];

export default function SpeedMapVisualization({ race }: SpeedMapVisualizationProps) {
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [hoveredHorseId, setHoveredHorseId] = useState<string | null>(null);

  if (!race || !race.horses || race.horses.length === 0) {
    return (
      <div className="speed-map-empty bg-slate-900/80 border border-slate-800 rounded-xl p-6 text-center text-slate-400 my-4">
        <Compass className="w-10 h-10 mx-auto text-purple-400/60 mb-2 animate-pulse" />
        <h4 className="font-semibold text-slate-200 text-sm">Speed Map Unavailable</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
          Tactical speed map data and settling positions will populate as final scratchings and early speed ratings are confirmed for {race?.venue || "this race"}.
        </p>
      </div>
    );
  }

  const horsesWithPositions = race.horses.map((h) => ({
    ...h,
    position: getRunnerSettlingPosition(h, race.horses.length),
    lane: getRunnerWidePosition(h),
  }));

  const leaders = horsesWithPositions.filter((h) => h.position === "leader");
  const onPace = horsesWithPositions.filter((h) => h.position === "on_pace");
  const midfield = horsesWithPositions.filter((h) => h.position === "midfield");
  const backmarkers = horsesWithPositions.filter((h) => h.position === "backmarker");

  // Determine overall predicted pace label
  const predictedPace =
    race.predicted_pace ||
    (leaders.length >= 3 ? "Fast" : leaders.length === 1 ? "Slow" : "Moderate");

  const selectedHorse = horsesWithPositions.find(
    (h) => h.horse_id === selectedHorseId || h.horse_id === hoveredHorseId
  );

  return (
    <div className="speed-map-container bg-slate-900/90 border border-purple-500/20 rounded-xl p-4 md:p-5 my-4 shadow-xl space-y-4">
      {/* Top Banner: Race Info & Predicted Pace */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Tactical Speed Map — Approaching 1st Turn
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {race.venue} R{race.race_number} ({race.distance}m) • {race.horses.length} Runners
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <Zap className="w-4 h-4 text-amber-400" />
          <div className="text-xs">
            <span className="text-slate-400">Predicted Pace: </span>
            <strong className="text-amber-400 font-bold uppercase">{predictedPace}</strong>
          </div>
        </div>
      </div>

      {/* Track Map Legend & Rail Indicator */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-slate-300 font-medium">Leaders (Front)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-300 font-medium">On-Pace</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-slate-300 font-medium">Midfield</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span className="text-slate-300 font-medium">Backmarkers</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1">
          <Layers size={13} className="text-slate-400" />
          <span>Rail: True (Inside Rail at top)</span>
        </div>
      </div>

      {/* 2D Speed Map Grid Layout (Direction: Right to Left approaching turn) */}
      <div className="speed-map-grid bg-slate-950/90 border border-slate-800 rounded-xl p-4 relative overflow-x-auto min-w-[600px]">
        {/* Rail Line Visual at top */}
        <div className="absolute top-2 left-4 right-4 h-1 bg-emerald-500/40 rounded flex items-center justify-between px-2">
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/30">
            Inside Rail
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Approaching Turn 1 ➔
          </span>
        </div>

        {/* 4 Settling Columns */}
        <div className="grid grid-cols-4 gap-3 pt-7 pb-2 min-h-[220px]">
          {/* Column 1: Leaders */}
          <div className="settling-column bg-slate-900/60 border border-red-500/20 rounded-lg p-2.5 flex flex-col justify-between">
            <div className="column-header text-center border-b border-red-500/30 pb-1.5 mb-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center justify-center gap-1">
                ⚡ Leaders ({leaders.length})
              </span>
            </div>
            <div className="flex flex-col gap-2 flex-1 justify-around">
              {leaders.length === 0 ? (
                <span className="text-[11px] text-slate-500 text-center italic my-auto">No Lead Runners</span>
              ) : (
                leaders.map((h, i) => (
                  <RunnerNode
                    key={h.horse_id}
                    horse={h}
                    colorClass="border-red-500 text-red-300 hover:bg-red-950/40"
                    silkGradient={silkGradients[h.barrier % silkGradients.length]}
                    isSelected={selectedHorseId === h.horse_id}
                    onSelect={() => setSelectedHorseId(h.horse_id === selectedHorseId ? null : h.horse_id)}
                    onHover={(hovered) => setHoveredHorseId(hovered ? h.horse_id : null)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: On-Pace */}
          <div className="settling-column bg-slate-900/60 border border-amber-500/20 rounded-lg p-2.5 flex flex-col justify-between">
            <div className="column-header text-center border-b border-amber-500/30 pb-1.5 mb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1">
                🏃 On-Pace ({onPace.length})
              </span>
            </div>
            <div className="flex flex-col gap-2 flex-1 justify-around">
              {onPace.length === 0 ? (
                <span className="text-[11px] text-slate-500 text-center italic my-auto">No On-Pace</span>
              ) : (
                onPace.map((h, i) => (
                  <RunnerNode
                    key={h.horse_id}
                    horse={h}
                    colorClass="border-amber-500 text-amber-300 hover:bg-amber-950/40"
                    silkGradient={silkGradients[h.barrier % silkGradients.length]}
                    isSelected={selectedHorseId === h.horse_id}
                    onSelect={() => setSelectedHorseId(h.horse_id === selectedHorseId ? null : h.horse_id)}
                    onHover={(hovered) => setHoveredHorseId(hovered ? h.horse_id : null)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Midfield */}
          <div className="settling-column bg-slate-900/60 border border-blue-500/20 rounded-lg p-2.5 flex flex-col justify-between">
            <div className="column-header text-center border-b border-blue-500/30 pb-1.5 mb-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center justify-center gap-1">
                🎯 Midfield ({midfield.length})
              </span>
            </div>
            <div className="flex flex-col gap-2 flex-1 justify-around">
              {midfield.length === 0 ? (
                <span className="text-[11px] text-slate-500 text-center italic my-auto">No Midfield</span>
              ) : (
                midfield.map((h, i) => (
                  <RunnerNode
                    key={h.horse_id}
                    horse={h}
                    colorClass="border-blue-500 text-blue-300 hover:bg-blue-950/40"
                    silkGradient={silkGradients[h.barrier % silkGradients.length]}
                    isSelected={selectedHorseId === h.horse_id}
                    onSelect={() => setSelectedHorseId(h.horse_id === selectedHorseId ? null : h.horse_id)}
                    onHover={(hovered) => setHoveredHorseId(hovered ? h.horse_id : null)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 4: Backmarkers */}
          <div className="settling-column bg-slate-900/60 border border-purple-500/20 rounded-lg p-2.5 flex flex-col justify-between">
            <div className="column-header text-center border-b border-purple-500/30 pb-1.5 mb-2">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center justify-center gap-1">
                ⏳ Backmarkers ({backmarkers.length})
              </span>
            </div>
            <div className="flex flex-col gap-2 flex-1 justify-around">
              {backmarkers.length === 0 ? (
                <span className="text-[11px] text-slate-500 text-center italic my-auto">No Backmarkers</span>
              ) : (
                backmarkers.map((h, i) => (
                  <RunnerNode
                    key={h.horse_id}
                    horse={h}
                    colorClass="border-purple-500 text-purple-300 hover:bg-purple-950/40"
                    silkGradient={silkGradients[h.barrier % silkGradients.length]}
                    isSelected={selectedHorseId === h.horse_id}
                    onSelect={() => setSelectedHorseId(h.horse_id === selectedHorseId ? null : h.horse_id)}
                    onHover={(hovered) => setHoveredHorseId(hovered ? h.horse_id : null)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Selected/Hovered Runner Preview Card */}
      {selectedHorse ? (
        <div className="bg-slate-950 border border-purple-500/40 rounded-lg p-3 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${silkGradients[selectedHorse.barrier % silkGradients.length]} flex items-center justify-center font-bold text-white text-xs border border-white/20 shadow-md`}>
              B{selectedHorse.barrier}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-100">{selectedHorse.name}</h4>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/30">
                  {selectedHorse.position.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedHorse.jockey_name ? `Jockey: ${selectedHorse.jockey_name}` : "Jockey: TBA"} • Lane:{" "}
                {selectedHorse.lane === 1 ? "Rail" : `${selectedHorse.lane}-Wide`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedHorseId(null);
              setHoveredHorseId(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 bg-slate-800 rounded"
          >
            Close
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center italic">
          Click or hover on any runner node above to view jockey, lane positioning, and tactical speed insights.
        </p>
      )}
    </div>
  );
}

// Sub-component for individual runner nodes in the grid
function RunnerNode({
  horse,
  colorClass,
  silkGradient,
  isSelected,
  onSelect,
  onHover,
}: {
  horse: SpeedMapHorse;
  colorClass: string;
  silkGradient: string;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`runner-node flex items-center gap-2 p-1.5 rounded-lg border transition-all text-left w-full bg-slate-950/80 ${colorClass} ${
        isSelected ? "ring-2 ring-purple-400 bg-purple-950/50" : ""
      }`}
    >
      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${silkGradient} flex items-center justify-center font-bold text-white text-[10px] shrink-0 border border-white/20 shadow-xs`}>
        {horse.barrier}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-xs text-slate-100 truncate">{horse.name}</div>
        <div className="text-[10px] text-slate-400 truncate">
          {horse.jockey_name ? horse.jockey_name.split(" ").pop() : `B${horse.barrier}`}
        </div>
      </div>
    </button>
  );
}
