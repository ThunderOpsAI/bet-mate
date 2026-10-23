"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VariantCPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/variant-c/racing");
  }, [router]);

  return <div style={{ padding: "2rem", color: "#94a3b8" }}>Redirecting to Variant C Racing...</div>;
}
