import Link from "next/link";
import { BookOpen, Brain, CircleHelp, ShieldCheck, Wallet } from "lucide-react";

const GLOSSARY = [
  ["Fair odds", "The price implied by BetMate's model probability before you compare it with the market."],
  ["Calibration", "How closely the model's predicted percentages line up with what happens over time."],
  ["Paper bet", "A tracked bet that never places money. It is for review, discipline, and learning."],
  ["Market agreement", "Whether the available market signal broadly supports the model's read."],
];

export default function HowItWorksPage() {
  return (
    <div className="how-it-works-page">
      <section className="how-hero">
        <div className="how-hero-copy">
          <span className="eyebrow">BetMate explained</span>
          <h1>What the engine does, what it does not do, and how to use it responsibly.</h1>
          <p>
            BetMate turns historical form, matchup context, and model calibration into
            simple probability reads. It is built to support paper betting and better
            decision-making, not blind trust.
          </p>
          <div className="how-hero-actions">
            <Link href="/" className="btn btn-primary">
              View predictions
            </Link>
            <Link href="/bets" className="btn btn-secondary">
              Open paper bets
            </Link>
          </div>
        </div>
        <div className="how-diagram-card">
          <div className="diagram-step">
            <BookOpen size={18} />
            <span>Nightly scrape collects fresh racing and game context</span>
          </div>
          <div className="diagram-step">
            <Brain size={18} />
            <span>Models recalculate probabilities and fair odds</span>
          </div>
          <div className="diagram-step">
            <CircleHelp size={18} />
            <span>Bob explains the drivers, caution flags, and confidence tone</span>
          </div>
          <div className="diagram-step">
            <Wallet size={18} />
            <span>You track paper bets, bankroll, and outcomes without placing anything</span>
          </div>
        </div>
      </section>

      <section className="how-grid">
        <article className="how-card">
          <h2>Prediction engine</h2>
          <p>
            Each sport model estimates win probability from the features already exposed by
            the backend. BetMate then converts that into fair odds so you can compare price
            versus model expectation.
          </p>
        </article>
        <article className="how-card">
          <h2>Nightly scraping</h2>
          <p>
            Fresh event data is collected overnight in Australia so the app opens with a
            current snapshot instead of waiting for slow first-load fetches.
          </p>
        </article>
        <article className="how-card">
          <h2>Weekly retraining</h2>
          <p>
            The models are retrained off-peak each week. More settled results improve
            calibration over time, which is why newer seasons get sharper as the dataset grows.
          </p>
        </article>
        <article className="how-card">
          <h2>Why more data matters</h2>
          <p>
            Confidence labels are strongest when the model has depth, stable calibration, and
            a market signal to compare against. Thin datasets should be treated more carefully.
          </p>
        </article>
      </section>

      <section className="how-card">
        <h2>Glossary</h2>
        <div className="glossary-list">
          {GLOSSARY.map(([term, description]) => (
            <div key={term} className="glossary-item">
              <strong>{term}</strong>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="how-card responsible-play-card">
        <div className="responsible-play-head">
          <ShieldCheck size={18} />
          <h2>Responsible use</h2>
        </div>
        <p>
          BetMate is designed around paper betting first. Use the slip to test ideas, review
          confidence honestly, and avoid treating model output as certainty.
        </p>
        <p>
          If you need support, visit{" "}
          <a
            href="https://www.gamblinghelponline.org.au/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gambling Help Online
          </a>
          .
        </p>
      </section>
    </div>
  );
}
