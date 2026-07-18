import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestGolfOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="Golf opportunities"
      description="These are the best current Golf model leans, using confidence and urgency without pretending we have a live market price where we do not."
      opportunities={opportunities}
      emptyMessage="No Golf opportunity cards are ready yet. Refresh for the latest slate."
      href="/golf"
      linkLabel="Open Golf"
      compact={compact}
    />
  );
}
