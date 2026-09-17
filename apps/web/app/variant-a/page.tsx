"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VariantAPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/variant-a/racing");
  }, [router]);

  return <div style={{ padding: "2rem", color: "#94a3b8" }}>Redirecting to Variant A Racing...</div>;
}
