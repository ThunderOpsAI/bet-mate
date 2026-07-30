"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const BANNERS = [
  {
    id: 1,
    src: "/placeholders/banner1.jpg",
    alt: "Banner 1 - Strategies",
    href: "/strategies",
  },
  {
    id: 2,
    src: "/placeholders/banner2.jpg",
    alt: "Banner 2 - Strategies",
    href: "/strategies",
  },
  {
    id: 3,
    src: "/placeholders/banner3.jpg",
    alt: "Banner 3 - Ask Bob",
    href: "/bob",
  },
];

export default function PromoCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BANNERS.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full max-w-3xl h-10 md:h-12 mx-auto rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shadow-md flex items-center justify-center">
      {BANNERS.map((banner, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <Link href={banner.href} className="w-full h-full block">
              <div className="w-full h-full relative bg-slate-800 flex items-center justify-center text-slate-500 font-medium text-sm">
                <span className="absolute z-10 bg-slate-950/80 px-3 py-1 rounded-md">{banner.alt}</span>
                {/* Fallback placeholder */}
                <Image
                  src={banner.src}
                  alt={banner.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover opacity-50"
                  priority
                  unoptimized
                />
              </div>
            </Link>
          </div>
        );
      })}
      
      {/* Carousel Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {BANNERS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex ? "bg-emerald-400 w-4" : "bg-slate-600 hover:bg-slate-400"
            }`}
            aria-label={`Go to banner ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
