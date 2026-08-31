"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function PrototypeSwitcher({ variants, current }: { variants: string[], current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || process.env.NODE_ENV === 'production') return null;

  const cycleVariant = (direction: 1 | -1) => {
    const idx = variants.indexOf(current);
    let nextIdx = idx + direction;
    if (nextIdx < 0) nextIdx = variants.length - 1;
    if (nextIdx >= variants.length) nextIdx = 0;
    
    const nextVariant = variants[nextIdx];
    const params = new URLSearchParams(searchParams.toString());
    params.set('variant', nextVariant);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-4 bg-slate-900 text-white px-4 py-2 rounded-full shadow-2xl border border-slate-700">
      <button onClick={() => cycleVariant(-1)} className="p-1 hover:bg-slate-800 rounded font-bold">&larr;</button>
      <span className="font-mono text-sm tracking-widest uppercase">Variant {current}</span>
      <button onClick={() => cycleVariant(1)} className="p-1 hover:bg-slate-800 rounded font-bold">&rarr;</button>
    </div>
  );
}
