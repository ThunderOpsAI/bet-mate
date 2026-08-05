"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VariantBPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/variant-b/racing");
  }, [router]);

  return <div style={{ padding: "2rem", color: "#94a3b8" }}>Redirecting to Variant B Racing...</div>;
}
