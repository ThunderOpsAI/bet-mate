"use client";
import { useMemo } from "react";
import { Clock } from "lucide-react";

type TemporalTab = string;

interface TemporalHeaderProps {
  activeTab: TemporalTab;
  onTabChange: (tab: TemporalTab) => void;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DISPLAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TemporalHeader({ activeTab, onTabChange }: TemporalHeaderProps) {
  const dynamicTabs = useMemo(() => {
    const todayObj = new Date();
    const tabs: Array<{ id: string; label: string; icon?: boolean }> = [
      { id: "next", label: "Next to Jump", icon: true },
      { id: "today", label: "Today" },
      { id: "tomorrow", label: "Tomorrow" },
    ];

    for (let offset = 2; offset <= 6; offset++) {
      const targetDate = new Date(todayObj);
      targetDate.setDate(todayObj.getDate() + offset);
      const dayIndex = targetDate.getDay();
      tabs.push({
        id: DAY_NAMES[dayIndex],
        label: DISPLAY_NAMES[dayIndex],
      });
    }

    return tabs;
  }, []);

  return (
    <div className="temporal-header">
      {dynamicTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`temporal-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <Clock size={14} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

