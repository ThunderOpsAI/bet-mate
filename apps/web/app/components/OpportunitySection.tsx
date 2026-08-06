import Link from "next/link";
import type { RankedOpportunity } from "../lib/opportunityScore";
import { ConfidenceBadge, UrgencyBadge } from "./PredictionSignalBadges";

type OpportunitySectionProps = {
  title: string;
  description?: string;
  opportunities: RankedOpportunity[];
  emptyMessage: string;
  href: string;
  linkLabel: string;
  compact?: boolean;
};

export default function OpportunitySection({
  title,
  description,
  opportunities,
  emptyMessage,
  href,
  linkLabel,
  compact = false,
}: OpportunitySectionProps) {
  return (
    <section className={`opportunity-section ${compact ? "compact" : ""}`}>
      <div className="opportunity-section-header">
        <div>
          <h3>{title}</h3>
        </div>
        <Link href={href} className="btn btn-sm btn-secondary">
          {linkLabel}
        </Link>
      </div>

      {opportunities.length === 0 ? (
        <div className="opportunity-empty">{emptyMessage}</div>
      ) : (
        <div className={`opportunity-list ${compact ? "compact" : ""}`}>
          {opportunities.map((opportunity, index) => (
            <article key={opportunity.id} className="opportunity-card">
              <div className="opportunity-card-top">
                <div>
                  <span className="opportunity-rank">#{index + 1}</span>
                  <h4>{opportunity.selectionName}</h4>
                  <p>{opportunity.eventLabel}</p>
                </div>
                {opportunity.edgePercent ? (
                  <span className="value-badge positive">
                    Edge +{opportunity.edgePercent.toFixed(0)}%
                  </span>
                ) : (
                  <span className="value-badge neutral">Model-led read</span>
                )}
              </div>

              <div className="opportunity-metrics">
                <span className="context-chip">
                  Model {opportunity.probability.toFixed(1)}%
                </span>
                <span className="context-chip">
                  Fair ${opportunity.fairOdds.toFixed(2)}
                </span>
                {opportunity.marketOdds ? (
                  <span className="context-chip">
                    Market ${opportunity.marketOdds.toFixed(2)}
                  </span>
                ) : (
                  <span className="context-chip">No live market price</span>
                )}
                {opportunity.confidenceSignal ? (
                  <ConfidenceBadge signal={opportunity.confidenceSignal} />
                ) : null}
                {opportunity.urgencySignal ? (
                  <UrgencyBadge signal={opportunity.urgencySignal} />
                ) : null}
              </div>

              <p className="opportunity-summary">{opportunity.summary}</p>

              {!compact ? (
                <div className="opportunity-score-row">
                  <span className="opportunity-score-label">
                    Opportunity score
                  </span>
                  <span className="opportunity-score-value">
                    {(opportunity.score * 100).toFixed(0)}/100
                  </span>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
