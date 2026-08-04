"use client";

import React, { useState } from "react";
import { Bell, Zap, CheckCircle, AlertTriangle } from "lucide-react";

export interface BlackbookNotification {
  id: string;
  runnerName: string;
  ruleDescription: string;
  suggestedStake: number;
  stakeType: string;
  odds: number;
  timestamp: string;
  isRead: boolean;
}

export default function NotificationInbox() {
  const [notifications, setNotifications] = useState<BlackbookNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [placedBetId, setPlacedBetId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handle1ClickPaperBet = (notif: BlackbookNotification) => {
    setPlacedBetId(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    setTimeout(() => {
      setPlacedBetId(null);
    }, 3000);
  };

  return (
    <div className="relative inline-block">
      {/* Bell Icon & Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-all"
        title="Blackbook Rule Notifications"
      >
        <Bell className="w-5 h-5 text-amber-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold text-slate-950 bg-amber-400 rounded-full animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Inbox */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-slate-100">Blackbook Alerts</h4>
            </div>
            <span className="text-xs text-slate-400">{unreadCount} unread</span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No active rule alerts.</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 transition-colors ${
                    notif.isRead ? "bg-slate-900/40" : "bg-slate-900/90 border-l-2 border-amber-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-100">{notif.runnerName}</span>
                    <span className="text-[10px] text-slate-500">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-amber-300 font-medium mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    {notif.ruleDescription}
                  </p>

                  {/* 1-Click Paper Bet Action Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Suggested: <span className="text-emerald-400 font-bold">${notif.suggestedStake} {notif.stakeType}</span> @ ${notif.odds}
                    </span>
                    {placedBetId === notif.id ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Bet Placed!
                      </span>
                    ) : (
                      <button
                        onClick={() => handle1ClickPaperBet(notif)}
                        className="px-2.5 py-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded shadow transition-all flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 fill-slate-950" /> 1-Click Bet
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
