"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { Bot, Brain, TrendingUp, Wallet } from "lucide-react";
import PaperBetAction from "../components/PaperBetAction";
import GuestModal from "../components/GuestModal";
import { useAuth } from "../providers/AuthProvider";
import { ML_API } from "../lib/mlApi";
import { safeResponseJson } from "../lib/api";

type SystemBet = {
  id?: number;
  sport: string;
  event_id: string;
  event_name: string;
  market_type: string;
  selection: string;
  odds_used: number;
  odds_source: string;
  edge: number;
  stake: number;
  status?: string;
  model_probability?: number;
  legs?: Array<{
    sport: string;
    event_id: string;
    event_name: string;
    market_type: string;
    selection: string;
    odds_used: number;
    odds_source: string;
  }>;
};

type StrategyCard = {
  profile_key: string;
  display_name: string;
  card_date: string;
  bankroll_available: number;
  total_allocated: number;
  selected_bets: SystemBet[];
  skipped_opportunities: Array<{
    selection: string;
    event_name: string;
    reason: string;
    edge: number;
  }>;
  sport_mix: Record<string, number>;
  expected_edge: number;
  performance: {
    roi: number;
    net_profit: number;
    settled_bets: number;
  } | null;
};

export default function StrategyPage() {
  const { user } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [cards, setCards] = useState<StrategyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${ML_API}/api/strategy-cards`);
        const data = await safeResponseJson(response);
        if (!response.ok || !data) {
          throw new Error("Strategy cards unavailable");
        }
        setCards(data?.cards ?? []);
      } catch (error) {
        console.error("Failed to load strategy cards", error);
        setLoadError("BetMate could not load the latest strategy cards.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function handleBobChat(event: FormEvent) {
    event.preventDefault();
    if (!chatInput.trim()) return;
    if (!user || user.id === "guest") {
      setShowGuestModal(true);
      return;
    }
    setChatLoading(true);
    try {
      const response = await fetch(`${ML_API}/api/bob/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: chatInput }],
        }),
      });
      const data = await safeResponseJson(response);
      setChatReply(data?.message ?? "No response");
    } catch (error) {
      console.error("Bob chat failed", error);
      setChatReply("Bob is unavailable right now.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div>
      <div className="section-header">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bot size={18} /> Daily Strategy Cards
        </h3>
      </div>

      {loading ? (
        <div className="card">Loading strategy cards...</div>
      ) : loadError ? (
        <div className="card">{loadError}</div>
      ) : cards.length === 0 ? (
        <div className="card">No strategy cards are available yet for today.</div>
      ) : (
        <div className="predictions-grid">
          {cards.map((card) => (
            <div key={card.profile_key} className="prediction-card">
              <div className="prediction-card-header">
                <div>
                  <span className="prediction-venue">{card.display_name}</span>
                  <span className="prediction-race">{card.card_date}</span>
                </div>
                <span className="badge badge-accent">{card.selected_bets.length} bets</span>
              </div>
              <div style={{ display: "grid", gap: "0.65rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
                  <span className="badge badge-muted"><Wallet size={12} /> ${card.total_allocated.toFixed(2)} / ${card.bankroll_available.toFixed(2)}</span>
                  <span className="badge badge-blue"><TrendingUp size={12} /> Edge {Math.round(card.expected_edge * 1000) / 10}%</span>
                  {card.performance && (
                    <span className="badge badge-accent">ROI {Math.round(card.performance.roi * 1000) / 10}%</span>
                  )}
                </div>

                <div className="prediction-picks">
                  {card.selected_bets.map((bet) => (
                    <div key={`${bet.event_id}-${bet.selection}-${bet.market_type}`} style={{ display: "grid", gap: "0.55rem" }}>
                      <div className="prediction-pick-row">
                        <div className="prediction-pick-left">
                          <span className="pick-rank rank-1">{bet.sport.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <div className="prediction-horse-name">{bet.selection}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{bet.event_name} · {bet.market_type}</div>
                          </div>
                        </div>
                        <div className="prediction-pick-right">
                          <span className="prediction-prob">{bet.odds_used.toFixed(2)}</span>
                          <span className="prediction-odds">${bet.stake.toFixed(2)}</span>
                          <span className="badge badge-muted">{bet.odds_source}</span>
                        </div>
                      </div>
                      {supportsStrategyCopy(bet) ? (
                        <PaperBetAction
                          variant="phase1"
                          label="Copy to bet slip"
                          loggedLabel="Copied to bet slip"
                          cancelLabel="Remove from slip"
                          fullWidth
                          bet={{
                            sport: bet.sport,
                            event_id: bet.event_id,
                            event_name: bet.event_name,
                            selection: bet.selection,
                            odds: bet.odds_used,
                            bet_type: bet.market_type,
                            stake: bet.stake,
                            notes: JSON.stringify({
                              strategy_name: card.display_name,
                              confidence: deriveStrategyConfidence(bet.edge),
                              snapshot: {
                                edge: `${Math.round(bet.edge * 1000) / 10}%`,
                                odds_source: bet.odds_source,
                                profile: card.profile_key,
                              },
                            }),
                            odds_source: bet.odds_source === "live_market" ? "market" : "model_fair",
                          }}
                        />
                      ) : (
                        <div className="badge badge-muted">Multi bets stay visible here and in analytics, but they are not copyable to the bet slip yet.</div>
                      )}
                    </div>
                  ))}
                </div>

                {card.skipped_opportunities.length > 0 && (
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Skipped: {card.skipped_opportunities.slice(0, 2).map((item) => `${item.selection} (${item.reason})`).join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="ask-bob-panel-header">
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem" }}>
              <Brain size={18} /> Ask Bob About Today&apos;s Card
            </h3>
            <p className="muted-copy">
              Ask for the reasoning behind today&apos;s strategy card and get a plain-English read before you log anything.
            </p>
          </div>
          <div className="ask-bob-panel-art" aria-hidden="true">
            <Image
              src="/brand/betmate-bob-original.png"
              alt=""
              fill
              sizes="160px"
              className="ask-bob-panel-art-image"
            />
          </div>
        </div>
        <form onSubmit={handleBobChat}>
          <div className="form-group">
            <label className="form-label">Question</label>
            <input
              className="form-input"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Why did Bob qualify Cats head-to-head?"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={chatLoading}>
            {chatLoading ? "Thinking..." : "Ask Bob"}
          </button>
        </form>
        {chatReply && (
          <div className="ai-insight-card" style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
            <Brain size={16} />
            <span>{chatReply}</span>
          </div>
        )}
      </div>
      <GuestModal open={showGuestModal} onClose={() => setShowGuestModal(false)} />
    </div>
  );
}

function supportsStrategyCopy(bet: SystemBet) {
  return bet.sport !== "multi" && bet.market_type !== "multi" && !bet.legs?.length;
}

function deriveStrategyConfidence(edge: number) {
  if (edge >= 0.12) return "High";
  if (edge >= 0.06) return "Medium";
  return "Measured";
}
