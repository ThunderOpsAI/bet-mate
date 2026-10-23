import VariantMeetingView from "../../../components/prototypes/VariantMeetingView";

export default async function VariantBMeetingPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = await params;
  return <VariantMeetingView variant="b" venue={venue} />;
}
