import VariantMeetingView from "../../../components/prototypes/VariantMeetingView";

export default async function VariantAMeetingPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = await params;
  return <VariantMeetingView variant="a" venue={venue} />;
}
