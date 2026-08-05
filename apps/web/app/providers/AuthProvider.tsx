"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { API_BASE, safeResponseJson } from "../lib/api";
import {
  ANALYTICS_EVENTS,
  identifyUser,
  resetUser,
  trackEvent,
} from "../lib/analytics";

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
    try {
      const storedToken = localStorage.getItem("betmate_token");
      const storedUser = localStorage.getItem("betmate_user");

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as User;
        setToken(storedToken);
        setUser(parsedUser);
        identifyUser(parsedUser.id, {
          username: parsedUser.username,
          email: parsedUser.email,
        });
      } else {
        setToken(GUEST_TOKEN);
        setUser(GUEST_USER);
        persistGuestSession();
      }
    } catch {
      setToken(GUEST_TOKEN);
      setUser(GUEST_USER);
      persistGuestSession();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUsername, password }),
    });
    const data = await safeResponseJson(res);
    if (!res.ok || !data) {
      throw new Error(data?.error || "Login failed");
    }
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem("betmate_token", data.accessToken);
    localStorage.setItem("betmate_user", JSON.stringify(data.user));

    identifyUser(data.user.id, {
      username: data.user.username,
      email: data.user.email,
    });
    trackEvent(ANALYTICS_EVENTS.USER_LOGGED_IN, {
      userId: data.user.id,
      username: data.user.username,
    });
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, startingBankroll: number) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password, startingBankroll }),
    });
    const data = await safeResponseJson(res);
    if (!res.ok || !data) {
      throw new Error(data?.error || "Registration failed");
    }
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem("betmate_token", data.accessToken);
    localStorage.setItem("betmate_user", JSON.stringify(data.user));

    identifyUser(data.user.id, {
      username: data.user.username,
      email: data.user.email,
    });
    trackEvent(ANALYTICS_EVENTS.USER_REGISTERED, {
      userId: data.user.id,
      username: data.user.username,
      startingBankroll,
    });
  }, []);

  const logout = useCallback(() => {
    if (user && user.id !== "guest") {
      trackEvent(ANALYTICS_EVENTS.USER_LOGGED_OUT, { userId: user.id });
    }
    setUser(GUEST_USER);
    setToken(GUEST_TOKEN);
    persistGuestSession();
    resetUser();
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!token || token === GUEST_TOKEN) return;
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await safeResponseJson(res);
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem("betmate_user", JSON.stringify(data.user));
        }
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
