"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Trophy, Activity } from "lucide-react";

interface SectionHeaderToggleProps {
  activeSection: "racing" | "sport";
}

function SectionHeaderToggleInner({ activeSection }: SectionHeaderToggleProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const typeParam = searchParams?.get("type");
  const whenParam = searchParams?.get("when");
  const params = new URLSearchParams();
  if (typeParam) params.set("type", typeParam);
  if (whenParam) params.set("when", whenParam);
  const queryString = params.toString() ? `?${params.toString()}` : "";

  const racingHref = `/racing${queryString}`;
  const sportHref = activeSection === "sport" ? `${pathname}${queryString}` : `/afl${queryString}`;

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md backdrop-blur-md w-fit mb-3">
      <Link
        href={racingHref}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
          activeSection === "racing"
            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-950/40"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        <Trophy size={15} className={activeSection === "racing" ? "text-white" : "text-slate-400"} />
        <span>Racing</span>
      </Link>
      <div className="w-[1px] h-4 bg-slate-800" />
      <Link
        href={sportHref}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
          activeSection === "sport"
            ? "bg-gradient-to-r from-indigo-500 to-cyan-600 text-white shadow-sm shadow-indigo-950/40"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        <Activity size={15} className={activeSection === "sport" ? "text-white" : "text-slate-400"} />
        <span>Sport</span>
      </Link>
    </div>
  );
}

function SectionHeaderToggleFallback({ activeSection }: SectionHeaderToggleProps) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md backdrop-blur-md w-fit mb-3">
      <Link
        href="/racing"
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
          activeSection === "racing"
            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-950/40"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        <Trophy size={15} className={activeSection === "racing" ? "text-white" : "text-slate-400"} />
        <span>Racing</span>
      </Link>
      <div className="w-[1px] h-4 bg-slate-800" />
      <Link
        href="/afl"
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
          activeSection === "sport"
            ? "bg-gradient-to-r from-indigo-500 to-cyan-600 text-white shadow-sm shadow-indigo-950/40"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        <Activity size={15} className={activeSection === "sport" ? "text-white" : "text-slate-400"} />
        <span>Sport</span>
      </Link>
    </div>
  );
}

export default function SectionHeaderToggle({ activeSection }: SectionHeaderToggleProps) {
  return (
    <Suspense fallback={<SectionHeaderToggleFallback activeSection={activeSection} />}>
      <SectionHeaderToggleInner activeSection={activeSection} />
    </Suspense>
  );
}
