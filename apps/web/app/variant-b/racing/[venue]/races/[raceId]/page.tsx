import VariantSingleRaceView from "../../../../../components/prototypes/VariantSingleRaceView";

export default async function VariantBSingleRacePage({
  params,
}: {
  params: Promise<{ venue: string; raceId: string }>;
}) {
  const { venue, raceId } = await params;
  return <VariantSingleRaceView variant="b" venue={venue} raceId={raceId} />;
}
