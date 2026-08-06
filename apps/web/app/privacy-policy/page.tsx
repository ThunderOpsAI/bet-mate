import Link from "next/link";
import { ShieldCheck, ArrowLeft, Clock, Info, Lock } from "lucide-react";
import { privacyContent } from "../lib/legal/privacyContent";

export const metadata = {
  title: "Privacy Policy | BetMate",
  description: "BetMate privacy policy regarding account data, simulation history, and privacy rights.",
};

export default function PrivacyPolicyPage() {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <ShieldCheck size={14} />
          <span>Privacy & Data Security</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {privacyContent.title}
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
          {privacyContent.subtitle}
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <Clock size={12} /> Last Updated: {privacyContent.lastUpdated}
          </span>
          <span>Version: {privacyContent.version}</span>
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-200 space-y-2">
        <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
          <Lock size={18} className="shrink-0 text-blue-400" />
          <span>Privacy Policy Summary</span>
        </div>
        <p className="text-xs sm:text-sm leading-relaxed text-blue-100/90 font-medium">
          {privacyContent.summary}
        </p>
      </div>

      {/* Sections List */}
      <div className="space-y-6">
        {privacyContent.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4"
          >
            <h2 className="text-lg font-bold text-white">
              {section.title}
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
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div>
          <span>Have questions about your data? Email </span>
          <a
            href="mailto:legal@betmate.ai"
            className="text-blue-400 hover:underline font-medium"
          >
            legal@betmate.ai
          </a>
        </div>
        <Link
          href="/terms-and-conditions"
          className="text-xs text-slate-300 hover:text-white underline decoration-slate-600 hover:decoration-white"
        >
          View Terms &amp; Conditions &rarr;
        </Link>
      </div>
    </div>
  );
}
