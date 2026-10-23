"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Trophy, Zap, FlaskConical, MoreHorizontal } from "lucide-react";

interface VariantNavigationShellProps {
  children: React.ReactNode;
  activeVariant: "a" | "b" | "c";
}

export default function VariantNavigationShell({
  children,
  activeVariant,
}: VariantNavigationShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const getVariantPath = (variant: "a" | "b" | "c") => {
    const currentPrefix = `/variant-${activeVariant}`;
    const newPrefix = `/variant-${variant}`;
    
    if (pathname.startsWith(currentPrefix)) {
      const rest = pathname.slice(currentPrefix.length);
      return `${newPrefix}${rest || "/racing"}${queryString}`;
    }
    return `${newPrefix}/racing${queryString}`;
  };

  return (
    <div className={`prototype-shell variant-${activeVariant}-shell`}>
      {/* Prototype Variant Switcher Top Bar */}
      <div className="prototype-top-bar">
        <div className="prototype-top-bar-inner">
          <div className="prototype-brand-section">
            <Image
              src="/brand/betmate-logo.png"
              alt="BetMate Prototype"
              width={100}
              height={30}
              priority
              className="prototype-logo"
            />
            <span className="prototype-badge">PROTOTYPE</span>
          </div>

          <div className="prototype-variant-switcher">
            <Link
              href={getVariantPath("a")}
              className={`variant-tab ${activeVariant === "a" ? "active" : ""}`}
            >
              Variant A <span className="tab-desc">Sportsbet 1:1</span>
            </Link>
            <Link
              href={getVariantPath("b")}
              className={`variant-tab ${activeVariant === "b" ? "active" : ""}`}
            >
              Variant B <span className="tab-desc">Elevated 3D</span>
            </Link>
            <Link
              href={getVariantPath("c")}
              className={`variant-tab ${activeVariant === "c" ? "active" : ""}`}
            >
              Variant C <span className="tab-desc">Command EV</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="prototype-main-content">{children}</main>

      {/* Mobile Sticky Bottom Navigation (Fixed < 768px) */}
      <nav className="prototype-bottom-nav">
        <Link
          href={`/variant-${activeVariant}/racing${queryString}`}
          className={`bottom-nav-item ${pathname.includes("/racing") || pathname === `/variant-${activeVariant}` ? "active" : ""}`}
        >
          <Trophy size={20} />
          <span>Racing</span>
        </Link>
        <Link
          href={`/variant-${activeVariant}/racing${queryString}`}
          className="bottom-nav-item"
        >
          <Home size={20} />
          <span>Home</span>
        </Link>
        <Link
          href={`/variant-${activeVariant}/racing${queryString}`}
          className="bottom-nav-item"
        >
          <Zap size={20} />
          <span>Sport</span>
        </Link>
        <Link
          href={`/variant-${activeVariant}/racing${queryString}`}
          className="bottom-nav-item"
        >
          <FlaskConical size={20} />
          <span>Lab</span>
        </Link>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => alert("More menu options")}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

export { VariantNavigationShell };
