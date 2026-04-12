"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  plan_tier: "free" | "solo" | "edge" | "admin";
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
};

type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  planTier: ProfileRow["plan_tier"];
  ageConfirmedAt: string | null;
  termsAcceptedAt: string | null;
  createdAt: string | null;
};

type ComplianceTimestamps = {
  ageConfirmedAt: string;
  termsAcceptedAt: string;
};

type RegisterResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  hasCompletedCompliance: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (complianceAccepted?: boolean) => Promise<void>;
  register: (email: string, displayName: string, password: string, startingBankroll: number) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: { displayName: string; email: string }) => Promise<void>;
  acceptCompliance: () => Promise<void>;
  declineCompliance: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const GOOGLE_COMPLIANCE_KEY = "betmate_google_compliance";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

function defaultDisplayName(user: SupabaseUser) {
  const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.name ?? user.user_metadata?.username;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return user.email?.split("@")[0] ?? "BetMate member";
}

function profileToUser(profile: ProfileRow, authUser: SupabaseUser): User {
  return {
    id: authUser.id,
    email: profile.email || authUser.email || "",
    username: profile.display_name,
    displayName: profile.display_name,
    planTier: profile.plan_tier,
    ageConfirmedAt: profile.age_confirmed_at,
    termsAcceptedAt: profile.terms_accepted_at,
    createdAt: profile.created_at,
  };
}

