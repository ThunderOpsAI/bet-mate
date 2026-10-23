"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  PlusCircle,
  UserPlus,
  Copy,
  Check,
  Shield,
  Coins,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Info,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { API_BASE, safeResponseJson } from "../lib/api";
import AppShell from "../components/AppShell";

interface SyndicateMember {
  id: string;
  userId: string;
  username: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  buyInAmount: number;
  joinedAt: string;
}

interface SyndicateLedger {
  id: string;
  userId: string;
  type: "BUY_IN" | "PAPER_BET" | "DIVIDEND" | "GOVERNANCE" | "ADJUSTMENT";
  amount: number;
  description: string;
  createdAt: string;
}

interface Syndicate {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  buyInTier: number;
  paperBalance: number;
  maxStakeLimit: number;
  createdAt: string;
  members: SyndicateMember[];
  ledgers: SyndicateLedger[];
  userRole?: string;
}

export default function BetWithMatesPage() {
  const { user, token } = useAuth();
  const { addToast } = usePaperBetslip();

  const [syndicates, setSyndicates] = useState<Syndicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Forms
  const [createName, setCreateName] = useState("");
  const [createTier, setCreateTier] = useState<20 | 50 | 100>(50);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Active Syndicate actions
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [governanceSyn, setGovernanceSyn] = useState<Syndicate | null>(null);
  const [newMaxStake, setNewMaxStake] = useState<number>(50);
  const [submittingGov, setSubmittingGov] = useState(false);

  const [dividendSyn, setDividendSyn] = useState<Syndicate | null>(null);
  const [dividendAmount, setDividendAmount] = useState<string>("");
  const [submittingDividend, setSubmittingDividend] = useState(false);

  const isGuest = !user || user.id === "guest";

  const fetchSyndicates = async () => {
    if (isGuest || !token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/syndicates`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load syndicates (${res.status})`);
      }

      const data = await safeResponseJson<{ syndicates: Syndicate[] }>(res);
      setSyndicates(data?.syndicates || []);
    } catch (err: any) {
      console.error("Error loading syndicates:", err);
      setError(err.message || "Failed to load syndicates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyndicates();
  }, [user, token]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addToast(`Invite code ${code} copied to clipboard!`, "success");
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCreateSyndicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      addToast("Please enter a syndicate name", "warning");
      return;
    }
    setSubmittingCreate(true);
    try {
      const res = await fetch(`${API_BASE}/syndicates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: createName.trim(), buyInTier: createTier }),
      });

      const data = await safeResponseJson<{ syndicate?: Syndicate; error?: string }>(res);
      if (!res.ok || !data?.syndicate || data?.error) {
        throw new Error(data?.error || "Failed to create syndicate");
      }

      addToast(`Syndicate "${data.syndicate.name}" created successfully!`, "success");
      setShowCreateModal(false);
      setCreateName("");
      fetchSyndicates();
    } catch (err: any) {
      addToast(err.message || "Failed to create syndicate", "error");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoinSyndicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      addToast("Please enter a 6-digit invite code", "warning");
      return;
    }
    setSubmittingJoin(true);
    try {
      const res = await fetch(`${API_BASE}/syndicates/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: joinCode.trim() }),
      });

      const data = await safeResponseJson<{ message?: string; error?: string }>(res);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || "Failed to join syndicate");
      }

      addToast(data.message || "Joined syndicate successfully!", "success");
      setShowJoinModal(false);
      setJoinCode("");
      fetchSyndicates();
    } catch (err: any) {
      addToast(err.message || "Failed to join syndicate", "error");
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleUpdateGovernance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!governanceSyn) return;
    if (newMaxStake <= 0) {
      addToast("Max stake limit must be positive", "warning");
      return;
    }
    setSubmittingGov(true);
    try {
      const res = await fetch(`${API_BASE}/syndicates/${governanceSyn.id}/governance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ maxStakeLimit: newMaxStake }),
      });

      const data = await safeResponseJson<{ message?: string; error?: string }>(res);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || "Failed to update governance");
      }

      addToast(data.message || "Governance updated successfully!", "success");
      setGovernanceSyn(null);
      fetchSyndicates();
    } catch (err: any) {
      addToast(err.message || "Failed to update governance policy", "error");
    } finally {
      setSubmittingGov(false);
    }
  };

  const handleDistributeDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dividendSyn) return;
    setSubmittingDividend(true);
    try {
      const payload: { amount?: number } = {};
      if (dividendAmount && !isNaN(Number(dividendAmount)) && Number(dividendAmount) > 0) {
        payload.amount = Number(dividendAmount);
      }

      const res = await fetch(`${API_BASE}/syndicates/${dividendSyn.id}/dividend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await safeResponseJson<{ message?: string; error?: string }>(res);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || "Failed to distribute dividend");
      }

      addToast(data.message || "Dividends distributed successfully!", "success");
      setDividendSyn(null);
      setDividendAmount("");
      fetchSyndicates();
    } catch (err: any) {
      addToast(err.message || "Failed to distribute dividends", "error");
    } finally {
      setSubmittingDividend(false);
    }
  };

  return (
    <AppShell>
      <div className="mates-page container mx-auto px-4 py-6 max-w-6xl">
        {/* Hero Section */}
        <div className="hero-banner relative overflow-hidden rounded-2xl p-6 sm:p-8 mb-8 border border-slate-700/60 bg-gradient-to-br from-slate-950 via-slate-800 to-indigo-950/80 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                  <Users size={14} /> Bet With Mates
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Coins size={13} /> 100% Paper Currency
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
                Syndicate Hub & Shared Virtual Wallet
              </h1>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Pool virtual bankrolls with your mates, log paper bets together, enforce max stake governance, and distribute paper dividends transparently.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                disabled={isGuest}
                className="btn btn-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform"
              >
                <PlusCircle size={18} />
                Create Syndicate
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                disabled={isGuest}
                className="btn btn-secondary px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:scale-105 transition-transform"
              >
                <UserPlus size={18} />
                Join with Code
              </button>
            </div>
          </div>
        </div>

        {/* Guest Warning */}
        {isGuest && (
          <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={22} className="text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-amber-300">Sign in required for Bet With Mates</h4>
                <p className="text-xs text-amber-200/80">
                  Please log in to your BetMate account to create or join paper syndicates.
                </p>
              </div>
            </div>
            <Link
              href="/login?returnUrl=/mates"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-lg transition-colors shrink-0"
            >
              Sign In Now
            </Link>
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse h-64 rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 flex flex-col justify-between"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300">
            <AlertCircle size={36} className="mx-auto mb-3 text-rose-400" />
            <h3 className="font-bold text-lg mb-1">Failed to load syndicates</h3>
            <p className="text-sm opacity-80 mb-4">{error}</p>
            <button
              type="button"
              onClick={fetchSyndicates}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-xs font-bold inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : syndicates.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Active Syndicates Yet</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              Create a new paper syndicate to seed a group wallet, or enter a 6-digit invite code from a mate to start betting together.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                disabled={isGuest}
                className="btn btn-primary px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2"
              >
                <PlusCircle size={16} /> Create Syndicate
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                disabled={isGuest}
                className="btn btn-secondary px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 border border-slate-700 bg-slate-800"
              >
                <UserPlus size={16} /> Join Syndicate
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {syndicates.map((syn) => {
              const isOwner = syn.ownerId === user?.id || syn.userRole === "OWNER";
              return (
                <div
                  key={syn.id}
                  className="syn-card rounded-2xl border border-slate-700/80 bg-slate-950/80 p-6 flex flex-col justify-between shadow-xl hover:border-indigo-500/40 transition-colors"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-white tracking-tight">{syn.name}</h3>
                          {isOwner && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Created {new Date(syn.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Invite Code Share Pill */}
                      <button
                        type="button"
                        onClick={() => handleCopyCode(syn.code)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-slate-200 flex items-center gap-2 transition-colors group"
                        title="Click to copy invite code"
                      >
                        <span className="text-slate-400">CODE:</span>
                        <span className="text-indigo-400 group-hover:text-indigo-300">{syn.code}</span>
                        {copiedCode === syn.code ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Copy size={14} className="text-slate-400" />
                        )}
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-5">
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Virtual Wallet
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-emerald-400">
                          ${syn.paperBalance.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Buy-in Tier
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-indigo-300">
                          ${syn.buyInTier.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Max Stake
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-amber-300">
                          ${syn.maxStakeLimit.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Member Roster */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                        <span className="flex items-center gap-1.5">
                          <Users size={14} className="text-indigo-400" /> Active Roster ({syn.members.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {syn.members.map((m) => (
                          <div
                            key={m.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs flex items-center gap-2"
                          >
                            <div className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                              {m.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-200">{m.username}</span>
                            {m.role === "OWNER" && (
                              <span title="Syndicate Owner"><Shield size={12} className="text-amber-400" /></span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ledger Activity Stream */}
                    {syn.ledgers && syn.ledgers.length > 0 && (
                      <div className="mb-4">
                        <span className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                          Recent Activity
                        </span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {syn.ledgers.slice(0, 4).map((l) => (
                            <div
                              key={l.id}
                              className="text-[11px] p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-slate-300"
                            >
                              <span className="truncate max-w-[200px]">{l.description}</span>
                              <span
                                className={`font-mono font-bold shrink-0 ml-2 ${
                                  l.amount >= 0 ? "text-emerald-400" : "text-amber-400"
                                }`}
                              >
                                {l.amount >= 0 ? "+" : ""}${Math.abs(l.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDividendSyn(syn);
                        setDividendAmount(syn.paperBalance.toFixed(2));
                      }}
                      disabled={syn.paperBalance <= 0}
                      className="btn btn-sm px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <DollarSign size={14} /> Distribute Dividends
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setGovernanceSyn(syn);
                          setNewMaxStake(syn.maxStakeLimit);
                        }}
                        className="btn btn-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Sliders size={14} /> Governance
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Syndicate */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-1">Create Paper Syndicate</h3>
              <p className="text-xs text-slate-400 mb-5">
                Set up a new virtual syndicate and generate a 6-digit invite code for your mates.
              </p>

              <form onSubmit={handleCreateSyndicate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Syndicate Name</label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Punters Club 2026"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Virtual Buy-in Tier per Member
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[20, 50, 100].map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setCreateTier(tier as any)}
                        className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                          createTier === tier
                            ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        ${tier} Paper
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Initial buy-in of ${createTier} paper currency will seed the group wallet.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    {submittingCreate ? "Creating..." : "Create Syndicate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Join Syndicate */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-1">Join Syndicate</h3>
              <p className="text-xs text-slate-400 mb-5">
                Enter the 6-digit invite code provided by your syndicate owner.
              </p>

              <form onSubmit={handleJoinSyndicate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">6-Digit Invite Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MATE26"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-indigo-300 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
                  Joining will deduct the syndicate's paper buy-in tier from your personal paper bankroll and credit the shared wallet.
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingJoin}
                    className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    {submittingJoin ? "Joining..." : "Join Syndicate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Governance Settings */}
        {governanceSyn && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-1">Governance Controls</h3>
              <p className="text-xs text-slate-400 mb-5">
                Update max stake policy per paper bet for <strong>{governanceSyn.name}</strong>.
              </p>

              <form onSubmit={handleUpdateGovernance} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Max Stake Limit per Bet ($ Paper)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={newMaxStake}
                    onChange={(e) => setNewMaxStake(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setGovernanceSyn(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGov}
                    className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    {submittingGov ? "Saving..." : "Save Governance Policy"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Dividend Distribution */}
        {dividendSyn && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-1">Paper Dividend Distribution</h3>
              <p className="text-xs text-slate-400 mb-4">
                Distribute virtual paper funds equally to all <strong>{dividendSyn.members.length}</strong> active members in <strong>{dividendSyn.name}</strong>.
              </p>

              <form onSubmit={handleDistributeDividend} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Dividend Amount to Distribute ($ Paper)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={dividendSyn.paperBalance}
                    value={dividendAmount}
                    onChange={(e) => setDividendAmount(e.target.value)}
                    placeholder={`Max: $${dividendSyn.paperBalance.toFixed(2)}`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-400 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Current Group Wallet: ${dividendSyn.paperBalance.toFixed(2)} paper currency.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                  Each active member will receive an equal share of ~${(
                    (Number(dividendAmount) || dividendSyn.paperBalance) / dividendSyn.members.length
                  ).toFixed(2)} paper currency directly into their paper bankroll.
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setDividendSyn(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDividend}
                    className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 border-emerald-500"
                  >
                    {submittingDividend ? "Processing..." : "Distribute Dividends"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
