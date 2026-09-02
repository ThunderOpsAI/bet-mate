"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  Flame,
  MapPin,
  Clock,
  PencilLine,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { type SearchResult } from "../components/BlackbookSearchModal";
import BlackbookSearchBar from "../components/BlackbookSearchBar";
import { BlackbookRuleBuilderSheet } from "../components/BlackbookRuleBuilderSheet";
import { ML_API } from "../lib/mlApi";
import { API_BASE, safeResponseJson } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";
import { useSearchParams } from "next/navigation";
import ErrorBoundary from "../components/ErrorBoundary";
import ErrorState from "../components/ErrorState";
import { TrackPicker } from "../components/TrackPicker";
import { ANALYTICS_EVENTS, trackEvent } from "../lib/analytics";

type BlackbookConfig = {
  runner: string;
  sport: string;
  bet_type: string;
  stake: number;
  enabled: boolean;
  probability_threshold: number;
  notify_phone: string | null;
  notify_email: string | null;
  notify_pushover_key: string | null;
  notes?: string;
  rating?: number;
  entityType?: string;
  conditions?: any;
};

type DraftRule = {
  runner: string;
  sport: "racing" | "afl" | "nba" | "nrl" | "soccer" | "golf" | "mma";
  bet_type: string;
  stake: number;
  probability_threshold: number;
  notify_phone: string;
  notify_email: string;
  notify_pushover_key: string;
};

type ScheduledRaceEntry = {
  raceId: string;
  venue: string;
  raceNumber: number;
  horseName: string;
  jockeyName?: string;
  trainerName?: string;
  barrier?: number;
  startTime: string;
  betfairOdds?: number;
  isValue?: boolean;
  winProbability?: number;
};

type CombinationRecord = {
  id: string;
  userId: string;
  targetName: string;
  combinationType: string;
  entityType: string;
  jockeyName: string | null;
  trainerName: string | null;
  horseName: string | null;
  trackName: string | null;
  notes: string | null;
  alertPreferences: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    enabled?: boolean;
    [key: string]: any;
  };
  metroStrikeRate: number;
  roi12Month: number;
  upcomingRaces: ScheduledRaceEntry[];
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_RULE: DraftRule = {
  runner: "",
  sport: "racing",
  bet_type: "win",
  stake: 20,
  probability_threshold: 50,
  notify_phone: "",
  notify_email: "",
  notify_pushover_key: "",
};

