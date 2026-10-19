import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Syndicate } from "../types";
import { MOCK_SYNDICATES } from "../data/mockData";

interface SyndicateContextType {
  syndicates: Syndicate[];
  activeSyndicate: Syndicate | null;
  setActiveSyndicate: (syndicate: Syndicate | null) => void;
  createSyndicate: (name: string, buyInTier: number) => Syndicate;
  joinSyndicate: (code: string) => boolean;
  addSyndicateBet: (amount: number, description: string) => void;
}

const SyndicateContext = createContext<SyndicateContextType | undefined>(undefined);

export const SyndicateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syndicates, setSyndicates] = useState<Syndicate[]>(() => {
    try {
      const stored = localStorage.getItem("betmate_syndicates");
      return stored ? JSON.parse(stored) : MOCK_SYNDICATES;
    } catch {
      return MOCK_SYNDICATES;
    }
  });

  const [activeSyndicate, setActiveSyndicate] = useState<Syndicate | null>(syndicates[0] || null);

  useEffect(() => {
    try {
      localStorage.setItem("betmate_syndicates", JSON.stringify(syndicates));
    } catch {}
  }, [syndicates]);

  const createSyndicate = useCallback((name: string, buyInTier: number) => {
    const code = `BM-${Math.floor(10000 + Math.random() * 90000)}`;
    const newSyn: Syndicate = {
      id: `syn_${Date.now()}`,
      name,
      code,
      buy_in_tier: buyInTier,
      balance: buyInTier * 4,
      max_stake_limit: Math.round(buyInTier * 1.5),
      created_at: new Date().toISOString(),
      members: [
        {
          id: `m_${Date.now()}`,
          username: "You (Captain)",
          role: "OWNER",
          buy_in_amount: buyInTier * 2,
          joined_at: new Date().toISOString().split("T")[0],
        },
      ],
      ledgers: [
        {
          id: `l_${Date.now()}`,
          type: "BUY_IN",
          amount: buyInTier * 2,
          description: `Initial syndicate creation deposit ($${buyInTier * 2})`,
          created_at: new Date().toISOString().split("T")[0],
          author: "You",
        },
      ],
    };

    setSyndicates((prev) => [newSyn, ...prev]);
    setActiveSyndicate(newSyn);
    return newSyn;
  }, []);

  const joinSyndicate = useCallback((code: string): boolean => {
    const cleanCode = code.trim().toUpperCase();
    const found = syndicates.find((s) => s.code.toUpperCase() === cleanCode);
    if (found) {
      setActiveSyndicate(found);
      return true;
    }
    // Create new joined syndicate mock if matching pattern
    if (cleanCode.startsWith("BM-")) {
      const joined: Syndicate = {
        id: `syn_${Date.now()}`,
        name: "Private Friends Syndicate",
        code: cleanCode,
        buy_in_tier: 50,
        balance: 650.0,
        max_stake_limit: 75,
        created_at: new Date().toISOString(),
        members: [
          { id: "owner", username: "Host", role: "OWNER", buy_in_amount: 250, joined_at: "2026-09-01" },
          { id: "you", username: "You", role: "MEMBER", buy_in_amount: 100, joined_at: "Today" },
        ],
        ledgers: [
          { id: `l1`, type: "BUY_IN", amount: 100, description: "Joined syndicate with 2 buy-in shares", created_at: "Today", author: "You" },
        ],
      };
      setSyndicates((prev) => [joined, ...prev]);
      setActiveSyndicate(joined);
      return true;
    }
    return false;
  }, [syndicates]);

  const addSyndicateBet = useCallback((amount: number, description: string) => {
    if (!activeSyndicate) return;
    const entry = {
      id: `l_${Date.now()}`,
      type: "PAPER_BET" as const,
      amount: -amount,
      description,
      created_at: new Date().toISOString().split("T")[0],
      author: "You",
    };

    setSyndicates((prev) =>
      prev.map((s) => {
        if (s.id === activeSyndicate.id) {
          const updated = {
            ...s,
            balance: Math.max(0, s.balance - amount),
            ledgers: [entry, ...s.ledgers],
          };
          setActiveSyndicate(updated);
          return updated;
        }
        return s;
      })
    );
  }, [activeSyndicate]);

  return (
    <SyndicateContext.Provider
      value={{
        syndicates,
        activeSyndicate,
        setActiveSyndicate,
        createSyndicate,
        joinSyndicate,
        addSyndicateBet,
      }}
    >
      {children}
    </SyndicateContext.Provider>
  );
};

export const useSyndicates = () => {
  const context = useContext(SyndicateContext);
  if (!context) {
    throw new Error("useSyndicates must be used within a SyndicateProvider");
  }
  return context;
};
