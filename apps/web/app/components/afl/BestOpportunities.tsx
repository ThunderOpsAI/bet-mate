import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestAflOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="AFL opportunities"
      opportunities={opportunities}
      emptyMessage="No AFL opportunity cards are ready yet. Refresh for the latest slate."
      href="/afl"
      linkLabel="Open AFL"
      compact={compact}
    />
  );
}
