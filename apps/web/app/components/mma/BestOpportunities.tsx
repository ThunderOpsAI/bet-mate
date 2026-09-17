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
      opportunities={opportunities}
      emptyMessage="No MMA opportunity cards are ready yet. Refresh for the latest slate."
      href="/mma"
      linkLabel="Open MMA"
      compact={compact}
    />
  );
}
