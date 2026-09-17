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
      opportunities={opportunities}
      emptyMessage="No Golf opportunity cards are ready yet. Refresh for the latest slate."
      href="/golf"
      linkLabel="Open Golf"
      compact={compact}
    />
  );
}
