import React, { useState } from "react";
import { Settings, RotateCw, ShieldAlert, Bell, DollarSign, Sliders, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBetslip } from "../../context/BetslipContext";

export const SettingsView: React.FC = () => {
  const { user, resetBankroll } = useAuth();
  const { defaultStake, setDefaultStake, addToast } = useBetslip();

  const [stakeInput, setStakeInput] = useState<number>(defaultStake);
  const [bankrollResetAmt, setBankrollResetAmt] = useState<number>(10000);
  const [kellyFraction, setKellyFraction] = useState<number>(0.25);
  const [oddsFormat, setOddsFormat] = useState<"decimal" | "fractional" | "american">("decimal");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  const handleSaveStaking = (e: React.FormEvent) => {
    e.preventDefault();
    setDefaultStake(stakeInput);
    addToast("Staking preferences saved successfully!", "success");
  };

  const handleResetBankroll = () => {
    resetBankroll(bankrollResetAmt);
    addToast(`Virtual bankroll reset to $${bankrollResetAmt.toLocaleString()}!`, "success");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Settings className="text-slate-400" size={24} />
          <span>Platform Settings &amp; Bankroll Controls</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure default unit sizing, simulated bankroll capital, notifications, and responsible limits.
        </p>
      </div>

      {/* Virtual Bankroll Management */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="text-emerald-400" size={18} />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Virtual Bankroll Management</h3>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Current Virtual Balance:</span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              ${user.currentBankroll.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetBankroll}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw size={13} />
              <span>Reset to $10,000 Baseline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Default Staking & Kelly Preferences */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="text-cyan-400" size={18} />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Staking &amp; Unit Sizing</h3>
        </div>

        <form onSubmit={handleSaveStaking} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Default Paper Bet Stake ($)
              </label>
              <input
                type="number"
                min={1}
                max={2000}
                value={stakeInput}
                onChange={(e) => setStakeInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Kelly Criterion Multiplier
              </label>
              <select
                value={kellyFraction}
                onChange={(e) => setKellyFraction(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value={0.10}>Tenth Kelly (0.10x) - Ultra Safe</option>
                <option value={0.25}>Quarter Kelly (0.25x) - Recommended</option>
                <option value={0.50}>Half Kelly (0.50x) - Aggressive</option>
                <option value={1.00}>Full Kelly (1.00x) - Maximum Edge</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>

      {/* Responsible Gambling Notice */}
      <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <ShieldAlert size={18} />
          <span>Responsible Gambling Commitment</span>
        </div>
        <p className="text-amber-200/90 leading-relaxed">
          BetMate is strictly a simulated paper-trading platform designed for statistical research and quantitative strategy testing. No real-money wagering is conducted.
        </p>
        <p className="text-slate-400 text-[11px]">
          18+ | Gamble Responsibly | Australian Users: Gambling Help Online 1800 858 858
        </p>
      </div>
    </div>
  );
};
