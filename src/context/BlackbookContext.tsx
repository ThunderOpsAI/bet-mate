import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { BlackbookRule, SportCode } from "../types";
import { MOCK_BLACKBOOK_RULES } from "../data/mockData";

interface BlackbookContextType {
  rules: BlackbookRule[];
  addRule: (rule: Omit<BlackbookRule, "id" | "created_at" | "enabled">) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  isBookmarked: (targetName: string) => boolean;
  quickAdd: (targetName: string, entityType?: BlackbookRule["entity_type"], sport?: SportCode) => void;
}

const BlackbookContext = createContext<BlackbookContextType | undefined>(undefined);

export const BlackbookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rules, setRules] = useState<BlackbookRule[]>(() => {
    try {
      const stored = localStorage.getItem("betmate_blackbook_rules");
      return stored ? JSON.parse(stored) : MOCK_BLACKBOOK_RULES;
    } catch {
      return MOCK_BLACKBOOK_RULES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("betmate_blackbook_rules", JSON.stringify(rules));
    } catch {}
  }, [rules]);

  const addRule = useCallback((ruleData: Omit<BlackbookRule, "id" | "created_at" | "enabled">) => {
    const newRule: BlackbookRule = {
      ...ruleData,
      id: `bb_${Date.now()}`,
      created_at: new Date().toISOString(),
      enabled: true,
    };
    setRules((prev) => [newRule, ...prev]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }, []);

  const isBookmarked = useCallback(
    (targetName: string) => {
      return rules.some((r) => r.target_name.toLowerCase() === targetName.toLowerCase() && r.enabled);
    },
    [rules]
  );

  const quickAdd = useCallback(
    (targetName: string, entityType: BlackbookRule["entity_type"] = "RUNNER", sport: SportCode = "racing") => {
      setRules((prev) => {
        const exists = prev.find(
          (r) => r.target_name.toLowerCase() === targetName.toLowerCase()
        );
        if (exists) {
          // Toggle off if already present
          return prev.filter((r) => r.id !== exists.id);
        }
        const item: BlackbookRule = {
          id: `bb_${Date.now()}`,
          target_name: targetName,
          entity_type: entityType,
          sport,
          bet_type: "win",
          stake: 20,
          probability_threshold: 30,
          notes: `Quick-added ${entityType.toLowerCase()} to watch rules.`,
          created_at: new Date().toISOString(),
          enabled: true,
          alerts: { email: true, sms: false, push: true },
        };
        return [item, ...prev];
      });
    },
    []
  );

  return (
    <BlackbookContext.Provider
      value={{
        rules,
        addRule,
        removeRule,
        toggleRule,
        isBookmarked,
        quickAdd,
      }}
    >
      {children}
    </BlackbookContext.Provider>
  );
};

export const useBlackbook = () => {
  const context = useContext(BlackbookContext);
  if (!context) {
    throw new Error("useBlackbook must be used within a BlackbookProvider");
  }
  return context;
};
