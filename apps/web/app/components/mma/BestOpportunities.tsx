import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestMmaOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="MMA opportunities"
      description="These are the best current MMA model leans, using confidence and urgency without pretending we have a live market price where we do not."
      opportunities={opportunities}
      emptyMessage="No MMA opportunity cards are ready yet. Refresh for the latest slate."
      href="/mma"
      linkLabel="Open MMA"
      compact={compact}
    />
  );
}
