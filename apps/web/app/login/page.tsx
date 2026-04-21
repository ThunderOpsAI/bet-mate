"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";

  useEffect(() => {
    router.replace(returnUrl);
  }, [router, returnUrl]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BetMate</h1>
          <p>Guest mode is active.</p>
        </div>
        <Link href={returnUrl} className="btn btn-primary btn-block">
          Open BetMate
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-container"><div className="auth-card">Opening BetMate...</div></div>}>
      <LoginRedirect />
    </Suspense>
  );
}
