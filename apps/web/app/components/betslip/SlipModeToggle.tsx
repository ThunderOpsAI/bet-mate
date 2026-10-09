"use client";

import React from "react";
import { motion } from "framer-motion";
import { Layers, Zap, Grid3X3, Split, Ticket, type LucideIcon } from "lucide-react";

export type SlipMode = "singles" | "multi" | "sgm" | "round_robin" | "exotics";

export interface SlipModeToggleProps {
  activeMode: SlipMode;
  onModeChange: (mode: SlipMode) => void;
  counts?: {
    singles?: number;
    multi?: number;
    sgm?: number;
    round_robin?: number;
    exotics?: number;
  };
  className?: string;
}

export default function SlipModeToggle({
  activeMode,
  onModeChange,
  counts = {},
  className = "",
}: SlipModeToggleProps) {
  const tabs: Array<{
    id: SlipMode;
    label: string;
    icon: LucideIcon;
    count?: number;
  }> = [
    {
      id: "singles",
      label: "Singles",
      icon: Ticket,
      count: counts.singles,
    },
    {
      id: "multi",
      label: "Multi",
      icon: Layers,
      count: counts.multi,
    },
    {
      id: "sgm",
      label: "SGM",
      icon: Zap,
      count: counts.sgm,
    },
    {
      id: "round_robin",
      label: "Round-Robin",
      icon: Grid3X3,
      count: counts.round_robin,
    },
  ];

  return (
    <div
      className={`grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeMode === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onModeChange(tab.id)}
            className={`relative py-2 px-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
              isActive
                ? "text-emerald-300 font-extrabold shadow-sm bg-slate-800 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center gap-1">
              <Icon
                size={13}
                className={isActive ? "text-emerald-400" : "text-slate-500"}
              />
              <span className="text-[11px] uppercase tracking-tight">
                {tab.label}
              </span>
            </div>

            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`mt-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
