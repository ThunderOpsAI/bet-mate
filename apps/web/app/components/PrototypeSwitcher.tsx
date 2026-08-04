"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";

export type VariantKey = "A" | "B" | "C";

export interface VariantOption {
  key: VariantKey;
  name: string;
  description: string;
}

export const VARIANTS: VariantOption[] = [
  {
    key: "A",
    name: "Variant A — Cyberpunk High-Density Terminal",
    description: "Grid view with EV signals & quick bet action",
  },
  {
    key: "B",
    name: "Variant B — Dual-Column Split Workspace",
    description: "Persistent left sidebar + right canvas view",
  },
  {
    key: "C",
    name: "Variant C — Chronological Timeline Stream",
    description: "Sequential fixture timeline stream",
  },
];

export default function PrototypeSwitcher({
  currentVariant,
  onVariantChange,
}: {
  currentVariant?: VariantKey;
  onVariantChange?: (variant: VariantKey) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const queryVariant = (searchParams?.get("variant")?.toUpperCase() as VariantKey) || "A";
  const activeVariant = currentVariant || (["A", "B", "C"].includes(queryVariant) ? queryVariant : "A");

  const [activeKey, setActiveKey] = useState<VariantKey>(activeVariant);

  useEffect(() => {
    setActiveKey(activeVariant);
  }, [activeVariant]);

  const setVariant = (key: VariantKey) => {
    setActiveKey(key);
    if (onVariantChange) onVariantChange(key);
    
    // Update URL query param using Next.js router
    try {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("variant", key);
      router.replace(`?${params.toString()}`, { scroll: false });
    } catch (e) {
      console.warn("Failed to update router params:", e);
    }
  };

  const handlePrev = () => {
    const currentIndex = VARIANTS.findIndex((v) => v.key === activeKey);
    const prevIndex = (currentIndex - 1 + VARIANTS.length) % VARIANTS.length;
    setVariant(VARIANTS[prevIndex].key);
  };

  const handleNext = () => {
    const currentIndex = VARIANTS.findIndex((v) => v.key === activeKey);
    const nextIndex = (currentIndex + 1) % VARIANTS.length;
    setVariant(VARIANTS[nextIndex].key);
  };

  // Keyboard navigation for Left and Right Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true");

      if (isInput) return;

      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeKey]);

  const currentOption = VARIANTS.find((v) => v.key === activeKey) || VARIANTS[0];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-2.5 bg-slate-950/90 backdrop-blur-xl border border-emerald-500/40 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(16,185,129,0.25)] text-white font-sans transition-all">
      <button
        type="button"
        onClick={handlePrev}
        className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md active:scale-95"
        title="Previous Variant (Left Arrow)"
        aria-label="Previous Variant"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex flex-col items-center text-center px-1">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
          <Layers size={12} className="text-emerald-400" />
          <span>PROTOTYPE SWITCHER</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {VARIANTS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariant(v.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                activeKey === v.key
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] font-bold"
                  : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
              }`}
            >
              Variant {v.key}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md active:scale-95"
        title="Next Variant (Right Arrow)"
        aria-label="Next Variant"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
