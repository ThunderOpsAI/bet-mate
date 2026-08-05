"use client";
import { Clock } from "lucide-react";

type TemporalTab = "next" | "today" | "tomorrow" | string;

interface TemporalHeaderProps {
  activeTab: TemporalTab;
  onTabChange: (tab: TemporalTab) => void;
}

function getDayTabs(): { id: string; label: string }[] {
  const tabs: { id: string; label: string }[] = [];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  for (let offset = 2; offset <= 4; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    tabs.push({ id: `day-${offset}`, label: days[d.getDay()] });
  }
  return tabs;
}

export default function TemporalHeader({ activeTab, onTabChange }: TemporalHeaderProps) {
  const dayTabs = getDayTabs();

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
      {dayTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`temporal-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
