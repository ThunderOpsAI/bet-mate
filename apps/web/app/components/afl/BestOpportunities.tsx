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
      description="These are today's strongest AFL leans from the current model read, ordered without inventing a cross-sport market edge."
      opportunities={opportunities}
      emptyMessage="No AFL opportunity cards are ready yet. Refresh for the latest slate."
      href="/afl"
      linkLabel="Open AFL"
      compact={compact}
    />
  );
}
