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
import { BlackbookSearchModal, SearchResult } from "../components/BlackbookSearchModal";
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

  // Tab state: "explore" | "runners" | "jockeys" | "trainers" | "combinations"
  const [activeTab, setActiveTab] = useState<"explore" | "runners" | "jockeys" | "trainers" | "combinations">(
    "explore"
  );
  
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
        const items = data?.data || [];
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

  if (loading && combosLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <BookOpen size={48} />
          <p>Loading Blackbook...</p>
        </div>
      </div>
    );
  }

  if (fetchError && activeTab === "runners") {
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

  return (
    <ErrorBoundary sectionName="Blackbook content">
      <div style={{ padding: 0 }}>
        {/* Page Header */}
        <div
          className="page-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <BookOpen size={28} style={{ color: "var(--accent)" }} />
            <div>
              <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Blackbook Engine & Dashboard</h1>
              <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)" }}>
                Track individual runners, jockeys, trainers, or build high-ROI combinatorial partnership watchlists.
              </p>
            </div>
          </div>

          {activeTab === "combinations" ? (
            <button
              className="btn btn-primary"
              onClick={() => setShowComboBuilder((curr) => !curr)}
            >
              <Plus size={16} /> {showComboBuilder ? "Close Builder" : "Add Combination"}
            </button>
          ) : (
            <button
              className="btn btn-primary opacity-50 cursor-not-allowed"
              disabled
              title="Coming soon"
            >
              <Plus size={16} /> Add Watch Rule
            </button>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="text-gray-400" size={18} />
          </div>
          <input
            type="text"
            placeholder="Search horses, jockeys, trainers..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all text-sm font-medium"
            onFocus={() => setIsSearchOpen(true)}
            readOnly
          />
        </div>

        <BlackbookSearchModal 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
          onSelect={(e) => { setSearchEntity(e); setIsRuleBuilderOpen(true); }}
        />
        <BlackbookRuleBuilderSheet 
          isOpen={isRuleBuilderOpen} 
          onClose={() => setIsRuleBuilderOpen(false)} 
          entity={searchEntity} 
          onSave={() => void fetchConfigs()} 
        />

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "0.5rem",
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setActiveTab("explore")}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "explore" ? "var(--accent)" : "transparent",
              color: activeTab === "explore" ? "#000" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <Flame size={16} /> Explore
          </button>

          <button
            onClick={() => setActiveTab("runners")}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "runners" ? "var(--accent)" : "transparent",
              color: activeTab === "runners" ? "#000" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <BookOpen size={16} /> Runners ({sortedConfigs.length})
          </button>

          <button
            onClick={() => setActiveTab("jockeys")}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "jockeys" ? "var(--accent)" : "transparent",
              color: activeTab === "jockeys" ? "#000" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <User size={16} /> Jockeys
          </button>

          <button
            onClick={() => setActiveTab("trainers")}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "trainers" ? "var(--accent)" : "transparent",
              color: activeTab === "trainers" ? "#000" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <Award size={16} /> Trainers
          </button>

          <button
            onClick={() => setActiveTab("combinations")}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "combinations" ? "var(--accent)" : "transparent",
              color: activeTab === "combinations" ? "#000" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <Sparkles size={16} /> Combinations ({combinations.length})
          </button>
        </div>

        {/* Sub-Filters for Sprint 1 */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Race Type Icons */}
          <div style={{ display: "flex", gap: "0.5rem", background: "var(--surface)", padding: "0.25rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
            {[ { id: "all", label: "All" }, { id: "thoroughbred", label: "🐎 Thoroughbred" }, { id: "greyhound", label: "🐕 Greyhounds" }, { id: "harness", label: "🏇 Harness" }].map(t => (
              <button
                key={t.id}
                onClick={() => setRaceTypeFilter(t.id)}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  border: "none",
                  background: raceTypeFilter === t.id ? "var(--accent)" : "transparent",
                  color: raceTypeFilter === t.id ? "#000" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Time Sub-Filters */}
          <div style={{ display: "flex", gap: "0.5rem", background: "var(--surface)", padding: "0.25rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
            {[ { id: "all", label: "All" }, { id: "up_next", label: "Up Next" }, { id: "running_today", label: "Running Today" }].map(t => (
              <button
                key={t.id}
                onClick={() => setTimeFilter(t.id)}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  border: "none",
                  background: timeFilter === t.id ? "var(--bg-primary)" : "transparent",
                  color: timeFilter === t.id ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  boxShadow: timeFilter === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {message ? (
          <div
            className="card"
            style={{
              marginBottom: "1rem",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              color: "var(--text-primary)",
            }}
          >
            {message}
          </div>
        ) : null}

        {/* TAB 0: EXPLORE */}
        {activeTab === "explore" && (
          <ExploreTab onAddToBlackbook={(entity) => {
            setSearchEntity({ id: entity.name, name: entity.name, type: entity.type as "jockey" | "trainer" | "horse" });
            setIsRuleBuilderOpen(true);
          }} />
        )}

        {/* TAB 1: RUNNERS */}
        {activeTab === "runners" && (
          <>
            <div
              className="card"
              style={{
                marginBottom: "1rem",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8rem" }}>
                <PencilLine size={18} style={{ color: "var(--accent)", marginTop: "0.15rem" }} />
                <div>
                  <h3 style={{ margin: "0 0 0.5rem" }}>Runner Watch Rules</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Set win/place thresholds, paper bet stakes, and alert preferences for individual runners across racing and sports.
                  </p>
                </div>
              </div>
            </div>

            {showBuilder ? (
              <form className="card" onSubmit={saveRule} style={{ marginBottom: "1rem" }}>
                <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Add a watch rule</h3>
                <div
                  style={{
                    display: "grid",
                    gap: "1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Runner or Team</label>
                    <input
                      className="form-input"
                      value={draft.runner}
                      onChange={(event) => setDraft({ ...draft, runner: event.target.value })}
                      placeholder={
                        draft.sport === "racing" ? "e.g. Swift Star" : "e.g. Melbourne Demons"
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sport</label>
                    <select
                      className="form-input"
                      value={draft.sport}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          sport: event.target.value as DraftRule["sport"],
                          bet_type:
                            event.target.value === "racing" || event.target.value === "golf"
                              ? "win"
                              : "head_to_head",
                        })
                      }
                    >
                      <option value="racing">Racing</option>
                      <option value="afl">AFL</option>
                      <option value="nba">NBA</option>
                      <option value="nrl">NRL</option>
                      <option value="soccer">Soccer</option>
                      <option value="golf">Golf</option>
                      <option value="mma">MMA</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bet Type</label>
                    <select
                      className="form-input"
                      value={draft.bet_type}
                      onChange={(event) => setDraft({ ...draft, bet_type: event.target.value })}
                    >
                      {draft.sport === "racing" || draft.sport === "golf" ? (
                        <>
                          <option value="win">Win</option>
                          {draft.sport === "racing" && <option value="place">Place</option>}
                        </>
                      ) : (
                        <option value="head_to_head">Head to Head</option>
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Paper Bet Stake</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      step={1}
                      value={draft.stake}
                      onChange={(event) => setDraft({ ...draft, stake: Number(event.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trigger Threshold</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={99}
                      step={1}
                      value={draft.probability_threshold}
                      onChange={(event) =>
                        setDraft({ ...draft, probability_threshold: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Alerts</label>
                    <input
                      className="form-input"
                      type="email"
                      value={draft.notify_email}
                      onChange={(event) => setDraft({ ...draft, notify_email: event.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SMS Alerts</label>
                    <input
                      className="form-input"
                      type="tel"
                      value={draft.notify_phone}
                      onChange={(event) => setDraft({ ...draft, notify_phone: event.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Push Key</label>
                    <input
                      className="form-input"
                      value={draft.notify_pushover_key}
                      onChange={(event) =>
                        setDraft({ ...draft, notify_pushover_key: event.target.value })
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div
                  style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}
                >
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    <Plus size={16} /> {saving ? "Saving..." : "Save Watch Rule"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setDraft(DEFAULT_RULE);
                      setShowBuilder(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {sortedConfigs.length === 0 ? (
              <div
                style={{
                  padding: "3rem",
                  textAlign: "center",
                  background: "var(--surface)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border)",
                }}
              >
                <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>
                  Your Blackbook runner watchlist is empty.
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  Add a horse or team above, or browse today&apos;s races and games to save something you want to revisit.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {sortedConfigs.map((cfg) => (
                  <div
                    key={cfg.runner}
                    style={{
                      background: "var(--surface)",
                      borderRadius: "12px",
                      padding: "1.5rem",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: "0 0 0.5rem 0",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {cfg.runner}
                        <span className="badge badge-accent" style={{ textTransform: "capitalize" }}>
                          {cfg.sport}
                        </span>
                        <span className="badge badge-blue">{cfg.bet_type.replaceAll("_", " ")}</span>
                      </h3>
                      {(() => {
                        let comboLabel = null;
                        if (cfg.entityType === 'COMBINATION') {
                           comboLabel = `🔗 ${cfg.runner}`;
                        } else if (cfg.conditions) {
                           let c = cfg.conditions;
                           if (typeof c === 'string') {
                              try { c = JSON.parse(c); } catch(e) {}
                           }
                           if (c.comboJockeyTrainer) comboLabel = `🔗 ${c.comboJockeyTrainer_jockey || 'Jockey'} + ${c.comboJockeyTrainer_trainer || 'Trainer'}`;
                           else if (c.comboJockeyHorse) comboLabel = `🔗 ${c.comboJockeyHorse_jockey || 'Jockey'} + ${c.comboJockeyHorse_horse || 'Horse'}`;
                           else if (c.comboTrainerTrack) comboLabel = `🔗 ${c.comboTrainerTrack_trainer || 'Trainer'} + ${c.comboTrainerTrack_track || 'Track'}`;
                           else if (c.comboJockeyTrack) comboLabel = `🔗 ${c.comboJockeyTrack_jockey || 'Jockey'} + ${c.comboJockeyTrack_track || 'Track'}`;
                           else if (c.comboHorseFavourite) comboLabel = `🔗 Horse + Favourite`;
                           else if (c.comboDogBox) comboLabel = `🔗 Dog + Box ${c.comboDogBox_box || ''}`;
                        }
                        if (comboLabel) {
                          return (
                            <div style={{ marginBottom: "0.5rem" }}>
                              <span className="badge" style={{ background: "rgba(6, 182, 212, 0.1)", color: "var(--accent)", border: "1px solid rgba(6, 182, 212, 0.2)", fontWeight: 600 }}>
                                {comboLabel}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          color: "var(--muted)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span>
                          <strong>Paper stake:</strong> ${cfg.stake}
                        </span>
                        <span>
                          <strong>Trigger:</strong> model win chance at {cfg.probability_threshold}%
                        </span>
                        {cfg.enabled ? (
                          <span
                            style={{
                              color: "var(--green)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <CheckCircle2 size={14} /> Active
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--red)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <ShieldAlert size={14} /> Paused
                          </span>
                        )}
                      </div>
                      {(cfg.notify_email || cfg.notify_phone || cfg.notify_pushover_key) && (
                        <div
                          style={{
                            marginTop: "0.75rem",
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            color: "var(--muted)",
                          }}
                        >
                          <Bell size={14} />
                          Notifications:
                          {[
                            cfg.notify_phone ? "SMS" : null,
                            cfg.notify_email ? "Email" : null,
                            cfg.notify_pushover_key ? "Push" : null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}

                      {/* Notes & Rating */}
                      <div style={{ width: "100%", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Notes</span>
                              {!editingRunnerNotesId && (
                                <button
                                  onClick={() => {
                                    setEditingRunnerNotesId(cfg.runner);
                                    setDraftRunnerNotes(cfg.notes || "");
                                  }}
                                  className="text-cyan-600 hover:text-cyan-700 p-1 rounded hover:bg-cyan-50"
                                >
                                  <Edit3 size={12} />
                                </button>
                              )}
                            </div>
                            {editingRunnerNotesId === cfg.runner ? (
                              <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                                <textarea
                                  className="form-input text-sm"
                                  rows={2}
                                  value={draftRunnerNotes}
                                  onChange={(e) => setDraftRunnerNotes(e.target.value)}
                                  maxLength={150}
                                />
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                  <button onClick={() => void saveRunnerNotes(cfg.runner)} className="btn btn-primary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}>Save</button>
                                  <button onClick={() => setEditingRunnerNotesId(null)} className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: "0.85rem", color: cfg.notes ? "var(--text-primary)" : "var(--text-muted)", fontStyle: cfg.notes ? "normal" : "italic" }}>
                                {cfg.notes || "No notes..."}
                              </p>
                            )}
                          </div>
                          
                          <div style={{ display: "flex", gap: "2px", marginLeft: "1rem" }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <button key={star} onClick={() => updateRunnerRating(cfg.runner, star)}>
                                <Star size={16} className={star <= (cfg.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        className="btn btn-outline"
                        style={{ color: "var(--red)", borderColor: "var(--red)" }}
                        onClick={() => removeConfig(cfg.runner)}
                        title="Remove from Blackbook"
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB 2: JOCKEYS */}
        {activeTab === "jockeys" && (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <User size={40} style={{ color: "var(--accent)", margin: "0 auto 1rem" }} />
            <h3>Jockey Tracking Engine</h3>
            <p style={{ color: "var(--text-muted)", maxWidth: "500px", margin: "0.5rem auto 1.5rem" }}>
              Track individual jockey performance, metro strike rates, and gear switch updates. Combine jockeys with trainers or tracks in the Combinations tab for multi-entity alerts.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setActiveTab("combinations");
                setComboDraft((c) => ({ ...c, combinationType: "JOCKEY_TRAINER" }));
                setShowComboBuilder(true);
              }}
            >
              <Plus size={16} /> Create Jockey + Trainer Combo
            </button>
          </div>
        )}

        {/* TAB 3: TRAINERS */}
        {activeTab === "trainers" && (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <Award size={40} style={{ color: "var(--accent)", margin: "0 auto 1rem" }} />
            <h3>Trainer Tracking Engine</h3>
            <p style={{ color: "var(--text-muted)", maxWidth: "500px", margin: "0.5rem auto 1.5rem" }}>
              Monitor trainer stable forms, 12-month ROI streaks, and city carnival runners. Save trainer partnerships with key jockeys or horses in the Combinations engine.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setActiveTab("combinations");
                setComboDraft((c) => ({ ...c, combinationType: "TRAINER_HORSE" }));
                setShowComboBuilder(true);
              }}
            >
              <Plus size={16} /> Create Trainer + Horse Combo
            </button>
          </div>
        )}

        {/* TAB 4: COMBINATIONS */}
        {activeTab === "combinations" && (
          <>
            {/* Header info box */}
            <div
              className="card"
              style={{
                marginBottom: "1rem",
                background: "rgba(6, 182, 212, 0.05)",
                border: "1px solid rgba(6, 182, 212, 0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8rem" }}>
                <Sparkles size={20} style={{ color: "var(--accent)", marginTop: "0.15rem" }} />
                <div>
                  <h3 style={{ margin: "0 0 0.4rem" }}>Combinatorial Blackbook Engine</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.5, fontSize: "0.92rem" }}>
                    Monitor specific entity partnerships such as Jockey + Trainer synergies, Trainer + Horse combos, or Jockey + Track Specialists. Track real-time Metro Strike Rates %, 12-Month ROI %, and receive instant notifications when scheduled race entries lock in.
                  </p>
                </div>
              </div>
            </div>

            {/* Builder Form */}
            {showComboBuilder && (
              <form className="card" onSubmit={saveCombination} style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Plus size={18} style={{ color: "var(--accent)" }} /> Add Entity Partnership Combination
                  </h3>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowComboBuilder(false)}
                    style={{ padding: "0.3rem 0.6rem" }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Combination Type</label>
                    <select
                      className="form-input"
                      value={comboDraft.combinationType}
                      onChange={(e) => setComboDraft({ ...comboDraft, combinationType: e.target.value })}
                    >
                      <option value="JOCKEY_TRAINER">Jockey + Trainer Partnership</option>
                      <option value="TRAINER_HORSE">Trainer + Horse Combo</option>
                      <option value="JOCKEY_TRACK">Jockey + Track Specialist</option>
                      <option value="HORSE_TRACK">Horse + Track Specialist</option>
                      <option value="CUSTOM">Custom Entity Partnership</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Partnership Title (Optional)</label>
                    <input
                      className="form-input"
                      value={comboDraft.targetName}
                      onChange={(e) => setComboDraft({ ...comboDraft, targetName: e.target.value })}
                      placeholder="e.g. J. McDonald & C. Waller"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Jockey Name</label>
                    <input
                      className="form-input"
                      value={comboDraft.jockeyName}
                      onChange={(e) => setComboDraft({ ...comboDraft, jockeyName: e.target.value })}
                      placeholder="e.g. J. McDonald"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Trainer Name</label>
                    <input
                      className="form-input"
                      value={comboDraft.trainerName}
                      onChange={(e) => setComboDraft({ ...comboDraft, trainerName: e.target.value })}
                      placeholder="e.g. C. Waller"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Horse Name</label>
                    <input
                      className="form-input"
                      value={comboDraft.horseName}
                      onChange={(e) => setComboDraft({ ...comboDraft, horseName: e.target.value })}
                      placeholder="e.g. Verry Elleegant"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Track / Venue</label>
                    <TrackPicker
                      value={comboDraft.trackName}
                      onChange={(val) => setComboDraft({ ...comboDraft, trackName: val })}
                      placeholder="e.g. Flemington"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "1rem" }}>
                  <label className="form-label">Custom Notes & Insights</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={comboDraft.notes}
                    onChange={(e) => setComboDraft({ ...comboDraft, notes: e.target.value })}
                    placeholder="e.g. Lethal combination on Heavy 8+ tracks in Sydney metro races."
                  />
                </div>

                <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={comboDraft.emailAlerts}
                      onChange={(e) => setComboDraft({ ...comboDraft, emailAlerts: e.target.checked })}
                    />
                    Email Alerts
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={comboDraft.smsAlerts}
                      onChange={(e) => setComboDraft({ ...comboDraft, smsAlerts: e.target.checked })}
                    />
                    SMS Alerts
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={comboDraft.pushAlerts}
                      onChange={(e) => setComboDraft({ ...comboDraft, pushAlerts: e.target.checked })}
                    />
                    Push Notifications
                  </label>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                  <button className="btn btn-primary" type="submit" disabled={savingCombo}>
                    <Plus size={16} /> {savingCombo ? "Saving..." : "Save Partnership Combination"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setShowComboBuilder(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Error state */}
            {combosError && (
              <div className="status-stack" style={{ padding: "1rem 0" }}>
                <ErrorState
                  title="Combinations Error"
                  message={combosError}
                  tone="danger"
                  actionLabel="Try again"
                  onAction={() => void fetchCombinations()}
                />
              </div>
            )}

            {/* Empty state — Zero tolerance for synthetic mock fallbacks */}
            {!combosLoading && combinations.length === 0 && (
              <div
                style={{
                  padding: "3.5rem 2rem",
                  textAlign: "center",
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px dashed var(--border)",
                }}
              >
                <Sparkles size={44} style={{ color: "var(--accent)", margin: "0 auto 1rem", opacity: 0.8 }} />
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                  No Combination Watchlists Saved
                </h3>
                <p style={{ color: "var(--text-muted)", maxWidth: "480px", margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
                  Create your first Jockey+Trainer partnership, Trainer+Horse synergy, or Track Specialist combo to automatically track Metro Strike Rates and upcoming scheduled race entries.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowComboBuilder(true)}
                  style={{ padding: "0.7rem 1.4rem" }}
                >
                  <Plus size={16} /> Create First Combination
                </button>
              </div>
            )}

            {/* Combination Cards List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {combinations.map((combo) => {
                const prefs = combo.alertPreferences || {};
                const isEditingNotes = editingComboNotesId === combo.id;

                return (
                  <div
                    key={combo.id}
                    className="card"
                    style={{
                      background: "var(--surface)",
                      borderRadius: "16px",
                      padding: "1.5rem",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    {/* Top Row: Title, Combo Badge, Metrics */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>
                            {combo.targetName}
                          </h3>
                          <span
                            className="badge badge-accent"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {combo.combinationType.replaceAll("_", " + ")}
                          </span>
                        </div>

                        {/* Entities list */}
                        <div
                          style={{
                            display: "flex",
                            gap: "1.25rem",
                            flexWrap: "wrap",
                            marginTop: "0.6rem",
                            fontSize: "0.88rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {combo.jockeyName && (
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <User size={14} style={{ color: "var(--accent)" }} /> Jockey: <strong>{combo.jockeyName}</strong>
                            </span>
                          )}
                          {combo.trainerName && (
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <Award size={14} style={{ color: "var(--accent)" }} /> Trainer: <strong>{combo.trainerName}</strong>
                            </span>
                          )}
                          {combo.horseName && (
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <Activity size={14} style={{ color: "var(--accent)" }} /> Horse: <strong>{combo.horseName}</strong>
                            </span>
                          )}
                          {combo.trackName && (
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <MapPin size={14} style={{ color: "var(--accent)" }} /> Track: <strong>{combo.trackName}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stat Pills */}
                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        <div
                          style={{
                            background: "rgba(6, 182, 212, 0.1)",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            borderRadius: "10px",
                            padding: "0.5rem 0.85rem",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                            Metro Strike Rate
                          </div>
                          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "center" }}>
                            <Flame size={15} /> {combo.metroStrikeRate}%
                          </div>
                        </div>

                        <div
                          style={{
                            background: "rgba(34, 197, 94, 0.1)",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                            borderRadius: "10px",
                            padding: "0.5rem 0.85rem",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                            12-Month ROI
                          </div>
                          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#22c55e", display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "center" }}>
                            +{combo.roi12Month}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Alert Toggles & Custom Notes */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "1rem",
                        paddingTop: "0.75rem",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      {/* Active Alert Toggles */}
                      <div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "0.6rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                          }}
                        >
                          <Bell size={14} style={{ color: "var(--accent)" }} /> Alert Notification Preferences
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => toggleAlertPreference(combo.id, "email")}
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "8px",
                              border: prefs.email ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid var(--border)",
                              background: prefs.email ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.03)",
                              color: prefs.email ? "#22c55e" : "var(--text-muted)",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <CheckCircle2 size={13} style={{ opacity: prefs.email ? 1 : 0.4 }} /> Email
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleAlertPreference(combo.id, "sms")}
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "8px",
                              border: prefs.sms ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid var(--border)",
                              background: prefs.sms ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.03)",
                              color: prefs.sms ? "#22c55e" : "var(--text-muted)",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <CheckCircle2 size={13} style={{ opacity: prefs.sms ? 1 : 0.4 }} /> SMS
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleAlertPreference(combo.id, "push")}
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "8px",
                              border: prefs.push ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid var(--border)",
                              background: prefs.push ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.03)",
                              color: prefs.push ? "#22c55e" : "var(--text-muted)",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <CheckCircle2 size={13} style={{ opacity: prefs.push ? 1 : 0.4 }} /> Push
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleAlertPreference(combo.id, "enabled")}
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "8px",
                              border: prefs.enabled ? "1px solid rgba(6, 182, 212, 0.5)" : "1px solid rgba(239, 68, 68, 0.5)",
                              background: prefs.enabled ? "rgba(6, 182, 212, 0.12)" : "rgba(239, 68, 68, 0.12)",
                              color: prefs.enabled ? "var(--accent)" : "#ef4444",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {prefs.enabled ? "Trigger Active" : "Trigger Muted"}
                          </button>
                        </div>
                      </div>

                      {/* Custom Notes */}
                      <div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "0.6rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <PencilLine size={14} style={{ color: "var(--accent)" }} /> Custom Notes & Insights
                          </span>
                          {!isEditingNotes && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingComboNotesId(combo.id);
                                setDraftComboNotes(combo.notes || "");
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--accent)",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                          )}
                        </div>

                        {isEditingNotes ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <textarea
                              className="form-input"
                              rows={2}
                              value={draftComboNotes}
                              onChange={(e) => setDraftComboNotes(e.target.value)}
                              placeholder="Add specific notes on this partnership..."
                            />
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
                                onClick={() => void saveUpdatedNotes(combo.id)}
                              >
                                <Save size={13} /> Save Note
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
                                onClick={() => setEditingComboNotesId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: "0.9rem", color: combo.notes ? "var(--text-primary)" : "var(--text-muted)", fontStyle: combo.notes ? "normal" : "italic" }}>
                            {combo.notes || "No custom notes added for this combination yet."}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Upcoming Scheduled Race Cards */}
                    <div
                      style={{
                        paddingTop: "0.85rem",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <Calendar size={14} style={{ color: "var(--accent)" }} /> Upcoming Scheduled Race Cards
                      </div>

                      {combo.upcomingRaces && combo.upcomingRaces.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "0.75rem",
                          }}
                        >
                          {combo.upcomingRaces.map((race) => (
                            <div
                              key={`${race.raceId}_${race.horseName}`}
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border)",
                                borderRadius: "10px",
                                padding: "0.85rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--accent)" }}>
                                  {race.venue} R{race.raceNumber}
                                </span>
                                {race.barrier && (
                                  <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>
                                    Box {race.barrier}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                                {race.horseName}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {race.jockeyName ? `Jockey: ${race.jockeyName}` : null}
                                {race.jockeyName && race.trainerName ? " | " : null}
                                {race.trainerName ? `Trainer: ${race.trainerName}` : null}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                                Start Time: {new Date(race.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.2rem", flexWrap: "wrap" }}>
                                {race.betfairOdds && (
                                  <button className="badge" style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>
                                    ${race.betfairOdds.toFixed(2)}
                                  </button>
                                )}
                                {race.isValue && (
                                  <span className="badge" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.2)" }}>
                                    ⚡ Value
                                  </span>
                                )}
                                {race.winProbability && (
                                  <span className="badge badge-outline">
                                    {race.winProbability.toFixed(1)}% ML
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: "0.85rem",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                            fontStyle: "italic",
                          }}
                        >
                          No scheduled race entries found matching this exact combination today.
                        </div>
                      )}
                    </div>

                    {/* Footer Row: Delete Action */}
                    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                      <button
                        className="btn btn-outline"
                        style={{ color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.4)", fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
                        onClick={() => void deleteCombination(combo.id)}
                      >
                        <Trash2 size={15} /> Delete Combination
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
