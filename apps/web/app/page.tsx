"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/racing");
  }, [router]);

  return (
    <div className="dashboard-loading">
      <div className="loading-pulse">
        <p>Loading BetMate...</p>
      </div>
    </div>
  );
}
