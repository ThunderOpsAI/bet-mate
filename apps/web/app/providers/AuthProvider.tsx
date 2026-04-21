"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { API_BASE } from "../lib/api";

type User = {
  id: string;
  email: string;
  username: string;
  currentBankroll: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, startingBankroll: number) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const GUEST_USER: User = {
  id: "guest",
  email: "guest@betmate.local",
  username: "Guest",
  currentBankroll: 250,
};

const GUEST_TOKEN = "guest";

function persistGuestSession() {
  localStorage.setItem("betmate_token", GUEST_TOKEN);
  localStorage.setItem("betmate_user", JSON.stringify(GUEST_USER));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setToken(GUEST_TOKEN);
    setUser(GUEST_USER);
    persistGuestSession();
    setIsLoading(false);
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUsername, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem("betmate_token", data.accessToken);
    localStorage.setItem("betmate_user", JSON.stringify(data.user));
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, startingBankroll: number) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password, startingBankroll }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Registration failed");
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem("betmate_token", data.accessToken);
    localStorage.setItem("betmate_user", JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setUser(GUEST_USER);
    setToken(GUEST_TOKEN);
    persistGuestSession();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token || token === GUEST_TOKEN) return;
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem("betmate_user", JSON.stringify(data.user));
      }
    } catch { /* ignore */ }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
