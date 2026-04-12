export const RECOMMENDATION_DISCLAIMER =
  "This is informational only. BetMate does not accept wagers or provide betting services.";

export default function RecommendationDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`recommendation-disclaimer${compact ? " compact" : ""}`}>
      {RECOMMENDATION_DISCLAIMER}
    </p>
  );
}
