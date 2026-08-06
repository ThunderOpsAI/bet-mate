"use client";
import { Trophy, CircleDot, Flag } from "lucide-react";

interface RaceCodeFilterProps {
  activeType: string;
  activeRegion: string;
  onTypeChange: (type: string) => void;
  onRegionChange: (region: string) => void;
}

export default function RaceCodeFilter({ activeType, activeRegion, onTypeChange, onRegionChange }: RaceCodeFilterProps) {
  return (
    <div className="race-code-filter">
      <div className="race-code-filter-group">
        <button
          type="button"
          className={`race-code-pill ${activeType === "T" ? "active" : ""}`}
          onClick={() => onTypeChange("T")}
        >
          <Trophy size={14} />
          Thoroughbreds
        </button>
        <button
          type="button"
          className={`race-code-pill ${activeType === "G" ? "active" : ""}`}
          onClick={() => onTypeChange("G")}
        >
          <CircleDot size={14} />
          Greyhounds
        </button>
        <button
          type="button"
          className={`race-code-pill ${activeType === "H" ? "active" : ""}`}
          onClick={() => onTypeChange("H")}
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
