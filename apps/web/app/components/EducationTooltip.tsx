"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

type EducationTooltipProps = {
  label: string;
  children: ReactNode;
};

export default function EducationTooltip({
  label,
  children,
}: EducationTooltipProps) {
  return (
    <span className="education-tooltip">
      <button
        type="button"
        className="education-tooltip-trigger"
        aria-label={`Learn more about ${label}`}
      >
        <span>{label}</span>
        <Info size={14} />
      </button>
      <span className="education-tooltip-content" role="tooltip">
        {children}
      </span>
    </span>
  );
}
