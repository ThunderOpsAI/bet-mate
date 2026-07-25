import Link from "next/link";
import { Construction, Wrench, Sparkles, ArrowRight } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="hiw-page">
      <section className="hiw-hero">
        <div className="hiw-icon-wrap">
          <Construction size={56} />
        </div>
        <h1>How It Works</h1>
        <p className="hiw-subtitle">We&apos;re building something great</p>
        <p className="hiw-description">
          We&apos;re putting the finishing touches on a comprehensive guide to
          BetMate&apos;s prediction engine, strategy tools, and paper betting
          system. Check back soon.
        </p>
      </section>

      <section className="hiw-preview-grid">
        <div className="hiw-preview-card">
          <Sparkles size={28} className="hiw-card-icon" />
          <h3>Prediction Engine Deep-Dive</h3>
          <p>Learn how our ML models analyse form, odds, and context to surface value.</p>
        </div>
        <div className="hiw-preview-card">
          <Wrench size={28} className="hiw-card-icon" />
          <h3>Strategy Builder Guide</h3>
          <p>Master the strategy card system and learn how profiles allocate bankroll.</p>
        </div>
        <div className="hiw-preview-card">
          <Construction size={28} className="hiw-card-icon" />
          <h3>Paper Betting 101</h3>
          <p>Track and improve your decision-making without risking real money.</p>
        </div>
      </section>

      <div className="hiw-cta">
        <Link href="/" className="btn btn-primary">
          Back to Dashboard <ArrowRight size={16} />
        </Link>
      </div>

      <footer className="hiw-footer">
        <p>
          18+ | If you need support, visit{" "}
          <a
            href="https://www.gamblinghelponline.org.au/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gambling Help Online
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
