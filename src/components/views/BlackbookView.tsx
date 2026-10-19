import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Star,
  Users,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { useBlackbook } from "../../context/BlackbookContext";
import { useBetslip } from "../../context/BetslipContext";
import type { BlackbookRule, SportCode } from "../../types";

export const BlackbookView: React.FC = () => {
  const { rules, addRule, removeRule, toggleRule } = useBlackbook();
  const { addBet } = useBetslip();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "RUNNER" | "COMBINATION">("ALL");

  // Form state
  const [targetName, setTargetName] = useState("");
  const [entityType, setEntityType] = useState<BlackbookRule["entity_type"]>("RUNNER");
  const [sport, setSport] = useState<SportCode>("racing");
  const [stake, setStake] = useState(20);
  const [probThreshold, setProbThreshold] = useState(30);
  const [notes, setNotes] = useState("");
  const [emailAlert, setEmailAlert] = useState(true);
  const [pushAlert, setPushAlert] = useState(true);

  const filteredRules = rules.filter((r) =>
    filterType === "ALL" ? true : r.entity_type === filterType
  );

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim()) return;

    addRule({
      target_name: targetName.trim(),
      entity_type: entityType,
      sport,
      bet_type: "win",
      stake,
      probability_threshold: probThreshold,
      notes: notes.trim() || `Automated alert rule for ${targetName.trim()}`,
      alerts: { email: emailAlert, sms: false, push: pushAlert },
    });

    setTargetName("");
    setNotes("");
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BookOpen className="text-emerald-400" size={24} />
            <span>Blackbook &amp; Combination Tracker</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor target runners, jockey-trainer partnerships, and receive automated +EV alerts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Add Blackbook Rule</span>
        </button>
      </div>

      {/* Today's Alert Hits Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-slate-950 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Bell size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">2 Blackbook Runners Jumping Today</h4>
            <p className="text-xs text-slate-300">
              Mr Brightside (Flemington R1) and Leap To Fame (Albion Park R1) meet your probability threshold.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            addBet(
              {
                sport: "racing",
                event_id: "flem-r1",
                event_name: "Flemington R1",
                selection: "Mr Brightside",
                bet_type: "win",
                odds: 3.40,
                stake: 25,
                fair_odds: 2.75,
                edge_pct: 23.6,
              },
              true
            );
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shrink-0 self-start md:self-auto cursor-pointer"
        >
          Quick-Back Mr Brightside ($3.40)
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {(["ALL", "RUNNER", "COMBINATION"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilterType(mode)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              filterType === mode
                ? "bg-slate-800 text-emerald-400 border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {mode === "ALL" ? `All Rules (${rules.length})` : mode === "RUNNER" ? "Runners" : "Combinations"}
          </button>
        ))}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-slate-950 border border-slate-800">
            No rules found in this category. Click &ldquo;Add Blackbook Rule&rdquo; to start watching.
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-2xl bg-slate-950 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm ${
                rule.enabled ? "border-slate-800 hover:border-slate-700" : "border-slate-900 opacity-60"
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300">
                    {rule.entity_type}
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase">{rule.sport}</span>
                  {rule.metro_strike_rate && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {rule.metro_strike_rate}% Metro Win Rate
                    </span>
                  )}
                  {rule.roi_12m && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      +{rule.roi_12m}% 12M ROI
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-white truncate">{rule.target_name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{rule.notes}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                  <span>Threshold: &ge;{rule.probability_threshold}% Win Prob</span>
                  <span>•</span>
                  <span>Stake: ${rule.stake}</span>
                  <span>•</span>
                  <span>Alerts: {rule.alerts.push ? "Push " : ""}{rule.alerts.email ? "Email" : ""}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    rule.enabled
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  {rule.enabled ? "Active" : "Paused"}
                </button>

                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete rule"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create Blackbook Watch Rule</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Target Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Think About It, or J. McDonald + C. Waller"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Entity Type</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="RUNNER">Horse / Runner</option>
                    <option value="COMBINATION">Jockey + Trainer Combo</option>
                    <option value="JOCKEY">Jockey Only</option>
                    <option value="TRAINER">Trainer Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Sport / Code</label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="racing">Racing</option>
                    <option value="afl">AFL</option>
                    <option value="nba">NBA</option>
                    <option value="nrl">NRL</option>
                    <option value="soccer">Soccer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Min Probability Threshold (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={95}
                    value={probThreshold}
                    onChange={(e) => setProbThreshold(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Default Stake ($)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1000}
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Custom Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on ideal tracks, distance, or pacing conditions..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushAlert}
                    onChange={(e) => setPushAlert(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Push Alerts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlert}
                    onChange={(e) => setEmailAlert(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Email Alerts</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
