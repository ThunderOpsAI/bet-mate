import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestSoccerOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="Soccer opportunities"
      description="These are the best current Soccer model leans, using confidence and urgency without pretending we have a live market price where we do not."
      opportunities={opportunities}
      emptyMessage="No Soccer opportunity cards are ready yet. Refresh for the latest slate."
      href="/soccer"
      linkLabel="Open Soccer"
      compact={compact}
    />
  );
}
