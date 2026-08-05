"use client";
import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Clock, Trophy, CircleDot, Flag } from "lucide-react";

export default function VariantRacingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeWhen = searchParams.get("when") || "today";
  const activeType = searchParams.get("type") || "T";
  const activeRegion = searchParams.get("region") || "all";

  const updateFilters = (updates: { when?: string; type?: string; region?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.when) params.set("when", updates.when);
    if (updates.type) params.set("type", updates.type);
    if (updates.region) params.set("region", updates.region);

    router.push(`${pathname}?${params.toString()}`);
  };

  const getDayTabs = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const result = [];
    for (let offset = 2; offset <= 4; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      result.push({ id: `day-${offset}`, label: days[d.getDay()] });
    }
    return result;
  };

  return (
    <div className="prototype-filters-container">
      {/* Date Header Filter */}
      <div className="prototype-date-header">
        <button
          type="button"
          className={`date-tab ${activeWhen === "next" ? "active" : ""}`}
          onClick={() => updateFilters({ when: "next" })}
        >
          <Clock size={14} />
          Next to Jump
        </button>
        <button
          type="button"
          className={`date-tab ${activeWhen === "today" ? "active" : ""}`}
          onClick={() => updateFilters({ when: "today" })}
        >
          Today
        </button>
        <button
          type="button"
          className={`date-tab ${activeWhen === "tomorrow" ? "active" : ""}`}
          onClick={() => updateFilters({ when: "tomorrow" })}
        >
          Tomorrow
        </button>
        {getDayTabs().map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`date-tab ${activeWhen === tab.id ? "active" : ""}`}
            onClick={() => updateFilters({ when: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code & Region Sub-Filters */}
      <div className="prototype-sub-filters">
        <div className="filter-group code-group">
          <button
            type="button"
            className={`code-pill ${activeType === "T" ? "active" : ""}`}
            onClick={() => updateFilters({ type: "T" })}
          >
            <Trophy size={14} />
            Horses
          </button>
          <button
            type="button"
            className={`code-pill ${activeType === "G" ? "active" : ""}`}
            onClick={() => updateFilters({ type: "G" })}
          >
            <CircleDot size={14} />
            Greyhounds
          </button>
          <button
            type="button"
            className={`code-pill ${activeType === "H" ? "active" : ""}`}
            onClick={() => updateFilters({ type: "H" })}
          >
            <Flag size={14} />
            Harness
          </button>
        </div>

        <div className="filter-divider" />

        <div className="filter-group region-group">
          <button
            type="button"
            className={`region-pill ${activeRegion === "all" ? "active" : ""}`}
            onClick={() => updateFilters({ region: "all" })}
          >
            All
          </button>
          <button
            type="button"
            className={`region-pill ${activeRegion === "aunz" ? "active" : ""}`}
            onClick={() => updateFilters({ region: "aunz" })}
          >
            Aus/NZ
          </button>
          <button
            type="button"
            className={`region-pill ${activeRegion === "intl" ? "active" : ""}`}
            onClick={() => updateFilters({ region: "intl" })}
          >
            Int'l
          </button>
        </div>
      </div>
    </div>
  );
}

export { VariantRacingFilters };
