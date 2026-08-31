"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { ExploreTab } from "../components/ExploreTab";
import { ML_API } from "../lib/mlApi";
import { API_BASE, safeResponseJson } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";
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

export default function BlackbookPage() {
  const { isLoading, token, user } = useAuth();

  // Tab state: "explore" | "list"
  const [activeTab, setActiveTab] = useState<"explore" | "list">("list");
  
  // Sprint 1 UI Filters
  const [raceTypeFilter, setRaceTypeFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  // Search & Builder
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchEntity, setSearchEntity] = useState<SearchResult | null>(null);
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);

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

  // New Combination draft form
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

  const fetchConfigs = async () => {
    if (!user || user.id === "guest" || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/blackbook`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await safeResponseJson(res);
        const items = data?.data || data?.blackbook || [];
        const mappedConfigs = items.map((item: any) => ({
          runner: item.targetName,
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
        setConfigs(mappedConfigs);
      } else {
        setFetchError("BetMate could not load your watch rules.");
      }
    } catch (err) {
      console.error("Failed to fetch blackbook:", err);
      setFetchError("BetMate could not connect to the blackbook service.");
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
      } else {
        setCombosError("Could not load saved combinations.");
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
  }, [token, user]);

  const sortedConfigs = useMemo(() => {
    return [...configs].sort((a, b) => a.runner.localeCompare(b.runner));
  }, [configs]);

  const removeConfig = async (runner: string) => {
    if (!user || user.id === "guest" || !token) return;

    setConfigs((current) => current.filter((item) => item.runner !== runner));
    trackEvent(ANALYTICS_EVENTS.REMOVED_FROM_BLACKBOOK, {
      runner,
    });

    try {
      await fetch(`${ML_API}/blackbook/${encodeURIComponent(runner)}/auto-bet`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Failed to remove config", err);
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

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BookOpen size={48} />
          <p>Loading Blackbook...</p>
        </div>
      </div>
    );
  }

  if (!user || user.id === "guest") {
    return (
      <div
        style={{ maxWidth: "600px", margin: "3rem auto", padding: "2rem", textAlign: "center" }}
        className="card"
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "rgba(6, 182, 212, 0.12)",
            border: "1px solid rgba(6, 182, 212, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            color: "var(--accent)",
          }}
        >
          <BookOpen size={28} />
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          Blackbook Restricted in Guest Mode
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: "1.75rem",
            fontSize: "0.92rem",
          }}
        >
          Guest mode allows browsing all main racing and sports pages. Blackbook watch rules,
          combinations tracking, and automated trigger alerts are reserved for registered accounts.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn btn-primary" style={{ padding: "0.7rem 1.4rem" }}>
            Create Account
          </Link>
          <Link href="/login" className="btn btn-secondary" style={{ padding: "0.7rem 1.4rem" }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading || combosLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BookOpen size={48} />
          <p>Loading Blackbook...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="status-stack" style={{ padding: "2rem" }}>
        <ErrorState
          title="Blackbook unavailable"
          message={fetchError}
          tone="danger"
          actionLabel="Try again"
          onAction={() => void fetchConfigs()}
        />
      </div>
    );
  }

  const runningTodayConfigs: typeof sortedConfigs = []; // Placeholder based on instructions
  const activeAlertsConfigs = combinations;
  const awaitingNextRaceConfigs = sortedConfigs;

  return (
    <ErrorBoundary sectionName="Blackbook content">
      <div className="flex flex-col min-h-screen bg-slate-50 overflow-hidden">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-cyan-600" />
            <div>
              <h1 className="text-xl font-bold m-0">Blackbook Engine & Dashboard</h1>
              <p className="text-sm text-slate-500 m-0 mt-1">
                Track individual runners, jockeys, trainers, or build high-ROI combinatorial partnership watchlists.
              </p>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="text-slate-400" size={18} />
            </div>
            <input
              type="text"
              placeholder="Search horses, jockeys, trainers..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all text-sm font-medium"
              onFocus={() => setIsSearchOpen(true)}
              readOnly
            />
          </div>
          <div className="flex justify-end mt-2">
            <button 
              onClick={() => setShowComboBuilder(true)}
              className="text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-100 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
            >
              <Plus size={16} /> Manually Add Entry / Combo
            </button>
          </div>
        </div>

        {showComboBuilder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-lg">Manually Add to Blackbook</h3>
                <button onClick={() => setShowComboBuilder(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
              </div>
              <form onSubmit={saveCombination} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Type</label>
                  <select 
                    value={comboDraft.combinationType}
                    onChange={(e) => setComboDraft({...comboDraft, combinationType: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm"
                  >
                    <option value="RUNNER">Single Runner</option>
                    <option value="JOCKEY">Single Jockey</option>
                    <option value="TRAINER">Single Trainer</option>
                    <option value="JOCKEY_TRAINER">Jockey + Trainer</option>
                    <option value="JOCKEY_HORSE">Jockey + Horse</option>
                    <option value="TRAINER_TRACK">Trainer + Track</option>
                  </select>
                </div>

                {["RUNNER", "JOCKEY_HORSE"].includes(comboDraft.combinationType) && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Horse Name</label>
                    <input type="text" required value={comboDraft.horseName} onChange={e => setComboDraft({...comboDraft, horseName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. Winx" />
                  </div>
                )}
                
                {["JOCKEY", "JOCKEY_TRAINER", "JOCKEY_HORSE"].includes(comboDraft.combinationType) && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Jockey Name</label>
                    <input type="text" required value={comboDraft.jockeyName} onChange={e => setComboDraft({...comboDraft, jockeyName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. J McDonald" />
                  </div>
                )}
                
                {["TRAINER", "JOCKEY_TRAINER", "TRAINER_TRACK"].includes(comboDraft.combinationType) && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Trainer Name</label>
                    <input type="text" required value={comboDraft.trainerName} onChange={e => setComboDraft({...comboDraft, trainerName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. C Waller" />
                  </div>
                )}

                {comboDraft.combinationType === "TRAINER_TRACK" && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Track Name</label>
                    <input type="text" required value={comboDraft.trackName} onChange={e => setComboDraft({...comboDraft, trackName: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="e.g. Flemington" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
                  <textarea value={comboDraft.notes} onChange={e => setComboDraft({...comboDraft, notes: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 text-sm resize-none" rows={2} placeholder="Why are you watching this?"></textarea>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowComboBuilder(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={savingCombo} className="px-4 py-2 text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg disabled:opacity-50">
                    {savingCombo ? "Saving..." : "Save Entry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <BlackbookSearchBar 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
          onSelect={(item) => {
            const typeMap: Record<string, "horse" | "jockey" | "trainer" | "combination"> = {
              RUNNER: "horse",
              JOCKEY: "jockey",
              TRAINER: "trainer",
              COMBINATION: "combination"
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

        <div className="bg-white border-b border-slate-200 px-6 flex space-x-6">
          <button 
            onClick={() => setActiveTab("list")}
            className={`font-bold py-3 border-b-2 transition-colors ${activeTab === "list" ? "border-cyan-600 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            My Blackbook
          </button>
          <button 
            onClick={() => setActiveTab("explore")}
            className={`font-bold py-3 border-b-2 transition-colors ${activeTab === "explore" ? "border-cyan-600 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Explore
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === "list" ? (
            <div className="space-y-8 py-6">
              {/* Running Today Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700">
                  <h2 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2 m-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Running Today ({runningTodayConfigs.length})
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {runningTodayConfigs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No runners scheduled for today.
                    </div>
                  ) : (
                    runningTodayConfigs.map((cfg) => (
                      <div key={cfg.runner} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                        <div className="font-bold">{cfg.runner}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Active Alerts Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700">
                  <h2 className="text-sm font-black uppercase text-slate-200 tracking-wider m-0">
                    Active Alerts ({activeAlertsConfigs.length})
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {activeAlertsConfigs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No active alerts.
                    </div>
                  ) : (
                    activeAlertsConfigs.map((combo) => (
                      <div key={combo.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg m-0">{combo.targetName}</h3>
                              <span className="bg-cyan-50 text-cyan-700 border border-cyan-100 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                                {combo.combinationType.replaceAll("_", " + ")}
                              </span>
                            </div>
                            <div className="flex gap-4 text-sm text-slate-500 mt-2">
                              {combo.jockeyName && <span className="flex items-center gap-1"><User size={14} className="text-cyan-600"/> {combo.jockeyName}</span>}
                              {combo.trainerName && <span className="flex items-center gap-1"><Award size={14} className="text-cyan-600"/> {combo.trainerName}</span>}
                              {combo.horseName && <span className="flex items-center gap-1"><Activity size={14} className="text-cyan-600"/> {combo.horseName}</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteCombination(combo.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
              
              {/* Awaiting Next Race Section */}
              <section>
                <div className="bg-slate-800 px-6 py-2.5 shadow-sm border-b border-slate-700">
                  <h2 className="text-sm font-black uppercase text-slate-300 tracking-wider flex items-center gap-1 m-0">
                    <Clock size={14}/> Awaiting Next Race ({awaitingNextRaceConfigs.length})
                  </h2>
                </div>
                <div className="px-6 space-y-3 pt-4">
                  {awaitingNextRaceConfigs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-white border border-slate-200 rounded-lg">
                      No awaiting configs.
                    </div>
                  ) : (
                    awaitingNextRaceConfigs.map((cfg) => (
                      <div key={cfg.runner} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-lg m-0 flex items-center gap-2">
                            {cfg.runner}
                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded capitalize">
                              {cfg.sport}
                            </span>
                          </h3>
                          <button onClick={() => removeConfig(cfg.runner)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex gap-4 text-sm text-slate-500">
                          <span><strong>Paper stake:</strong> ${cfg.stake}</span>
                          <span><strong>Trigger:</strong> win chance at {cfg.probability_threshold}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="p-6">
              <ExploreTab onAddToBlackbook={(entity) => {
                setSearchEntity({ id: entity.name, name: entity.name, type: entity.type as "jockey" | "trainer" | "horse" });
                setIsRuleBuilderOpen(true);
              }} />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
