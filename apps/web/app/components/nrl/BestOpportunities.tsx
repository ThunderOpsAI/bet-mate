import type { RankedOpportunity } from "../../lib/opportunityScore";
import OpportunitySection from "../OpportunitySection";

type BestOpportunitiesProps = {
  opportunities: RankedOpportunity[];
  compact?: boolean;
};

export default function BestNrlOpportunities({
  opportunities,
  compact = false,
}: BestOpportunitiesProps) {
  return (
    <OpportunitySection
      title="NRL opportunities"
      opportunities={opportunities}
      emptyMessage="No NRL opportunity cards are ready yet. Refresh for the latest slate."
      href="/nrl"
      linkLabel="Open NRL"
      compact={compact}
    />
  );
}
