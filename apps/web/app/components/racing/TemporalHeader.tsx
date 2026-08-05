"use client";
import { Clock } from "lucide-react";

type TemporalTab = "next" | "today" | "tomorrow" | "wednesday" | "friday" | "saturday" | string;

interface TemporalHeaderProps {
  activeTab: TemporalTab;
  onTabChange: (tab: TemporalTab) => void;
}

export default function TemporalHeader({ activeTab, onTabChange }: TemporalHeaderProps) {
  return (
    <div className="temporal-header">
      <button
        type="button"
        className={`temporal-tab ${activeTab === "next" ? "active" : ""}`}
        onClick={() => onTabChange("next")}
      >
        <Clock size={14} />
        Next to Jump
      </button>
      <button
        type="button"
        className={`temporal-tab ${activeTab === "today" ? "active" : ""}`}
        onClick={() => onTabChange("today")}
      >
        Today
      </button>
      <button
        type="button"
        className={`temporal-tab ${activeTab === "tomorrow" ? "active" : ""}`}
        onClick={() => onTabChange("tomorrow")}
      >
        Tomorrow
      </button>
      <button
        type="button"
        className={`temporal-tab ${activeTab === "wednesday" ? "active" : ""}`}
        onClick={() => onTabChange("wednesday")}
      >
        Wednesday
      </button>
      <button
        type="button"
        className={`temporal-tab ${activeTab === "friday" ? "active" : ""}`}
        onClick={() => onTabChange("friday")}
      >
        Friday
      </button>
      <button
        type="button"
        className={`temporal-tab ${activeTab === "saturday" ? "active" : ""}`}
        onClick={() => onTabChange("saturday")}
      >
        Saturday
      </button>
    </div>
  );
}
