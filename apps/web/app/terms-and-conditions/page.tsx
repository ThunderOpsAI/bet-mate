import Link from "next/link";
import { FileText, ShieldAlert, ArrowLeft, Clock, Info } from "lucide-react";
import { termsContent } from "../lib/legal/termsContent";

export const metadata = {
  title: "Terms and Conditions | BetMate",
  description: "BetMate terms and conditions and simulated paper betting disclosures.",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 text-slate-200">
      {/* Header / Breadcrumb */}
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Overview</span>
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <FileText size={14} />
          <span>Legal & Compliance</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {termsContent.title}
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
          {termsContent.subtitle}
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <Clock size={12} /> Last Updated: {termsContent.lastUpdated}
          </span>
          <span>Version: {termsContent.version}</span>
        </div>
      </div>

      {/* Mandatory Prominent Paper Betting Claim Callout */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2 shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm sm:text-base">
          <ShieldAlert size={20} className="shrink-0 text-amber-400" />
          <span>Simulated Paper Betting Notice</span>
        </div>
        <p className="text-xs sm:text-sm leading-relaxed text-amber-100/90 font-medium">
          {termsContent.paperBettingNotice}
        </p>
      </div>

      {/* Sections List */}
      <div className="space-y-6">
        {termsContent.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className={`p-6 rounded-2xl bg-slate-950/80 border ${
              section.isNotice
                ? "border-emerald-500/30 bg-emerald-950/20"
                : "border-slate-800"
            } space-y-4 transition-all`}
          >
            <h2 className="text-lg font-bold text-white flex items-center justify-between">
              <span>{section.title}</span>
              {section.isNotice && (
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Core Disclaimer
                </span>
              )}
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {section.content.map((paragraph, idx) => {
                if (paragraph.includes("[PLACEHOLDER — TO BE FINALIZED]")) {
                  return (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-mono"
                    >
                      <Info size={12} className="text-amber-400 shrink-0" />
                      <span>{paragraph}</span>
                    </div>
                  );
                }
                return <p key={idx}>{paragraph}</p>;
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div>
          <span>Questions about these terms? Contact </span>
          <a
            href="mailto:legal@betmate.ai"
            className="text-emerald-400 hover:underline font-medium"
          >
            legal@betmate.ai
          </a>
        </div>
        <Link
          href="/privacy-policy"
          className="text-xs text-slate-300 hover:text-white underline decoration-slate-600 hover:decoration-white"
        >
          View Privacy Policy &rarr;
        </Link>
      </div>
    </div>
  );
}
