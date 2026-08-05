"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Send, X, Loader2, Brain } from "lucide-react";
import { usePaperBetslip } from "../providers/PaperBetslipProvider";
import { ML_API } from "../lib/mlApi";
import { safeResponseJson } from "../lib/api";

export default function AskBobBubble() {
  const { bets, isBetslipOpen } = usePaperBetslip();
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Adjust placement depending on PaperBetslip visibility and status
  const getBubblePositionStyles = (): React.CSSProperties => {
    const isBetslipActive = bets.length > 0 || isBetslipOpen;

    if (!isBetslipActive) {
      return { bottom: "1.5rem", right: "1.5rem" };
    }

    if (isBetslipOpen) {
      // open betslip is 380px wide
      return { bottom: "1.5rem", right: "27rem" };
    }

    // collapsed betslip is ~180px wide
    return { bottom: "1.5rem", right: "15rem" };
  };

  const getPanelPositionStyles = (): React.CSSProperties => {
    const isBetslipActive = bets.length > 0 || isBetslipOpen;

    if (!isBetslipActive) {
      return { bottom: "6.5rem", right: "1.5rem" };
    }

    if (isBetslipOpen) {
      return { bottom: "6.5rem", right: "27rem" };
    }

    return { bottom: "6.5rem", right: "15rem" };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setError(null);

    // Append user message
    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Map role to what the Bob API expects ("user" / "assistant")
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

  return (
    <>
      {/* Floating Bob Bubble Button */}
      <button
        type="button"
        className={`ask-bob-bubble-btn ${isOpen ? "active" : ""}`}
        style={getBubblePositionStyles()}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask Bob AI Strategy Assistant"
      >
        <div className="ask-bob-bubble-avatar-container">
          <Image
            src="/brand/betmate-bob-original.png"
            alt="Bob"
            fill
            sizes="48px"
            className="ask-bob-bubble-avatar"
            priority
          />
        </div>
        <span className="ask-bob-bubble-status-dot" />
        <div className="ask-bob-bubble-glow" />
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="ask-bob-panel" style={getPanelPositionStyles()}>
          {/* Header */}
          <div className="ask-bob-panel-header">
            <div className="ask-bob-panel-title-area">
              <div className="ask-bob-header-avatar-container">
                <Image
                  src="/brand/betmate-bob-original.png"
                  alt="Bob"
                  fill
                  sizes="32px"
                  className="ask-bob-header-avatar"
                />
              </div>
              <div>
                <h4>Ask Bob</h4>
                <div className="ask-bob-status-indicator">
                  <span className="live-dot" />
                  <span>AI Strategy Assistant</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="ask-bob-panel-close"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="ask-bob-panel-body">
            <div className="ask-bob-welcome-card">
              <Brain size={16} className="welcome-icon" />
              <p>
                Ask me about today&apos;s models, qualifying picks, skipped
                races, or risk allocation strategy!
              </p>
            </div>

            <div className="ask-bob-messages-list">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`ask-bob-msg-bubble ${
                    msg.role === "user" ? "user-msg" : "bob-msg"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="msg-avatar-container">
                      <Image
                        src="/brand/betmate-bob-original.png"
                        alt="Bob"
                        fill
                        sizes="24px"
                        className="msg-avatar"
                      />
                    </div>
                  )}
                  <div className="msg-text-content">{msg.content}</div>
                </div>
              ))}

              {loading && (
                <div className="ask-bob-msg-bubble bob-msg typing">
                  <div className="msg-avatar-container">
                    <Image
                      src="/brand/betmate-bob-original.png"
                      alt="Bob"
                      fill
                      sizes="24px"
                      className="msg-avatar"
                    />
                  </div>
                  <div className="msg-text-content typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              {error && <div className="ask-bob-error-notice">{error}</div>}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Footer Input */}
          <form onSubmit={handleSendMessage} className="ask-bob-panel-footer">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Why did Cats qualify today?"
              className="ask-bob-input"
              disabled={loading}
              maxLength={200}
            />
            <button
              type="submit"
              className="ask-bob-send-btn"
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
      )}
    </>
  );
}
