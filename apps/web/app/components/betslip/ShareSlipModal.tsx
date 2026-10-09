"use client";

import React, { useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Save,
  CopyPlus,
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  Ticket,
} from "lucide-react";
import { PaperBet } from "../../providers/PaperBetslipProvider";

export interface ShareSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  bets: PaperBet[];
  slipName: string;
  onUpdateSlipName: (name: string) => void;
  onSaveSlip: (name: string) => Promise<{ id?: string; shareCode?: string } | null>;
  onCloneSlip?: (clonedBets: PaperBet[]) => void;
}

export default function ShareSlipModal({
  isOpen,
  onClose,
  bets,
  slipName,
  onUpdateSlipName,
  onSaveSlip,
  onCloneSlip,
}: ShareSlipModalProps) {
  const [localName, setLocalName] = useState(slipName || "My Friday Multi");
  const [saving, setSaving] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const combinedOdds = bets.reduce((acc, b) => acc * (b.odds || 1), 1);

  const handleSaveAndShare = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await onSaveSlip(localName);
      if (result?.shareCode) {
        setShareCode(result.shareCode);
      } else {
        // Fallback share code
        const fallback = `BM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        setShareCode(fallback);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to generate share link");
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = typeof window !== "undefined" && shareCode
    ? `${window.location.origin}/bets?slip=${shareCode}`
    : "";

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClone = () => {
    if (onCloneSlip) {
      const cloned = bets.map((b) => ({
        ...b,
        id: Math.random().toString(36).substring(2, 10),
        added_at: new Date().toISOString(),
      }));
      onCloneSlip(cloned);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-emerald-400" />
            <h3 className="text-base font-extrabold text-slate-100">
              Save & Share Slip
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Slip Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400">
            Slip Title / Description
          </label>
          <input
            type="text"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              onUpdateSlipName(e.target.value);
            }}
            placeholder="e.g. Friday Night Value Multi"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm font-semibold focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Slip Summary Cards */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400 flex items-center gap-1">
              <Ticket size={13} className="text-emerald-400" />
              <span>{bets.length} Selections</span>
            </span>
            <span className="font-mono text-emerald-400">
              Combined @ ${combinedOdds.toFixed(2)}
            </span>
          </div>

          <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs divide-y divide-slate-800/60">
            {bets.map((b) => (
              <div key={b.id} className="pt-1 first:pt-0 flex justify-between items-center text-[11px]">
                <span className="text-slate-300 truncate max-w-[240px]">
                  {b.selection} <span className="text-slate-500">({b.event_name})</span>
                </span>
                <span className="font-mono text-slate-400 shrink-0">
                  ${(b.odds || 1.9).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action: Save & Generate Code */}
        {!shareCode ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveAndShare}
              disabled={saving || bets.length === 0}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving Slip...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Save & Generate Link</span>
                </>
              )}
            </button>

            {onCloneSlip && (
              <button
                type="button"
                onClick={handleClone}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Clone this multi into slip"
              >
                <CopyPlus size={15} />
                <span>Clone</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 pt-1 animate-in fade-in duration-200">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">
                  Share Code
                </span>
                <span className="font-mono font-black text-sm text-emerald-300">
                  {shareCode}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                    copied
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {onCloneSlip && (
                <button
                  type="button"
                  onClick={handleClone}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CopyPlus size={14} />
                  <span>Clone Slip</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
