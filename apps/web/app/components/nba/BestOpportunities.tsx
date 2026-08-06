import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestNbaOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="NBA opportunities"
      opportunities={opportunities}
      emptyMessage="No NBA opportunity cards are ready yet. Refresh for the latest slate."
      href="/nba"
      linkLabel="Open NBA"
      compact={compact}
    />
  );
}