function readPendingGoogleCompliance(): ComplianceTimestamps | null {
  try {
    const raw = sessionStorage.getItem(GOOGLE_COMPLIANCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComplianceTimestamps;
    if (parsed.ageConfirmedAt && parsed.termsAcceptedAt) return parsed;
  } catch {
    // Ignore malformed session storage.
  }
  return null;
}

function clearPendingGoogleCompliance() {
  try {
    sessionStorage.removeItem(GOOGLE_COMPLIANCE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

async function ensureUserSettings(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client.from("user_settings").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return;

  const { error: insertError } = await client.from("user_settings").insert({
    user_id: userId,
    sports: ["racing", "afl", "nba"],
    risk_level: "balanced",
    max_stake: 25,
  });
  if (insertError) throw insertError;
}

async function ensureProfile(authUser: SupabaseUser, compliance?: ComplianceTimestamps): Promise<User> {
  const client = requireSupabase();
  const displayName = defaultDisplayName(authUser);
  const profileSelect = "id,email,display_name,plan_tier,age_confirmed_at,terms_accepted_at,created_at";
  const { data: existingProfile, error: existingError } = await client
    .from("profiles")
    .select(profileSelect)
    .eq("id", authUser.id)
    .maybeSingle();

  if (existingError) throw existingError;

  let profile: ProfileRow | null = existingProfile as ProfileRow | null;
  if (profile) {
    const updatePatch: Record<string, string> = {
      email: authUser.email ?? profile.email,
      display_name: profile.display_name || displayName,
    };

    if (compliance) {
      updatePatch.age_confirmed_at = compliance.ageConfirmedAt;
      updatePatch.terms_accepted_at = compliance.termsAcceptedAt;
    }

    const { data, error } = await client
      .from("profiles")
      .update(updatePatch)
      .eq("id", authUser.id)
      .select(profileSelect)
      .single();
    if (error) throw error;
    profile = data as ProfileRow;
  } else {
    const insertPatch: Record<string, string> = {
      id: authUser.id,
      email: authUser.email ?? "",
      display_name: displayName,
      plan_tier: "free",
    };

    if (compliance) {
      insertPatch.age_confirmed_at = compliance.ageConfirmedAt;
      insertPatch.terms_accepted_at = compliance.termsAcceptedAt;
    }

    const { data, error } = await client
      .from("profiles")
      .insert(insertPatch)
      .select(profileSelect)
      .single();
    if (error) throw error;
    profile = data as ProfileRow;
  }

  await ensureUserSettings(authUser.id);

  if (compliance) clearPendingGoogleCompliance();
  return profileToUser(profile, authUser);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const hydrateSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setAuthError(null);

    if (!nextSession?.user) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const pendingCompliance = readPendingGoogleCompliance();
      const hydratedUser = await ensureProfile(nextSession.user, pendingCompliance ?? undefined);
      setUser(hydratedUser);
    } catch (error) {
      console.error("Failed to load Supabase profile", error);
      setAuthError(error instanceof Error ? error.message : "Profile storage unavailable.");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError("Supabase auth is not configured for this environment.");
      setIsLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) void hydrateSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) void hydrateSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hydrateSession]);

  const login = useCallback(async (email: string, password: string) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await hydrateSession(data.session);
  }, [hydrateSession]);

  const loginWithGoogle = useCallback(async (complianceAccepted = false) => {
    const client = requireSupabase();
    if (complianceAccepted) {
      const now = new Date().toISOString();
      sessionStorage.setItem(
        GOOGLE_COMPLIANCE_KEY,
        JSON.stringify({ ageConfirmedAt: now, termsAcceptedAt: now })
      );
    } else {
      clearPendingGoogleCompliance();
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) throw error;
  }, []);

  const register = useCallback(async (
    email: string,
    displayName: string,
    password: string,
    startingBankroll: number
  ): Promise<RegisterResult> => {
    const client = requireSupabase();
    const now = new Date().toISOString();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          username: displayName,
          starting_bankroll: startingBankroll,
          plan_tier: "free",
          age_confirmed_at: now,
          terms_accepted_at: now,
        },
      },
    });
    if (error) throw error;

    if (!data.session) {
      return { requiresEmailConfirmation: true };
    }

    await hydrateSession(data.session);
    return { requiresEmailConfirmation: false };
  }, [hydrateSession]);

  const refreshUser = useCallback(async () => {
    const client = requireSupabase();
    const { data } = await client.auth.getSession();
    await hydrateSession(data.session);
  }, [hydrateSession]);

  const updateProfile = useCallback(async (updates: { displayName: string; email: string }) => {
    const client = requireSupabase();
    if (!session?.user) throw new Error("You must be signed in to update your profile.");

    const currentEmail = session.user.email ?? "";
    if (updates.email !== currentEmail) {
      const { error: authUpdateError } = await client.auth.updateUser({ email: updates.email });
      if (authUpdateError) throw authUpdateError;
    }

    const { error: metadataError } = await client.auth.updateUser({
      data: { display_name: updates.displayName, username: updates.displayName },
    });
    if (metadataError) throw metadataError;

    const { error: profileError } = await client
      .from("profiles")
      .update({ display_name: updates.displayName, email: updates.email })
      .eq("id", session.user.id);
    if (profileError) throw profileError;

    await refreshUser();
  }, [refreshUser, session]);

  const acceptCompliance = useCallback(async () => {
    const client = requireSupabase();
    if (!session?.user) throw new Error("You must be signed in to continue.");

    const now = new Date().toISOString();
    const { error } = await client
      .from("profiles")
      .update({ age_confirmed_at: now, terms_accepted_at: now })
      .eq("id", session.user.id);
    if (error) throw error;

    await refreshUser();
  }, [refreshUser, session]);

  const logout = useCallback(async () => {
    const client = requireSupabase();
    clearPendingGoogleCompliance();
    await client.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const declineCompliance = useCallback(async () => {
    await logout();
  }, [logout]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    token: session?.access_token ?? null,
    isLoading,
    authError,
    hasCompletedCompliance: Boolean(user?.ageConfirmedAt && user?.termsAcceptedAt),
    login,
    loginWithGoogle,
    register,
    logout,
    refreshUser,
    updateProfile,
    acceptCompliance,
    declineCompliance,
  }), [
    acceptCompliance,
    authError,
    declineCompliance,
    isLoading,
    login,
    loginWithGoogle,
    logout,
    refreshUser,
    register,
    session,
    updateProfile,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
