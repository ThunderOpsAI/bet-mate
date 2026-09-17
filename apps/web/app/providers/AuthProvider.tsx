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
  emailConfirmed: boolean;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    startingBankroll: number,
    marketingOptIn?: boolean
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateBankroll: (delta: number) => void;
  resendConfirmationEmail: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const GUEST_USER: User = {
  id: "guest",
  email: "guest@betmate.local",
  username: "Guest",
  currentBankroll: 250,
  emailConfirmed: true,
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
        const normalizedUser: User = {
          ...parsedUser,
          emailConfirmed: parsedUser.emailConfirmed ?? true,
        };
        setToken(storedToken);
        setUser(normalizedUser);
        identifyUser(normalizedUser.id, {
          username: normalizedUser.username,
          email: normalizedUser.email,
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
      const err = new Error(data?.error || "Login failed") as Error & { requireConfirmation?: boolean; email?: string };
      if (data?.requireConfirmation) {
        err.requireConfirmation = true;
        err.email = data.email;
      }
      throw err;
    }
    const userData: User = {
      ...data.user,
      emailConfirmed: data.user.emailConfirmed ?? true,
    };
    setUser(userData);
    setToken(data.accessToken);
    localStorage.setItem("betmate_token", data.accessToken);
    localStorage.setItem("betmate_user", JSON.stringify(userData));

    identifyUser(userData.id, {
      username: userData.username,
      email: userData.email,
    });
    trackEvent(ANALYTICS_EVENTS.USER_LOGGED_IN, {
      userId: userData.id,
      username: userData.username,
    });
  }, []);

  const register = useCallback(
    async (
      email: string,
      username: string,
      password: string,
      startingBankroll: number,
      marketingOptIn: boolean = false
    ) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, startingBankroll, marketingOptIn }),
      });
      const data = await safeResponseJson(res);
      if (!res.ok || !data) {
        throw new Error(data?.error || "Registration failed");
      }
      return data;
    },
    []
  );

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
          const userData: User = {
            ...data.user,
            emailConfirmed: data.user.emailConfirmed ?? false,
          };
          setUser(userData);
          localStorage.setItem("betmate_user", JSON.stringify(userData));
        }
      }
    } catch { /* ignore */ }
  }, [token]);

  const updateBankroll = useCallback((delta: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const newBankroll = Math.max(0, Math.round(((prev.currentBankroll || 0) + delta) * 100) / 100);
      const updated = { ...prev, currentBankroll: newBankroll };
      try {
        localStorage.setItem("betmate_user", JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const resendConfirmationEmail = useCallback(async () => {
    if (!token || token === GUEST_TOKEN) return;
    const res = await fetch(`${API_BASE}/auth/resend-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await safeResponseJson(res);
    if (!res.ok) {
      throw new Error(data?.error || "Failed to resend confirmation email");
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        updateBankroll,
        resendConfirmationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
