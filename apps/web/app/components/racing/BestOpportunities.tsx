import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestRacingOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="Racing opportunities"
      opportunities={opportunities}
      emptyMessage="No positive racing value gap is attached right now. You can still use the race cards below for model-only reads."
      href="/racing"
      linkLabel="Open Racing"
      compact={compact}
    />
  );
}
