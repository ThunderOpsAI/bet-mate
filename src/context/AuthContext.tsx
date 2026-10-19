import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  username: string;
  currentBankroll: number;
  startingBaseline: number;
}

interface AuthContextType {
  user: User;
  token: string | null;
  isLoading: boolean;
  login: (email: string, username?: string) => void;
  logout: () => void;
  updateBankroll: (delta: number) => void;
  resetBankroll: (customAmount?: number) => void;
}

const DEFAULT_BASELINE = 10000;

const DEFAULT_USER: User = {
  id: "user_punter_01",
  email: "trader@betmate.ai",
  username: "Alex Trader",
  currentBankroll: 10480.00,
  startingBaseline: DEFAULT_BASELINE,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    try {
      const stored = localStorage.getItem("betmate_user_profile");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return DEFAULT_USER;
  });

  const [token, setToken] = useState<string | null>("token_demo_session");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("betmate_user_profile", JSON.stringify(user));
    } catch {}
  }, [user]);

  const login = useCallback((email: string, username?: string) => {
    const updated: User = {
      ...user,
      email,
      username: username || email.split("@")[0] || "Trader",
    };
    setUser(updated);
  }, [user]);

  const logout = useCallback(() => {
    setUser({
      id: "guest",
      email: "guest@betmate.local",
      username: "Guest Punter",
      currentBankroll: 10000,
      startingBaseline: 10000,
    });
  }, []);

  const updateBankroll = useCallback((delta: number) => {
    setUser((prev) => {
      const newBankroll = Math.max(0, Math.round(((prev.currentBankroll || 0) + delta) * 100) / 100);
      return { ...prev, currentBankroll: newBankroll };
    });
  }, []);

  const resetBankroll = useCallback((customAmount: number = DEFAULT_BASELINE) => {
    setUser((prev) => ({
      ...prev,
      currentBankroll: customAmount,
      startingBaseline: customAmount,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        updateBankroll,
        resetBankroll,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
