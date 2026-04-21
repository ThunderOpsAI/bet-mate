"use client";

export const PAPER_BETSLIP_STORAGE_KEY = "paper_betslip";
export const PAPER_BETSLIP_OPEN_STORAGE_KEY = "paper_betslip_open";

export interface PersistedPaperBet {
  id: string;
  sport: string;
  event_id: string;
  event_name: string;
  bet_type: string;
  selection: string;
  odds?: number;
  stake: number;
  notes?: string;
  added_at?: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPersistedBetslip(): PersistedPaperBet[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PAPER_BETSLIP_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedPaperBet[]) : [];
  } catch (error) {
    console.error("Failed to load paper betslip from localStorage", error);
    return [];
  }
}

export function savePersistedBetslip(bets: PersistedPaperBet[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(PAPER_BETSLIP_STORAGE_KEY, JSON.stringify(bets));
  } catch (error) {
    console.error("Failed to save paper betslip to localStorage", error);
  }
}

export function clearPersistedBetslip() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PAPER_BETSLIP_STORAGE_KEY);
}

export function loadPersistedBetslipOpen() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(PAPER_BETSLIP_OPEN_STORAGE_KEY) === "true";
}

export function savePersistedBetslipOpen(isOpen: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PAPER_BETSLIP_OPEN_STORAGE_KEY, String(isOpen));
}

export function subscribeToBetslipStorage(
  onChange: (bets: PersistedPaperBet[], isOpen: boolean) => void,
) {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== PAPER_BETSLIP_STORAGE_KEY &&
      event.key !== PAPER_BETSLIP_OPEN_STORAGE_KEY
    ) {
      return;
    }

    onChange(loadPersistedBetslip(), loadPersistedBetslipOpen());
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
