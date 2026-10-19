import React, { useState } from "react";
import {
  Users,
  PlusCircle,
  Copy,
  Check,
  Shield,
  Coins,
  DollarSign,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { useSyndicates } from "../../context/SyndicateContext";
import { useBetslip } from "../../context/BetslipContext";

export const SyndicatesView: React.FC = () => {
  const {
    syndicates,
    activeSyndicate,
    setActiveSyndicate,
    createSyndicate,
    joinSyndicate,
  } = useSyndicates();

  const { addToast } = useBetslip();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTier, setCreateTier] = useState<number>(50);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText?.(code);
    setCopied(true);
    addToast(`Syndicate invite code ${code} copied to clipboard!`, "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    createSyndicate(createName.trim(), createTier);
    addToast(`Syndicate "${createName.trim()}" created successfully!`, "success");
    setCreateName("");
    setIsCreateOpen(false);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const ok = joinSyndicate(joinCode.trim());
    if (ok) {
      addToast(`Joined syndicate successfully!`, "success");
      setJoinCode("");
      setIsJoinOpen(false);
    } else {
      addToast("Invalid syndicate code.", "error");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="text-purple-400" size={24} />
            <span>Bet With Mates &amp; Syndicates</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pool virtual bankrolls with friends, collaborate on quant multis, and track shared dividends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsJoinOpen(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            Join with Code
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer"
          >
            <PlusCircle size={15} />
            <span>Create Syndicate</span>
          </button>
        </div>
      </div>

      {/* Active Syndicate Hub */}
      {activeSyndicate ? (
        <div className="space-y-6">
          {/* Main Syndicate Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30 border border-purple-500/30 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Active Syndicate
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">{activeSyndicate.name}</h2>
              </div>

              {/* Invite Code Pill */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Invite Code:</span>
                <span className="font-mono font-black text-cyan-400 text-sm">{activeSyndicate.code}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(activeSyndicate.code)}
                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Syndicate Balance</span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                  ${activeSyndicate.balance.toFixed(2)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Buy-In Share Tier</span>
                <div className="text-2xl font-black text-white font-mono mt-0.5">
                  ${activeSyndicate.buy_in_tier} / share
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Max Stake Per Bet</span>
                <div className="text-2xl font-black text-cyan-400 font-mono mt-0.5">
                  ${activeSyndicate.max_stake_limit}
                </div>
              </div>
            </div>
          </div>

          {/* Members Roster & Shared Ledger */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Members */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Users size={16} className="text-purple-400" />
                <span>Members Roster ({activeSyndicate.members.length})</span>
              </h3>

              <div className="space-y-2">
                {activeSyndicate.members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block">{member.username}</strong>
                      <span className="text-[10px] text-slate-500">Joined {member.joined_at}</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/15 text-purple-300">
                        {member.role}
                      </span>
                      <span className="text-slate-400 font-mono block mt-1">${member.buy_in_amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shared Ledger */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Coins size={16} className="text-emerald-400" />
                <span>Shared Treasury Ledger</span>
              </h3>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {activeSyndicate.ledgers.map((entry) => {
                  const isPositive = entry.amount >= 0;
                  return (
                    <div
                      key={entry.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-slate-200 block truncate font-medium">{entry.description}</span>
                        <span className="text-[10px] text-slate-500">
                          {entry.created_at} • by {entry.author}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-black shrink-0 ${
                          isPositive ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isPositive ? "+" : ""}${Math.abs(entry.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-slate-950 border border-slate-800">
          No syndicates joined yet. Create or join one to begin!
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create New Syndicate</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Syndicate Name</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Melbourne Cup Punting Club"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Buy-In Share Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setCreateTier(tier)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        createTier === tier
                          ? "bg-purple-600 text-white border-purple-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      ${tier} / share
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Join Syndicate with Code</h3>
              <button
                type="button"
                onClick={() => setIsJoinOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Invite Code</label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BM-89241"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono tracking-wider"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white"
                >
                  Join Syndicate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