function BlackbookPageContent() {
  const searchParams = useSearchParams();
  
  const { isLoading, token, user } = useAuth();

  // Tab state: "explore" | "list"
  
  // Sprint 1 UI Filters
  const [raceTypeFilter, setRaceTypeFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  // Search & Builder
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchEntity, setSearchEntity] = useState<SearchResult | null>(null);
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [isExistingSelectorOpen, setIsExistingSelectorOpen] = useState(false);

  const [editingRunnerNotesId, setEditingRunnerNotesId] = useState<string | null>(null);
  const [draftRunnerNotes, setDraftRunnerNotes] = useState("");


  // Watch rules (Runners)
  const [configs, setConfigs] = useState<BlackbookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState<DraftRule>(DEFAULT_RULE);

  // Combinations
  const [combinations, setCombinations] = useState<CombinationRecord[]>([]);
  const [combosLoading, setCombosLoading] = useState(false);
  const [combosError, setCombosError] = useState<string | null>(null);
  const [showComboBuilder, setShowComboBuilder] = useState(false);
  const [savingCombo, setSavingCombo] = useState(false);
  const [editingComboNotesId, setEditingComboNotesId] = useState<string | null>(null);
  const [draftComboNotes, setDraftComboNotes] = useState<string>("");

  const [comboDraft, setComboDraft] = useState({
    combinationType: "JOCKEY_TRAINER",
    targetName: "",
    jockeyName: "",
    trainerName: "",
    horseName: "",
    trackName: "",
    notes: "",
    emailAlerts: true,
    smsAlerts: false,
    pushAlerts: true,
  });

  // Daily Runners
  const [dailyRunners, setDailyRunners] = useState<any[]>([]);
  const [dailyRunnersLoading, setDailyRunnersLoading] = useState(false);

  // Categorized Runners
  const [categorizedRunners, setCategorizedRunners] = useState<Record<string, any[]>>({});
  const [categorizedLoading, setCategorizedLoading] = useState(false);

  const fetchCategorizedRunners = async () => {
    setCategorizedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/blackbook/runners/categorized`);
      if (res.ok) {
        const data = await safeResponseJson(res);
        if (data && data.success) {
          setCategorizedRunners(data.data || {});
        }
      }
    } catch (err) {
      console.error("Failed to fetch categorized runners", err);
    } finally {
      setCategorizedLoading(false);
    }
  };

  const fetchDailyRunners = async () => {
    setDailyRunnersLoading(true);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/blackbook/search?q=`, { headers });
      if (res.ok) {
        const data = await safeResponseJson(res);
        setDailyRunners(Array.isArray(data) ? data : data?.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch daily runners", err);
    } finally {
      setDailyRunnersLoading(false);
    }
  };

  const fetchConfigs = async () => {
    setLoading(true);
    setFetchError(null);

    // Read local quick-added items
    let localItems: BlackbookConfig[] = [];
    try {
      const stored = localStorage.getItem("betmate_quick_blackbook");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localItems = parsed.map((name: string) => ({
            runner: name,
            sport: "racing",
            bet_type: "win",
            stake: 10,
            enabled: true,
            probability_threshold: 50,
            notify_phone: null,
            notify_email: null,
            notify_pushover_key: null,
          }));
        }
      }
    } catch {
      // ignore
    }

    if (!user || user.id === "guest" || !token) {
      setConfigs(localItems);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/blackbook`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await safeResponseJson(res);
        const items = data?.data || data?.blackbook || [];
        const mappedConfigs: BlackbookConfig[] = items.map((item: any) => ({
          runner: item.targetName || item.horseName || item.runner,
          sport: "racing",
          bet_type: item.rules?.[0]?.stakeType || "win",
          stake: item.rules?.[0]?.stakeAmount || 10,
          enabled: item.rules?.[0]?.isActive ?? true,
          probability_threshold: item.rules?.[0]?.triggerValue ? Number(item.rules[0].triggerValue) : 50,
          notify_phone: item.alertPreferences?.sms ? "yes" : null,
          notify_email: item.alertPreferences?.email ? "yes" : null,
          notify_pushover_key: item.alertPreferences?.push ? "yes" : null,
          notes: item.notes,
          entityType: item.entityType,
          conditions: item.rules,
        }));

        const merged = [...mappedConfigs];
        for (const loc of localItems) {
          if (!merged.some((m) => m.runner.toLowerCase() === loc.runner.toLowerCase())) {
            merged.push(loc);
          }
        }
        setConfigs(merged);
      } else {
        setConfigs(localItems);
      }
    } catch (err) {
      console.error("Failed to fetch blackbook:", err);
      setFetchError("Failed to fetch Blackbook configurations.");
      setConfigs(localItems);
    } finally {
      setLoading(false);
    }
  };

  const fetchCombinations = async () => {
    if (!user || user.id === "guest" || !token) {
      setCombosLoading(false);
      return;
    }
    setCombosLoading(true);
    setCombosError(null);
    try {
      const res = await fetch(`${API_BASE}/combinations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await safeResponseJson(res);
        setCombinations(data?.combinations || data?.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch combinations:", err);
      setCombosError("Failed to connect to combinations service.");
    } finally {
      setCombosLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfigs();
    void fetchCombinations();
    void fetchDailyRunners();
    void fetchCategorizedRunners();
  }, [token, user]);

  const sortedConfigs = useMemo(() => {
    return [...configs].sort((a, b) => a.runner.localeCompare(b.runner));
  }, [configs]);

  const runningTodayConfigs = useMemo(() => {
    return sortedConfigs.filter((cfg) =>
      dailyRunners.some(
        (r) =>
          r.name?.toLowerCase() === cfg.runner.toLowerCase() ||
          r.horseName?.toLowerCase() === cfg.runner.toLowerCase()
      )
    );
  }, [sortedConfigs, dailyRunners]);

  const activeAlertsConfigs = combinations;

  const awaitingNextRaceConfigs = useMemo(() => {
    return sortedConfigs.filter(
      (cfg) => !runningTodayConfigs.some((rc) => rc.runner.toLowerCase() === cfg.runner.toLowerCase())
    );
  }, [sortedConfigs, runningTodayConfigs]);

  const removeConfig = async (runner: string) => {
    setConfigs((current) => current.filter((item) => item.runner !== runner));
    try {
      const stored = localStorage.getItem("betmate_quick_blackbook");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter((name: string) => name.toLowerCase() !== runner.toLowerCase());
          localStorage.setItem("betmate_quick_blackbook", JSON.stringify(updated));
        }
      }
    } catch {
      // ignore
    }

    trackEvent(ANALYTICS_EVENTS.REMOVED_FROM_BLACKBOOK, {
      runner,
    });

    if (user && user.id !== "guest" && token) {
      try {
        await fetch(`${ML_API}/blackbook/${encodeURIComponent(runner)}/auto-bet`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Failed to remove config", err);
      }
    }
  };

  const saveRunnerNotes = async (runner: string) => {
    if (!token) return;
    setConfigs((current) => current.map((c) => (c.runner === runner ? { ...c, notes: draftRunnerNotes } : c)));
    setEditingRunnerNotesId(null);
    try {
      await fetch(`/api/blackbook/${encodeURIComponent(runner)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: draftRunnerNotes }),
      });
    } catch (err) {
      console.error("Failed to update notes", err);
    }
  };

  const updateRunnerRating = async (runner: string, rating: number) => {
    if (!token) return;
    setConfigs((current) => current.map((c) => (c.runner === runner ? { ...c, rating } : c)));
    try {
      await fetch(`/api/blackbook/${encodeURIComponent(runner)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating }),
      });
    } catch (err) {
      console.error("Failed to update rating", err);
    }
  };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.id === "guest" || !token || !draft.runner.trim()) {
      return;
    }

    setSaving(true);
    setMessage("");

    trackEvent(ANALYTICS_EVENTS.ADDED_TO_BLACKBOOK, {
      runner: draft.runner.trim(),
      sport: draft.sport,
      bet_type: draft.bet_type,
      stake: draft.stake,
      probability_threshold: draft.probability_threshold,
    });

    try {
      const response = await fetch(
        `${ML_API}/blackbook/${encodeURIComponent(draft.runner.trim())}/auto-bet`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            sport: draft.sport,
            bet_type: draft.bet_type,
            stake: draft.stake,
            enabled: true,
            probability_threshold: draft.probability_threshold,
            notify_phone: draft.notify_phone || null,
            notify_email: draft.notify_email || null,
            notify_pushover_key: draft.notify_pushover_key || null,
          }),
        }
      );

      const data = await safeResponseJson(response);
      if (!response.ok || !data) {
        throw new Error(data?.detail || "Failed to save watch rule");
      }

      const saved = data as BlackbookConfig;
      setConfigs((current) => {
        const next = current.filter((item) => item.runner !== saved.runner);
        return [...next, saved];
      });
      setDraft(DEFAULT_RULE);
      setShowBuilder(false);
      setMessage("Watch rule saved. It now appears in your Blackbook list.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Failed to save watch rule");
    } finally {
      setSaving(false);
    }
  };

  const saveCombination = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.id === "guest" || !token) return;

    setSavingCombo(true);
    setMessage("");

    try {
      const payload = {
        combinationType: comboDraft.combinationType,
        targetName: comboDraft.targetName.trim() || undefined,
        jockeyName: comboDraft.jockeyName.trim() || null,
        trainerName: comboDraft.trainerName.trim() || null,
        horseName: comboDraft.horseName.trim() || null,
        trackName: comboDraft.trackName.trim() || null,
        notes: comboDraft.notes.trim() || null,
        alertPreferences: {
          email: comboDraft.emailAlerts,
          sms: comboDraft.smsAlerts,
          push: comboDraft.pushAlerts,
          enabled: true,
        },
      };

      const res = await fetch(`${API_BASE}/combinations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await safeResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save combination");
      }

      const newCombo = data.data as CombinationRecord;
      setCombinations((current) => [newCombo, ...current]);
      setShowComboBuilder(false);
      setComboDraft({
        combinationType: "JOCKEY_TRAINER",
        targetName: "",
        jockeyName: "",
        trainerName: "",
        horseName: "",
        trackName: "",
        notes: "",
        emailAlerts: true,
        smsAlerts: false,
        pushAlerts: true,
      });
      setMessage("Entity partnership combination saved successfully!");
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Failed to save combination");
    } finally {
      setSavingCombo(false);
    }
  };

  const toggleAlertPreference = async (comboId: string, alertKey: "email" | "sms" | "push" | "enabled") => {
    if (!token) return;

    const targetCombo = combinations.find((c) => c.id === comboId);
    if (!targetCombo) return;

    const currentPrefs = targetCombo.alertPreferences || {
      email: true,
      sms: false,
      push: true,
      enabled: true,
    };
    const updatedPrefs = { ...currentPrefs, [alertKey]: !currentPrefs[alertKey] };

    // Optimistic UI update
    setCombinations((current) =>
      current.map((c) => (c.id === comboId ? { ...c, alertPreferences: updatedPrefs } : c))
    );

    try {
      await fetch(`${API_BASE}/combinations/${comboId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ alertPreferences: updatedPrefs }),
      });
    } catch (err) {
      console.error("Failed to update alert preference", err);
    }
  };

  const saveUpdatedNotes = async (comboId: string) => {
    if (!token) return;

    // Optimistic UI update
    setCombinations((current) =>
      current.map((c) => (c.id === comboId ? { ...c, notes: draftComboNotes } : c))
    );
    setEditingComboNotesId(null);

    try {
      await fetch(`${API_BASE}/combinations/${comboId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: draftComboNotes }),
      });
    } catch (err) {
      console.error("Failed to update notes", err);
    }
  };

  const deleteCombination = async (comboId: string) => {
    if (!token) return;

    setCombinations((current) => current.filter((c) => c.id !== comboId));

    try {
      await fetch(`${API_BASE}/combinations/${comboId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Failed to delete combination", err);
    }
  };

  if (isLoading || (loading && configs.length === 0)) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BookOpen size={48} />
          <p>Loading Blackbook...</p>
        </div>
      </div>
    );
  }

  if (fetchError || combosError) {
    return (
      <div className="status-stack" style={{ padding: "2rem" }}>
        <ErrorState
          title="Blackbook unavailable"
          message={fetchError || combosError || "Unknown error"}
          tone="danger"
          actionLabel="Try again"
          onAction={() => {
            if (fetchError) void fetchConfigs();
            if (combosError) void fetchCombinations();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <BlackbookSearchBar 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelect={(item) => {
          const typeMap: Record<string, "horse" | "jockey" | "trainer" | "combination"> = {
            RUNNER: "horse",
            JOCKEY: "jockey",
            TRAINER: "trainer",
            COMBINATION: "combination",
            horse: "horse",
            jockey: "jockey",
            trainer: "trainer"
          };
          setSearchEntity({
            id: item.id,
            name: item.name,
            type: typeMap[item.category] || "horse",
            jockeyName: item.jockeyName,
            trainerName: item.trainerName,
            horseName: item.horseName,
          });
          setIsRuleBuilderOpen(true);
          setIsSearchOpen(false);
        }}
      />
      <BlackbookRuleBuilderSheet 
        isOpen={isRuleBuilderOpen} 
        onClose={() => setIsRuleBuilderOpen(false)} 
        entity={searchEntity} 
        onSave={() => void fetchConfigs()} 
      />

      {isExistingSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Select Entity for Rules</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-2">
               {configs.map(c => (
                 <button key={c.runner} onClick={() => {
                   setSearchEntity({ id: c.runner, name: c.runner, type: (c.entityType?.toLowerCase() || "horse") as any });
                   setIsRuleBuilderOpen(true);
                   setIsExistingSelectorOpen(false);
                 }} className="w-full text-left px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors border border-slate-700">
                   {c.runner} <span className="text-xs text-slate-400 capitalize ml-2">({c.entityType?.toLowerCase() || 'runner'})</span>
                 </button>
               ))}
               {configs.length === 0 && <div className="text-slate-400 text-sm italic">No saved entities. Use the search to add one first.</div>}
            </div>
            <button onClick={() => setIsExistingSelectorOpen(false)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors border border-slate-700">Cancel</button>
          </div>
        </div>
      )}

      <ErrorBoundary sectionName="Blackbook content">

      <div className="flex flex-col min-h-screen bg-transparent text-slate-300 p-8">
        {(!user || user.id === "guest") && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm shadow-lg">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="font-semibold text-white">Guest Mode Active: </span>
                <span className="text-slate-400">Viewing local watchlist and market scanner. Sign in to sync watch rules across devices and enable real-time trigger notifications.</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/login" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700">
                Create Account
              </Link>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-8 border-b border-slate-800/60 pb-4">
           <div>
              <h1 className="text-3xl font-light text-white flex items-center gap-3"><BookOpen size={28} className="text-cyan-400"/> Blackbook Terminal</h1>
           </div>
           <div className="flex gap-3">
              <button title="Search and add to Blackbook" onClick={() => setIsSearchOpen(true)} className="p-2 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white rounded transition-colors border border-slate-800"><Search size={18} /></button>
              <button title="Create Monitor Alert" onClick={() => setIsExistingSelectorOpen(true)} className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"><Plus size={18} /></button>
           </div>
        </div>

        <div className="space-y-8">
            <div>
               <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Running Today [{runningTodayConfigs.length}]</h2>
               <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-950/80 text-slate-500 font-mono text-xs uppercase border-b border-slate-800/60">
                        <tr><th className="px-4 py-4">Entity</th><th className="px-4 py-4">Type</th><th className="px-4 py-4 text-right">Actions</th></tr>
                     </thead>
                     <tbody>
                        {runningTodayConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center italic text-slate-600">No data</td></tr>}
                        {runningTodayConfigs.map(c => (
                           <tr key={c.runner} className="border-t border-slate-800/40 hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-4 font-medium text-white">{c.runner}</td>
                              <td className="px-4 py-4 text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block mr-2 animate-pulse"></span>Live Today</td>
                              <td className="px-4 py-4 text-right"><button onClick={() => removeConfig(c.runner)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
            <div>
               <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Active Alerts [{activeAlertsConfigs.length}]</h2>
               <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-950/80 text-slate-500 font-mono text-xs uppercase border-b border-slate-800/60">
                        <tr><th className="px-4 py-4">Entity / Combination</th><th className="px-4 py-4">Ruleset</th><th className="px-4 py-4 text-right">Actions</th></tr>
                     </thead>
                     <tbody>
                        {activeAlertsConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center italic text-slate-600">No data</td></tr>}
                        {activeAlertsConfigs.map(c => (
                           <tr key={c.id} className="border-t border-slate-800/40 hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-4 font-medium text-white">{c.targetName}</td>
                              <td className="px-4 py-4 text-slate-400">{c.combinationType.replace("_", " + ")}</td>
                              <td className="px-4 py-4 text-right"><button onClick={() => deleteCombination(c.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
            <div>
               <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Awaiting Next Race [{awaitingNextRaceConfigs.length}]</h2>
               <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-950/80 text-slate-500 font-mono text-xs uppercase border-b border-slate-800/60">
                        <tr><th className="px-4 py-4">Runner / Watchlist</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Actions</th></tr>
                     </thead>
                     <tbody>
                        {awaitingNextRaceConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center italic text-slate-600">No runners awaiting next race</td></tr>}
                        {awaitingNextRaceConfigs.map(c => (
                           <tr key={c.runner} className="border-t border-slate-800/40 hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-4 font-medium text-white">{c.runner}</td>
                              <td className="px-4 py-4 text-slate-400 font-mono text-xs">Monitoring</td>
                              <td className="px-4 py-4 text-right"><button onClick={() => removeConfig(c.runner)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
            
            {["Top 50 Jockeys", "Top 20 Horse Trainers", "Top 15 Harness Drivers", "Top 10 Harness Trainers", "Top 30 Dog Trainers"].map(cat => {
              const runners = categorizedRunners[cat] || [];
              if (runners.length === 0) {
                return (
                  <div key={cat}>
                     <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">{cat}</h2>
                     <div className="bg-slate-950/50 border border-slate-800/40 rounded-2xl p-4 text-center">
                        <span className="text-slate-500 text-sm italic">{cat} — Updating rankings...</span>
                     </div>
                  </div>
                );
              }
              return (
                <div key={cat}>
                   <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">{cat} [{runners.length}]</h2>
                   <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                      <table className="w-full text-sm text-left">
                         <thead className="bg-slate-950/80 text-slate-500 font-mono text-xs uppercase border-b border-slate-800/60">
                            <tr><th className="px-4 py-4">Entity</th><th className="px-4 py-4">Rank</th></tr>
                         </thead>
                         <tbody>
                            {runners.map(r => (
                               <tr key={r.id} className="border-t border-slate-800/40 hover:bg-slate-900/40 transition-colors">
                                  <td className="px-4 py-4 font-medium text-white">{r.entityName}</td>
                                  <td className="px-4 py-4 text-slate-400">#{r.rank}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
              );
            })}
        </div>
      </div>
    </ErrorBoundary>
    </>
  );
}

export default function BlackbookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Blackbook...</div>}>
      <BlackbookPageContent />
    </Suspense>
  );
}
