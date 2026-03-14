"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("betmate_token");
    const savedUser = localStorage.getItem("betmate_user");
    if (saved && savedUser) {
      setToken(saved);
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
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
    const res = await fetch(`${API}/auth/register`, {
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
    setUser(null);
    setToken(null);
    localStorage.removeItem("betmate_token");
    localStorage.removeItem("betmate_user");
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/user/profile`, {
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
