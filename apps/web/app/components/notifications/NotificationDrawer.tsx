"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  Zap,
  Check,
  X,
  Shield,
  Mail,
  Smartphone,
  Sliders,
  Send,
  Loader2,
  AlertTriangle,
  Radio,
  CheckCircle2,
} from "lucide-react";

export interface NotificationPreferences {
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
  proximityAlertsEnabled: boolean;
  proximityIntervals: number[];
  channelEmail: boolean;
  channelPush: boolean;
  channelSms: boolean;
  channelInApp: boolean;
  emailAddress?: string | null;
  phoneNumber?: string | null;
  pushoverKey?: string | null;
  cardBellToggles: Record<string, boolean>;
}

export interface BlackbookEntityItem {
  id: string;
  targetName: string;
  entityType?: string;
  trackName?: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  blackbookItems?: BlackbookEntityItem[];
  apiBaseUrl?: string;
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  blackbookItems = [],
  apiBaseUrl = "/api/notifications",
}: NotificationDrawerProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    dailyDigestEnabled: true,
    dailyDigestTime: "08:00",
    proximityAlertsEnabled: true,
    proximityIntervals: [15, 5, 2],
    channelEmail: true,
    channelPush: true,
    channelSms: false,
    channelInApp: true,
    emailAddress: "",
    phoneNumber: "",
    pushoverKey: "",
    cardBellToggles: {},
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    fetchPreferences();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Fetch current notification preferences from backend
  const fetchPreferences = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("betmate_token") : null;
      const res = await fetch(`${apiBaseUrl}/preferences`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPreferences((prev) => ({
            ...prev,
            ...data.preferences,
          }));
        }
      }
    } catch {
      // Fallback to local default state if server is offline or guest
    } finally {
      setIsLoading(false);
    }
  };

  // Save preferences to backend
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("betmate_token") : null;
      const res = await fetch(`${apiBaseUrl}/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Handle error gracefully
    } finally {
      setIsSaving(false);
    }
  };

  // Send a test notification
  const handleSendTestNotification = async (type: "DIGEST" | "PROXIMITY") => {
    setTestSending(true);
    setTestFeedback(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("betmate_token") : null;
      const res = await fetch(`${apiBaseUrl}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestFeedback(data.message || "Test alert dispatched successfully!");
      } else {
        setTestFeedback("Test notification dispatched locally.");
      }
    } catch {
      setTestFeedback("Test alert triggered in demo mode.");
    } finally {
      setTestSending(false);
      setTimeout(() => setTestFeedback(null), 4000);
    }
  };

  const toggleProximityInterval = (interval: number) => {
    setPreferences((prev) => {
      const current = prev.proximityIntervals || [15, 5, 2];
      const updated = current.includes(interval)
        ? current.filter((i) => i !== interval)
        : [...current, interval].sort((a, b) => b - a);

      return { ...prev, proximityIntervals: updated };
    });
  };

  const toggleCardBell = (entityId: string) => {
    setPreferences((prev) => {
      const currentToggles = { ...prev.cardBellToggles };
      const currentVal = currentToggles[entityId] !== false; // defaults to true
      currentToggles[entityId] = !currentVal;
      return { ...prev, cardBellToggles: currentToggles };
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/80 backdrop-blur-sm transition-opacity"
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <aside className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-950 border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Multi-Channel Alerts
                </h3>
                <p className="text-xs text-slate-400">
                  Configure daily digests, proximity race alerts & bells
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close notification settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 divide-y divide-slate-800/60">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-sm">Loading notification preferences...</span>
              </div>
            ) : (
              <>
                {/* 1. 24-Hour Daily Summary Digest */}
                <section className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-bold text-slate-200">
                        24-Hour Daily Summary Digest
                      </h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.dailyDigestEnabled}
                        onChange={(e) =>
                          setPreferences({ ...preferences, dailyDigestEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Morning email & push summary of all saved BlackBook horses, jockeys, and trainers racing today.
                  </p>

                  {preferences.dailyDigestEnabled && (
                    <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">Morning Dispatch Time</span>
                        <select
                          value={preferences.dailyDigestTime}
                          onChange={(e) =>
                            setPreferences({ ...preferences, dailyDigestTime: e.target.value })
                          }
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="07:00">07:00 AM (Early Morning)</option>
                          <option value="08:00">08:00 AM (Recommended)</option>
                          <option value="09:00">09:00 AM (Morning)</option>
                          <option value="10:00">10:00 AM (Mid-Morning)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </section>

                {/* 2. Proximity Race Alerts */}
                <section className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-slate-200">
                        Proximity Race Alerts
                      </h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.proximityAlertsEnabled}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            proximityAlertsEnabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Receive pre-race notifications before your BlackBook entities jump. Select timing windows:
                  </p>

                  {preferences.proximityAlertsEnabled && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {[15, 5, 2].map((interval) => {
                          const isActive = (preferences.proximityIntervals || []).includes(interval);
                          return (
                            <button
                              key={interval}
                              type="button"
                              onClick={() => toggleProximityInterval(interval)}
                              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                isActive
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm"
                                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {interval}m Before
                              {isActive && <Check className="w-3.5 h-3.5 text-amber-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* 3. Delivery Channels */}
                <section className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-slate-200">Delivery Channels</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        preferences.channelEmail
                          ? "bg-slate-900/80 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900/30 border-slate-800 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Mail className="w-4 h-4 text-emerald-400" />
                        Email
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.channelEmail}
                        onChange={(e) =>
                          setPreferences({ ...preferences, channelEmail: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                      />
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        preferences.channelPush
                          ? "bg-slate-900/80 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900/30 border-slate-800 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Radio className="w-4 h-4 text-emerald-400" />
                        Push App
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.channelPush}
                        onChange={(e) =>
                          setPreferences({ ...preferences, channelPush: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                      />
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        preferences.channelSms
                          ? "bg-slate-900/80 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900/30 border-slate-800 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        SMS
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.channelSms}
                        onChange={(e) =>
                          setPreferences({ ...preferences, channelSms: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                      />
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        preferences.channelInApp
                          ? "bg-slate-900/80 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900/30 border-slate-800 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Bell className="w-4 h-4 text-emerald-400" />
                        In-App Feed
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.channelInApp}
                        onChange={(e) =>
                          setPreferences({ ...preferences, channelInApp: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                      />
                    </label>
                  </div>
                </section>

                {/* 4. Card Bell Toggles (Individual BlackBook Entities) */}
                <section className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-slate-200">
                        Card Bell Toggles ({blackbookItems.length})
                      </h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Enable or disable notifications for specific BlackBook entities:
                  </p>

                  {blackbookItems.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                      No BlackBook entities added yet. Add horses or jockeys from race cards to toggle bells.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {blackbookItems.map((item) => {
                        const isEnabled = preferences.cardBellToggles[item.id] !== false;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                          >
                            <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                              {item.targetName}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleCardBell(item.id)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                                isEnabled
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-slate-800 text-slate-500 border border-slate-700"
                              }`}
                            >
                              <Bell className="w-3 h-3" />
                              {isEnabled ? "Active" : "Muted"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 5. Test Notification Trigger */}
                <section className="pt-6 pb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-bold text-slate-200">Test Alert Engine</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={testSending}
                      onClick={() => handleSendTestNotification("PROXIMITY")}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {testSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      Test Proximity Alert
                    </button>

                    <button
                      type="button"
                      disabled={testSending}
                      onClick={() => handleSendTestNotification("DIGEST")}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {testSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                      )}
                      Test Digest
                    </button>
                  </div>

                  {testFeedback && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {testFeedback}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/80 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved!
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
