"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BetMate</h1>
          <p>Guest mode is active.</p>
        </div>
        <Link href="/" className="btn btn-primary btn-block">
          Open BetMate
        </Link>
      </div>
    </div>
  );
}
