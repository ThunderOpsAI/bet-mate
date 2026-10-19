import React, { useState } from "react";
import { Bot, X, Sparkles, TrendingUp, AlertTriangle, ShieldCheck, HelpCircle, CheckCircle2 } from "lucide-react";
import type { BobExplanation } from "../../lib/bob/explainer";

interface AskBobModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: BobExplanation | null;
}

export const AskBobModal: React.FC<AskBobModalProps> = ({ isOpen, onClose, explanation }) => {
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bob"; text: string }>>([]);
  const [queryInput, setQueryInput] = useState("");

  if (!isOpen || !explanation) return null;

  const handleAskQuick = (question: string) => {
    let reply = "";
    if (question.includes("Why this pick")) {
      reply = `My ensemble model prices ${explanation.selectionName} at ${explanation.fairOddsLabel} (${explanation.probabilityLabel} win prob). The market is pricing it more generously, giving us an actionable expected value (+EV) overlay.`;
    } else if (question.includes("main risk") || question.includes("caution")) {
      reply = explanation.cautionSignals.length > 0
        ? `The biggest watch-out is ${explanation.cautionSignals.map(s => s.label).join(" and ")}. In adverse pace setups or heavy track drift, model variance increases.`
        : `Primary risk is market liquidity and unexpected race tempo. Ensure you manage stake sizing with Kelly criterion.`;
    } else if (question.includes("pace") || question.includes("speed map")) {
      reply = `According to our sectional pace model, this runner is mapped to secure an advantageous forward or box-seat position without burning extra energy before the turn.`;
    } else {
      reply = `The XGBoost multi-factor model weighs historical speed figures (28%), form decay (22%), track suitability (16%), and jockey/trainer ROI (11%) to arrive at this fair probability.`;
    }

    setChatMessages(prev => [
      ...prev,
      { sender: "user", text: question },
      { sender: "bob", text: reply }
    ]);
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    const q = queryInput.trim();
    setQueryInput("");
    handleAskQuick(q);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Ask Bob — Model Explainer</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {explanation.confidenceTone} Signal
                </span>
              </div>
              <p className="text-xs text-slate-400">Quantitative reasoning & feature importance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Target Headline */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 to-slate-900 border border-cyan-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-cyan-200">{explanation.selectionName}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Fair Odds: <strong className="text-emerald-400">{explanation.fairOddsLabel}</strong></span>
                {explanation.marketOddsLabel && (
                  <span className="text-slate-400">• Market: <strong className="text-cyan-300">{explanation.marketOddsLabel}</strong></span>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {explanation.headline}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {explanation.summary}
            </p>
          </div>

          {/* Model Signals breakdown */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-400" />
              Top Supporting Model Factors
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {explanation.topSignals.map((signal, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-200 capitalize">{signal.label}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{signal.summary || "Positive rating boost in model ensemble."}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caution Factors */}
          {explanation.cautionSignals.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Risk &amp; Caution Factors
              </h4>
              <div className="space-y-1.5">
                {explanation.cautionSignals.map((signal, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/25 flex items-start gap-2 text-amber-200 text-xs">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>{signal.summary || `${signal.label} introduces variance to the probability forecast.`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market view & data quality */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Data Quality</span>
              <p className="font-semibold text-slate-200 mt-0.5">{explanation.dataQualityLabel}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Market Consensus</span>
              <p className="font-semibold text-slate-200 mt-0.5">{explanation.marketView}</p>
            </div>
          </div>

          {/* Interactive Chat Stream */}
          {chatMessages.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300">Conversation with Bob</h4>
              <div className="space-y-2">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-xs ${
                      msg.sender === "user"
                        ? "bg-slate-800 text-slate-100 ml-8 text-right"
                        : "bg-cyan-950/40 border border-cyan-500/20 text-cyan-100 mr-8"
                    }`}
                  >
                    <p className="font-bold text-[10px] text-slate-400 mb-0.5">
                      {msg.sender === "user" ? "You" : "Bob AI"}
                    </p>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Query Chips */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ask Bob a Quick Question</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Why this pick over the field?",
                "What is the main risk?",
                "What is the pace scenario?",
                "Explain model features"
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAskQuick(chip)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/20 transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Input */}
        <form onSubmit={handleSendCustom} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Ask Bob about odds, pace, or historical data..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};
