"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const completeSignIn = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured for this environment.");
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const authError = searchParams.get("error_description") || searchParams.get("error");
      if (authError) {
        setError(authError);
        return;
      }

      const code = searchParams.get("code");
      if (!code) {
        setError("Missing OAuth callback code.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      router.replace("/");
    };

    void completeSignIn();
  }, [router]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BetMate</h1>
          <p>Completing sign in</p>
        </div>
        {error ? (
          <>
            <div className="error-message">{error}</div>
            <Link className="btn btn-primary btn-block" href="/login">
              Back to sign in
            </Link>
          </>
        ) : (
          <div className="dashboard-loading auth-loading">
            <div className="loading-pulse">
              <p>Securing your session...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
