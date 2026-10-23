import VariantMeetingView from "../../../components/prototypes/VariantMeetingView";

export default async function VariantCMeetingPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = await params;
  return <VariantMeetingView variant="c" venue={venue} />;
}
