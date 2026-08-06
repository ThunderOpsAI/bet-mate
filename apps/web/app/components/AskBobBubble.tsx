"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Send, X, Loader2, Brain } from "lucide-react";
import { ML_API } from "../lib/mlApi";
import { safeResponseJson } from "../lib/api";

export default function AskBobBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([
    {
      role: "assistant",
      content:
        "Hey! I'm Bob, your AI strategy assistant. Ask me anything about today's card, why bets qualified or were skipped, profile differences, bankroll allocation, and paper-bet context.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Custom event listener for external open triggers (e.g. mobile bottom nav)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-ask-bob", handleOpen);
    return () => window.removeEventListener("open-ask-bob", handleOpen);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setError(null);

    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const payloadMessages = updatedMessages.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      }));

      const res = await fetch(`${ML_API}/api/bob/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: payloadMessages,
        }),
      });

      const data = await safeResponseJson(res);
      if (!res.ok || !data) {
        throw new Error("Chat request failed");
      }

      const reply = data?.message ?? "Bob is thinking, but didn't say anything.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: reply,
        },
      ]);
    } catch (err) {
      console.error("Ask Bob error:", err);
      setError("Bob failed to respond. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: "Sorry, I had some trouble connecting to my prediction engine.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="ask-bob-backdrop fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="ask-bob-panel w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden relative"
        style={{ position: "relative", bottom: "auto", right: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ask-bob-panel-header flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <div className="ask-bob-panel-title-area flex items-center gap-3">
            <div className="ask-bob-header-avatar-container relative w-8 h-8 rounded-full overflow-hidden border border-emerald-500/30">
              <Image
                src="/brand/betmate-bob-original.png"
                alt="Bob"
                fill
                sizes="32px"
                className="ask-bob-header-avatar object-cover"
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">Ask Bob</h4>
              <div className="ask-bob-status-indicator flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="live-dot w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>AI Strategy Assistant</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="ask-bob-panel-close p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="ask-bob-panel-body flex-1 overflow-y-auto p-4 space-y-3">
          <div className="ask-bob-welcome-card flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            <Brain size={16} className="welcome-icon flex-shrink-0 mt-0.5" />
            <p>
              Ask me about today&apos;s models, qualifying picks, skipped
              races, or risk allocation strategy!
            </p>
          </div>

          <div className="ask-bob-messages-list space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`ask-bob-msg-bubble flex gap-2.5 text-xs leading-relaxed ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="msg-avatar-container relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5 border border-slate-700">
                    <Image
                      src="/brand/betmate-bob-original.png"
                      alt="Bob"
                      fill
                      sizes="24px"
                      className="msg-avatar object-cover"
                    />
                  </div>
                )}
                <div
                  className={`msg-text-content max-w-[80%] p-3 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-xs"
                      : "bg-slate-800 text-slate-200 rounded-bl-xs border border-slate-700/60"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ask-bob-msg-bubble flex gap-2.5 justify-start text-xs">
                <div className="msg-avatar-container relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5 border border-slate-700">
                  <Image
                    src="/brand/betmate-bob-original.png"
                    alt="Bob"
                    fill
                    sizes="24px"
                    className="msg-avatar object-cover"
                  />
                </div>
                <div className="msg-text-content bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-bl-xs border border-slate-700/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {error && (
              <div className="ask-bob-error-notice text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-center">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer Input */}
        <form onSubmit={handleSendMessage} className="ask-bob-panel-footer p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Why did Cats qualify today?"
            className="ask-bob-input flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            disabled={loading}
            maxLength={200}
          />
          <button
            type="submit"
            className="ask-bob-send-btn p-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-all"
            disabled={!inputValue.trim() || loading}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

