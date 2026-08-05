import VariantSingleRaceView from "../../../../../components/prototypes/VariantSingleRaceView";

export default async function VariantCSingleRacePage({
  params,
}: {
  params: Promise<{ venue: string; raceId: string }>;
}) {
  const { venue, raceId } = await params;
  return <VariantSingleRaceView variant="c" venue={venue} raceId={raceId} />;
}
