"use client";

import { useState } from "react";
import { Activity, Gauge, TrendingUp, HelpCircle, ChevronRight } from "lucide-react";

export interface SectionalRun {
  run_number: number;
  date?: string;
  venue?: string;
  distance?: number;
  track_condition?: string;
  finish_position?: number;
  field_size?: number;
  last_600m_seconds: number;
  last_600m_diff_bm: number; // positive = faster than benchmark (e.g. +0.45)
  last_400m_seconds: number;
  last_400m_diff_bm: number; // positive = faster than benchmark (e.g. +0.30)
}

export interface SectionalData {
  runner_id: string;
  runner_name: string;
  benchmark_600m_seconds: number;
  benchmark_400m_seconds: number;
  runs: SectionalRun[];
  pace_style?: "front_runner" | "off_pace" | "midfield" | "closer";
}

interface HorseWithSectionals {
  horse_id?: string;
  name?: string;
  sectional_data?: SectionalData;
  // Fallback optional properties if backend directly attaches past splits
  last_600m_diff?: number;
  last_400m_diff?: number;
  past_runs_sectionals?: SectionalRun[];
}

interface SectionalMetricsDrawerProps {
  horse?: HorseWithSectionals;
  sectionalData?: SectionalData;
}

export default function SectionalMetricsDrawer({
  horse,
  sectionalData: directSectionalData,
}: SectionalMetricsDrawerProps) {
  const [selectedMetric, setSelectedMetric] = useState<"600m" | "400m">("600m");

  // Resolve sectional data safely from props or horse object
  const data: SectionalData | undefined =
    directSectionalData ||
    horse?.sectional_data ||
    (horse?.past_runs_sectionals
      ? {
          runner_id: horse.horse_id || "unknown",
          runner_name: horse.name || "Runner",
          benchmark_600m_seconds: 34.5,
          benchmark_400m_seconds: 23.0,
          runs: horse.past_runs_sectionals,
        }
      : undefined);

  const runnerName = horse?.name || data?.runner_name || "Runner";

  // Clean empty state if no sectional metrics are available for this runner
  if (!data || !data.runs || data.runs.length === 0) {
    return (
      <div className="sectional-drawer bg-slate-950/80 border border-slate-800/80 rounded-b-lg p-4 my-1 text-slate-400">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Activity size={15} className="text-purple-400/70 shrink-0" />
            <span className="font-semibold text-slate-300">Sectional Metrics — {runnerName}</span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-slate-900 border border-slate-800 text-slate-400">
            Awaiting Feed
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Detailed 600m & 400m sectional timing splits relative to track benchmark averages are currently pending official timing data for this runner.
        </p>
      </div>
    );
  }

  const recentRuns = data.runs.slice(0, 3);
  const bm600 = data.benchmark_600m_seconds || 34.5;
  const bm400 = data.benchmark_400m_seconds || 23.0;

  // Helper to compute max diff for bar scaling (max 1.5s scale range)
  const maxDiffAbs = Math.max(
    1.0,
    ...recentRuns.map((r) =>
      Math.abs(selectedMetric === "600m" ? r.last_600m_diff_bm : r.last_400m_diff_bm)
    )
  );

  return (
    <div className="sectional-drawer bg-slate-950/90 border border-purple-500/20 rounded-b-lg p-3.5 my-1 text-slate-200 animate-fadeIn space-y-3">
      {/* Header & Metric Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-purple-400 shrink-0" />
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
            Last 3 Runs Sectionals ({runnerName})
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedMetric("600m")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              selectedMetric === "600m"
                ? "bg-purple-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Last 600m
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric("400m")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              selectedMetric === "400m"
                ? "bg-purple-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Last 400m
          </button>
        </div>
      </div>

      {/* Benchmark Legend & Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-300 font-medium">Faster than Benchmark</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-slate-300 font-medium">Slower than Benchmark</span>
          </span>
        </div>
        <span className="text-slate-400">
          Benchmark Avg: <strong className="text-slate-200">{selectedMetric === "600m" ? `${bm600}s` : `${bm400}s`}</strong>
        </span>
      </div>

      {/* Mini-Bar Charts per Run */}
      <div className="space-y-2.5">
        {recentRuns.map((run, idx) => {
          const diff = selectedMetric === "600m" ? run.last_600m_diff_bm : run.last_400m_diff_bm;
          const splitSec = selectedMetric === "600m" ? run.last_600m_seconds : run.last_400m_seconds;
          const isFaster = diff >= 0;
          const barWidthPercent = Math.min(100, Math.max(10, (Math.abs(diff) / maxDiffAbs) * 100));

          return (
            <div
              key={idx}
              className="run-sectional-item bg-slate-900/80 border border-slate-800/80 rounded-md p-2.5 flex flex-col gap-2"
            >
              {/* Top row: Run info */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-purple-300 shrink-0">Run #{idx + 1}</span>
                  {run.venue && (
                    <span className="text-slate-300 font-medium truncate">
                      {run.venue} {run.distance ? `${run.distance}m` : ""}
                    </span>
                  )}
                  {run.track_condition && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {run.track_condition}
                    </span>
                  )}
                  {run.finish_position && (
                    <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      {run.finish_position}
                      {run.field_size ? `/${run.field_size}` : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-slate-200 font-semibold">{splitSec.toFixed(2)}s</span>
                  <span
                    className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      isFaster
                        ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {isFaster ? `+${diff.toFixed(2)}s` : `${diff.toFixed(2)}s`}
                  </span>
                </div>
              </div>

              {/* Bar visualization comparing to 0.0s Benchmark baseline */}
              <div className="relative w-full h-4 bg-slate-950 rounded overflow-hidden flex items-center border border-slate-800">
                {/* Benchmark Center Line (0.0s) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-10" />

                {/* Left/Right Bar relative to center line */}
                {isFaster ? (
                  /* Faster extends Right from center line */
                  <div
                    className="absolute left-1/2 top-1 bottom-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-r"
                    style={{ width: `${(barWidthPercent / 2).toFixed(1)}%` }}
                  />
                ) : (
                  /* Slower extends Left from center line */
                  <div
                    className="absolute right-1/2 top-1 bottom-1 bg-gradient-to-l from-amber-600 to-amber-500 rounded-l"
                    style={{ width: `${(barWidthPercent / 2).toFixed(1)}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Summary Pill */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800/60">
        <div className="flex items-center gap-1.5 text-slate-300">
          <TrendingUp size={13} className="text-purple-400" />
          <span>
            Pace Profile:{" "}
            <strong className="text-purple-300">
              {data.pace_style
                ? data.pace_style.replace("_", " ").toUpperCase()
                : recentRuns.some((r) => r.last_600m_diff_bm > 0.3)
                ? "SUSTAINED CLOSER"
                : "BALANCED RUNNER"}
            </strong>
          </span>
        </div>
        <span className="text-slate-400">Track benchmark normalized</span>
      </div>
    </div>
  );
}
