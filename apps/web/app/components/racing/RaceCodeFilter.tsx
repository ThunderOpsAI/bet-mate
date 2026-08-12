"use client";
import { Trophy, CircleDot, Flag } from "lucide-react";

interface RaceCodeFilterProps {
  activeTypes: string[];
  activeRegion: string;
  onTypesChange: (types: string[]) => void;
  onRegionChange: (region: string) => void;
}

export default function RaceCodeFilter({ activeTypes, activeRegion, onTypesChange, onRegionChange }: RaceCodeFilterProps) {
  const toggle = (code: string) => {
    const next = activeTypes.includes(code)
      ? activeTypes.filter((t) => t !== code)
      : [...activeTypes, code];
    // Prevent deselecting all — keep at least one active
    if (next.length === 0) return;
    onTypesChange(next);
  };

  return (
    <div className="race-code-filter">
      <div className="race-code-filter-group">
        <button
          type="button"
          className={`race-code-pill ${activeTypes.includes("T") ? "active" : ""}`}
          onClick={() => toggle("T")}
        >
          <Trophy size={14} />
          Thoroughbreds
        </button>
        <button
          type="button"
          className={`race-code-pill ${activeTypes.includes("G") ? "active" : ""}`}
          onClick={() => toggle("G")}
        >
          <CircleDot size={14} />
          Greyhounds
        </button>
        <button
          type="button"
          className={`race-code-pill ${activeTypes.includes("H") ? "active" : ""}`}
          onClick={() => toggle("H")}
        >
          <Flag size={14} />
          Harness
        </button>
      </div>
      <div className="race-code-filter-divider" />
      <div className="race-code-filter-group">
        <button
          type="button"
          className={`race-code-pill region ${activeRegion === "all" ? "active" : ""}`}
          onClick={() => onRegionChange("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`race-code-pill region ${activeRegion === "aunz" ? "active" : ""}`}
          onClick={() => onRegionChange("aunz")}
        >
          Aus/NZ
        </button>
        <button
          type="button"
          className={`race-code-pill region ${activeRegion === "intl" ? "active" : ""}`}
          onClick={() => onRegionChange("intl")}
        >
          Int'l
        </button>
      </div>
    </div>
  );
}
