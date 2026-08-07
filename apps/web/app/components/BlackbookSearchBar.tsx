"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  X,
  Plus,
  Check,
  Loader2,
  TrendingUp,
  Sparkles,
  Trophy,
  User,
  Shield,
  Layers,
} from "lucide-react";

export interface SearchResultItem {
  id: string;
  name: string;
  category: "RUNNER" | "JOCKEY" | "TRAINER" | "COMBINATION";
  sport?: string;
  details?: string;
  jockeyName?: string;
  trainerName?: string;
  horseName?: string;
  badge?: string;
  strikeRate?: string;
}

export interface GroupedResults {
  RUNNER: SearchResultItem[];
  JOCKEY: SearchResultItem[];
  TRAINER: SearchResultItem[];
  COMBINATION: SearchResultItem[];
}

interface BlackbookSearchBarProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

const CATEGORIES = [
  { id: "ALL", label: "All Categories" },
  { id: "RUNNER", label: "Runners" },
  { id: "JOCKEY", label: "Jockeys" },
  { id: "TRAINER", label: "Trainers" },
  { id: "COMBINATION", label: "Combinations" },
] as const;

export default function BlackbookSearchBar({
  isOpen = false,
  onClose,
  inline = false,
}: BlackbookSearchBarProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GroupedResults>({
    RUNNER: [],
    JOCKEY: [],
    TRAINER: [],
    COMBINATION: [],
  });
  const [trending, setTrending] = useState<SearchResultItem[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount or modal open
  useEffect(() => {
    if (isOpen || inline) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, inline]);

  // Debounced search logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
        const res = await fetch(
          `${apiUrl}/api/search?q=${encodeURIComponent(query)}&category=${activeCategory}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(
            data.results || { RUNNER: [], JOCKEY: [], TRAINER: [], COMBINATION: [] }
          );
          if (data.trending && data.trending.length > 0) {
            setTrending(data.trending);
          }
        }
      } catch (err) {
        console.error("Failed to execute search:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, activeCategory]);

  // Handle adding item to BlackBook with optimistic state update
  const handleAddToBlackbook = useCallback(async (item: SearchResultItem) => {
    if (addedIds.has(item.id)) return;

    // Optimistic UI state update
    setAddedIds((prev) => new Set(prev).add(item.id));
    setAddingId(item.id);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const response = await fetch(`${apiUrl}/api/blackbook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetType: item.category,
          targetId: item.id,
          targetName: item.name,
          entityType: item.category,
          jockeyName: item.jockeyName || null,
          trainerName: item.trainerName || null,
          horseName: item.horseName || item.name,
          notes: "Added via BlackBook Global Search Bar",
        }),
      });

      if (!response.ok) {
        console.warn("Failed to persist BlackBook addition upstream:", response.statusText);
      } else {
        window.dispatchEvent(new CustomEvent("blackbook-updated", { detail: item }));
      }
    } catch (error) {
      console.error("Error adding item to BlackBook:", error);
    } finally {
      setAddingId(null);
    }
  }, [addedIds]);

  const totalResultsCount =
    results.RUNNER.length +
    results.JOCKEY.length +
    results.TRAINER.length +
    results.COMBINATION.length;

  const content = (
    <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all">
      {/* Search Input Bar Header */}
      <div className="relative flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
        <Search className="w-5 h-5 text-emerald-400 shrink-0 mr-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search runners, jockeys, trainers, or combinations..."
          className="w-full bg-transparent text-white placeholder-slate-500 text-sm md:text-base font-medium focus:outline-none"
        />
        {loading ? (
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0 ml-2" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Category Filter Badges */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-950/30 border-b border-slate-800/60 overflow-x-auto scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Results / Trending Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Empty Query State: Display Trending BlackBook Searches */}
        {!query.trim() && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Trending BlackBook Searches</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {trending.map((item) => {
                const isAdded = addedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        {getItemIcon(item.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.details}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToBlackbook(item)}
                      disabled={isAdded}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                        isAdded
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-200 hover:bg-emerald-600 hover:text-white group-hover:border-emerald-500/40"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added ✓</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ BlackBook</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Query Active & Results Available */}
        {query.trim() && totalResultsCount > 0 && (
          <div className="space-y-6">
            {/* Category: Runners */}
            {results.RUNNER.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Runners ({results.RUNNER.length})</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {results.RUNNER.map((item) =>
                    renderResultRow(item, addedIds, handleAddToBlackbook)
                  )}
                </div>
              </div>
            )}

            {/* Category: Jockeys */}
            {results.JOCKEY.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    <span>Jockeys ({results.JOCKEY.length})</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {results.JOCKEY.map((item) =>
                    renderResultRow(item, addedIds, handleAddToBlackbook)
                  )}
                </div>
              </div>
            )}

            {/* Category: Trainers */}
            {results.TRAINER.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Trainers ({results.TRAINER.length})</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {results.TRAINER.map((item) =>
                    renderResultRow(item, addedIds, handleAddToBlackbook)
                  )}
                </div>
              </div>
            )}

            {/* Category: Combinations */}
            {results.COMBINATION.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Saved Combinations ({results.COMBINATION.length})</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {results.COMBINATION.map((item) =>
                    renderResultRow(item, addedIds, handleAddToBlackbook)
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Query Active & No Results Found */}
        {query.trim() && !loading && totalResultsCount === 0 && (
          <div className="py-12 text-center space-y-2">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              No matching runners or entities found
            </p>
            <p className="text-xs text-slate-500">
              Try searching with a different spelling or select another category filter.
            </p>
          </div>
        )}
      </div>

      {/* Footer info bar */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <span>Click "+ BlackBook" to receive instant alert notifications</span>
        <span className="font-mono text-[10px] text-slate-600">ESC to close</span>
      </div>
    </div>
  );

  if (inline) return content;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative z-10 w-full flex justify-center">{content}</div>
    </div>
  );
}

function getItemIcon(category: string) {
  switch (category) {
    case "JOCKEY":
      return <User className="w-4 h-4" />;
    case "TRAINER":
      return <Shield className="w-4 h-4" />;
    case "COMBINATION":
      return <Layers className="w-4 h-4" />;
    case "RUNNER":
    default:
      return <Trophy className="w-4 h-4" />;
  }
}

function renderResultRow(
  item: SearchResultItem,
  addedIds: Set<string>,
  onAdd: (item: SearchResultItem) => void
) {
  const isAdded = addedIds.has(item.id);

  return (
    <div
      key={item.id}
      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:bg-slate-800/40 transition-all group"
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/50 shrink-0">
          {getItemIcon(item.category)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white truncate">
              {item.name}
            </span>
            {item.sport && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 shrink-0">
                {item.sport}
              </span>
            )}
          </div>
          {item.details && (
            <p className="text-[11px] text-slate-400 truncate">{item.details}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdd(item)}
        disabled={isAdded}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
          isAdded
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-emerald-600/90 text-white hover:bg-emerald-500 shadow-sm"
        }`}
      >
        {isAdded ? (
          <>
            <Check className="w-3.5 h-3.5" />
            <span>Added ✓</span>
          </>
        ) : (
          <>
            <Plus className="w-3.5 h-3.5" />
            <span>+ BlackBook</span>
          </>
        )}
      </button>
    </div>
  );
}
