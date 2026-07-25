"use client";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function NewBetContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/bets");
  }, [router]);

  return (
    <div className="card" style={{ maxWidth: 560, margin: "2rem auto", textAlign: "center" }}>
      <p style={{ color: "var(--text-muted)" }}>Redirecting to Bankroll bets page...</p>
    </div>
  );
}

export default function NewBetPage() {
  return (
    <Suspense fallback={<div className="card"><div className="skeleton" style={{ height: 100 }} /></div>}>
      <NewBetContent />
    </Suspense>
  );
}
