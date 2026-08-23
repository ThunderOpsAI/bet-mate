"use client";

import React, { FormEvent } from "react";
import { Brain, Send, Sparkles, MessageSquare, Bot } from "lucide-react";

interface AskBobLabCardProps {
  chatInput: string;
  setChatInput: (val: string) => void;
  chatReply: string;
  chatLoading: boolean;
  onSubmit: (e: FormEvent) => void;
}

const SUGGESTED_PROMPTS = [
  "Why did Bob qualify Geelong H2H?",
  "What is the expected edge on multi bets?",
  "Explain today's bankroll allocation strategy",
];

export default function AskBobLabCard({
  chatInput,
  setChatInput,
  chatReply,
  chatLoading,
  onSubmit,
}: AskBobLabCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3 relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Ask Bob About Today&apos;s Card
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-2.5 h-2.5" /> AI Model
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Get instant algorithmic reasoning and plain-English breakdown of today&apos;s picks.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Suggestion Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-slate-500" /> Prompts:
        </span>
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setChatInput(prompt)}
            className="text-[11px] px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            suppressHydrationWarning
            type="text"
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask Bob a question about today's model selections..."
          />
        </div>
        <button
          type="submit"
          disabled={chatLoading || !chatInput.trim()}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          {chatLoading ? (
            <>
              <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Thinking...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Ask Bob</span>
            </>
          )}
        </button>
      </form>

      {/* AI Reply Display */}
      {chatReply && (
        <div className="bg-slate-950/90 border border-emerald-500/20 rounded-lg p-3 text-xs text-slate-200 space-y-1.5 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
            <Bot className="w-3.5 h-3.5" /> Bob&apos;s Analysis:
          </div>
          <div className="leading-relaxed text-slate-300 whitespace-pre-wrap pl-5 border-l-2 border-emerald-500/30">
            {chatReply}
          </div>
        </div>
      )}
    </div>
  );
}
