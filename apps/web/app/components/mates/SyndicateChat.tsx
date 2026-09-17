"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Share2,
  Crown,
  ShieldCheck,
  User,
  UserX,
  Flag,
  Sparkles,
  TrendingUp,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
  X,
  SlidersHorizontal,
  PlusCircle,
} from "lucide-react";
import { API_BASE, safeResponseJson } from "../../lib/api";

export interface BetCardPayload {
  eventType: string;
  eventId: string;
  eventName: string;
  selection: string;
  odds: number;
  stake: number;
  betType: string;
  wasAIRecommended?: boolean;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  syndicateId: string;
  userId: string;
  username: string;
  userRole?: string; // OWNER, ADMIN, MEMBER
  text: string;
  betPayload?: BetCardPayload | null;
  isSystem: boolean;
  isReported: boolean;
  createdAt: string;
}

interface SyndicateChatProps {
  syndicateId: string;
  syndicateName?: string;
  currentUserId?: string;
  currentUsername?: string;
  className?: string;
}

export default function SyndicateChat({
  syndicateId,
  syndicateName = "Syndicate Chat",
  currentUserId,
  currentUsername = "You",
  className = "",
}: SyndicateChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  // Moderation states
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [showReportedMessages, setShowReportedMessages] = useState<boolean>(false);
  const [showModerationModal, setShowModerationModal] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Bet sharing state
  const [showShareBetModal, setShowShareBetModal] = useState<boolean>(false);
  const [betCardForm, setBetCardForm] = useState<{
    eventName: string;
    selection: string;
    odds: string;
    stake: string;
    eventType: string;
    betType: string;
    notes: string;
  }>({
    eventName: "Flemington Race 7",
    selection: "Thunderbolt",
    odds: "4.50",
    stake: "50.00",
    eventType: "race",
    betType: "WIN",
    notes: "Top speed figures from ML engine",
  });

  // Tailing bet states (betId -> status)
  const [tailingBets, setTailingBets] = useState<Record<string, "loading" | "success" | "error">>({});

  const chatFeedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat feed
  const scrollToBottom = useCallback(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, []);

  // Fetch initial chat history
  const fetchHistory = useCallback(async () => {
    if (!syndicateId) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      const res = await fetch(`${API_BASE}/chat/${syndicateId}?limit=50`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("betmate_token") || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load chat (${res.status})`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages([]);
      }
    } catch (err: any) {
      console.error("Error fetching chat history:", err);
      setIsError(true);
      setErrorMessage(err.message || "Unable to connect to syndicate chat");
    } finally {
      setIsLoading(false);
    }
  }, [syndicateId, scrollToBottom]);

  // Connect to SSE stream for real-time messages
  useEffect(() => {
    fetchHistory();

    if (!syndicateId) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE}/chat/${syndicateId}/stream`);

      eventSource.addEventListener("message", (e: MessageEvent) => {
        try {
          const newMsg: ChatMessage = JSON.parse(e.data);
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 50);
        } catch {
          // Ignore parsing error
        }
      });

      eventSource.addEventListener("moderation", (e: MessageEvent) => {
        try {
          const mod = JSON.parse(e.data);
          if (mod.action === "reported") {
            setMessages((prev) =>
              prev.map((m) => (m.id === mod.messageId ? { ...m, isReported: true } : m))
            );
          }
        } catch {
          // Ignore
        }
      });
    } catch (err) {
      console.warn("SSE connection unestablished, falling back to polling:", err);
    }

    // Polling backup interval every 8 seconds
    const interval = setInterval(() => {
      fetchHistory();
    }, 8000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [syndicateId, fetchHistory, scrollToBottom]);

  // Send message or bet card
  const handleSendMessage = async (e?: React.FormEvent, betPayloadCustom?: BetCardPayload) => {
    if (e) e.preventDefault();

    if (!inputText.trim() && !betPayloadCustom) return;

    setIsSending(true);
    setActionSuccessMessage(null);

    try {
      const token = localStorage.getItem("betmate_token") || "";
      const res = await fetch(`${API_BASE}/chat/${syndicateId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: inputText,
          betPayload: betPayloadCustom || null,
        }),
      });

      if (!res.ok) {
        const errData = await safeResponseJson(res);
        throw new Error(errData?.error || "Failed to send message");
      }

      const data = await res.json();
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setInputText("");
        setShowShareBetModal(false);
        setTimeout(scrollToBottom, 50);
      }
    } catch (err: any) {
      console.error("Send message error:", err);
      setActionSuccessMessage(`Error: ${err.message || "Failed to send"}`);
    } finally {
      setIsSending(false);
    }
  };

  // Report message handler
  const handleReportMessage = async (messageId: string) => {
    try {
      const token = localStorage.getItem("betmate_token") || "";
      const res = await fetch(`${API_BASE}/chat/messages/${messageId}/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isReported: true } : m))
        );
        setActionSuccessMessage("Message reported for moderation");
        setTimeout(() => setActionSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error("Report error:", err);
    }
  };

  // Block user handler
  const handleBlockUser = (userId: string, username: string) => {
    if (blockedUserIds.includes(userId)) return;
    setBlockedUserIds((prev) => [...prev, userId]);
    setActionSuccessMessage(`Blocked updates from @${username}`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleUnblockUser = (userId: string) => {
    setBlockedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  // Tail bet handler
  const handleTailBet = async (messageId: string, betCard: BetCardPayload) => {
    setTailingBets((prev) => ({ ...prev, [messageId]: "loading" }));

    try {
      const token = localStorage.getItem("betmate_token") || "";
      const res = await fetch(`${API_BASE}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType: betCard.eventType || "race",
          eventId: betCard.eventId || `evt_${Date.now()}`,
          eventName: betCard.eventName,
          betType: betCard.betType || "WIN",
          selection: betCard.selection,
          odds: Number(betCard.odds),
          stake: Number(betCard.stake),
          wasAIRecommended: !!betCard.wasAIRecommended,
          notes: `Tailed bet from syndicate chat (${syndicateName})`,
        }),
      });

      if (!res.ok) {
        const errData = await safeResponseJson(res);
        throw new Error(errData?.error || "Failed to tail bet");
      }

      setTailingBets((prev) => ({ ...prev, [messageId]: "success" }));
      setActionSuccessMessage(`Paper bet placed: ${betCard.selection} @ $${betCard.odds.toFixed(2)}`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Tail bet error:", err);
      setTailingBets((prev) => ({ ...prev, [messageId]: "error" }));
    }
  };

  // Helper for role badge UI
  const renderRoleBadge = (role?: string) => {
    const r = (role || "").toUpperCase();
    if (r === "OWNER") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
          <Crown className="w-2.5 h-2.5" /> Owner
        </span>
      );
    }
    if (r === "ADMIN") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">
          <ShieldCheck className="w-2.5 h-2.5" /> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
        <User className="w-2.5 h-2.5" /> Member
      </span>
    );
  };

  // Visible messages filtering
  const visibleMessages = messages.filter((m) => {
    if (blockedUserIds.includes(m.userId)) return false;
    if (m.isReported && !showReportedMessages) return false;
    return true;
  });

  return (
    <div
      className={`flex flex-col h-[600px] w-full bg-slate-950/90 border border-slate-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              {syndicateName}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Feed
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Syndicate group chat & automated paper bet sharing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareBetModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg transition-all"
            title="Share a paper bet placement card"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Share Bet Card</span>
          </button>

          <button
            onClick={() => setShowModerationModal(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors"
            title="Moderation & Blocked Users"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={fetchHistory}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionSuccessMessage && (
        <div className="px-4 py-2 bg-emerald-950/90 border-b border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {actionSuccessMessage}
          </span>
          <button onClick={() => setActionSuccessMessage(null)}>
            <X className="w-3.5 h-3.5 text-emerald-400 hover:text-emerald-200" />
          </button>
        </div>
      )}

      {/* Chat Messages Feed Area */}
      <div
        ref={chatFeedRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <p className="text-xs">Loading syndicate messages...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-rose-400 space-y-3 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <div>
              <p className="text-sm font-semibold">Failed to load chat feed</p>
              <p className="text-xs text-slate-400 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={fetchHistory}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 p-8 text-center">
            <div className="p-3 rounded-full bg-slate-800/80 border border-slate-700/50">
              <MessageSquare className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">No syndicate messages yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Be the first to post a message or share a paper bet placement card with your team!
              </p>
            </div>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isSelf = msg.userId === currentUserId;

            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isSelf ? "items-end" : "items-start"} space-y-1`}
              >
                {/* Header line: username, role, timestamp & action buttons */}
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {isSelf ? "You" : msg.username}
                  </span>
                  {renderRoleBadge(msg.userRole)}
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {/* Moderation popover triggers */}
                  {!isSelf && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleReportMessage(msg.id)}
                        className="p-0.5 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Report inappropriate message"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleBlockUser(msg.userId, msg.username)}
                        className="p-0.5 text-slate-400 hover:text-amber-400 transition-colors"
                        title="Block user messages"
                      >
                        <UserX className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Text Bubble */}
                {msg.text && (
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-md ${
                      msg.isReported
                        ? "bg-rose-950/40 border border-rose-800/60 text-rose-300 italic"
                        : isSelf
                        ? "bg-emerald-600 text-white rounded-tr-none"
                        : "bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-tl-none"
                    }`}
                  >
                    {msg.isReported ? "[Message reported for moderation]" : msg.text}
                  </div>
                )}

                {/* Paper Bet Placement Card */}
                {msg.betPayload && (
                  <div className="max-w-[90%] w-[320px] p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/30 shadow-xl space-y-2.5 my-1">
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Paper Bet Shared</span>
                      </div>
                      {msg.betPayload.wasAIRecommended && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                          <Sparkles className="w-2.5 h-2.5" /> AI Signal
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">{msg.betPayload.eventName}</div>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-sm font-bold text-slate-100">
                          {msg.betPayload.selection}
                        </span>
                        <span className="text-sm font-black text-amber-400">
                          ${msg.betPayload.odds.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                      <span>Stake: ${msg.betPayload.stake.toFixed(2)}</span>
                      <span>Type: {msg.betPayload.betType}</span>
                    </div>

                    {msg.betPayload.notes && (
                      <p className="text-[11px] text-slate-400 italic">
                        "{msg.betPayload.notes}"
                      </p>
                    )}

                    {/* Tail Bet Action */}
                    <button
                      onClick={() => handleTailBet(msg.id, msg.betPayload!)}
                      disabled={tailingBets[msg.id] === "loading" || tailingBets[msg.id] === "success"}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                        tailingBets[msg.id] === "success"
                          ? "bg-emerald-600 text-white cursor-default"
                          : tailingBets[msg.id] === "error"
                          ? "bg-rose-600 hover:bg-rose-500 text-white"
                          : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                      }`}
                    >
                      {tailingBets[msg.id] === "loading" ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Placing Tail Bet...</span>
                        </>
                      ) : tailingBets[msg.id] === "success" ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Bet Tailed!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Tail Bet (${msg.betPayload.stake.toFixed(2)})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={(e) => handleSendMessage(e)}
        className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message to your syndicate..."
          className="flex-1 px-3.5 py-2 text-xs bg-slate-950 text-slate-100 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500/60 placeholder-slate-500"
        />

        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center shadow-lg"
          title="Send message"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {/* Share Bet Placement Card Modal */}
      {showShareBetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                Share Bet Placement Card
              </h4>
              <button
                onClick={() => setShowShareBetModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Event Name</label>
                <input
                  type="text"
                  value={betCardForm.eventName}
                  onChange={(e) =>
                    setBetCardForm({ ...betCardForm, eventName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Flemington Race 7"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Selection</label>
                  <input
                    type="text"
                    value={betCardForm.selection}
                    onChange={(e) =>
                      setBetCardForm({ ...betCardForm, selection: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Thunderbolt"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Odds ($)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={betCardForm.odds}
                    onChange={(e) =>
                      setBetCardForm({ ...betCardForm, odds: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Stake ($)</label>
                  <input
                    type="number"
                    step="5"
                    value={betCardForm.stake}
                    onChange={(e) =>
                      setBetCardForm({ ...betCardForm, stake: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Bet Type</label>
                  <select
                    value={betCardForm.betType}
                    onChange={(e) =>
                      setBetCardForm({ ...betCardForm, betType: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="WIN">WIN</option>
                    <option value="PLACE">PLACE</option>
                    <option value="EACH_WAY">EACH WAY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Rationale</label>
                <input
                  type="text"
                  value={betCardForm.notes}
                  onChange={(e) =>
                    setBetCardForm({ ...betCardForm, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="Optional commentary..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setShowShareBetModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleSendMessage(undefined, {
                    eventType: betCardForm.eventType,
                    eventId: `evt_${Date.now()}`,
                    eventName: betCardForm.eventName,
                    selection: betCardForm.selection,
                    odds: Number(betCardForm.odds) || 1.0,
                    stake: Number(betCardForm.stake) || 10,
                    betType: betCardForm.betType,
                    notes: betCardForm.notes,
                  })
                }
                disabled={isSending}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Broadcast Bet Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Settings Modal */}
      {showModerationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                Chat Moderation & Filtering
              </h4>
              <button
                onClick={() => setShowModerationModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200">Show Reported Messages</div>
                  <div className="text-slate-400 text-[11px]">
                    Display messages flagged for moderation review
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showReportedMessages}
                  onChange={(e) => setShowReportedMessages(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
              </div>

              <div>
                <h5 className="font-semibold text-slate-300 mb-2">
                  Blocked Users ({blockedUserIds.length})
                </h5>
                {blockedUserIds.length === 0 ? (
                  <p className="text-slate-500 text-[11px] italic bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    No users currently blocked.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {blockedUserIds.map((uid) => (
                      <div
                        key={uid}
                        className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800"
                      >
                        <span className="font-mono text-slate-300">{uid}</span>
                        <button
                          onClick={() => handleUnblockUser(uid)}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => setShowModerationModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
