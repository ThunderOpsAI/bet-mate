import VariantSingleRaceView from "../../../../../components/prototypes/VariantSingleRaceView";

export default async function VariantASingleRacePage({
  params,
}: {
  params: Promise<{ venue: string; raceId: string }>;
}) {
  const { venue, raceId } = await params;
  return <VariantSingleRaceView variant="a" venue={venue} raceId={raceId} />;
}
