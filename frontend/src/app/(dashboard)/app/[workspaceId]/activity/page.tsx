import { ActivityView } from "@/components/activity/activity-view";

interface ActivityPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { workspaceId } = await params;

  return <ActivityView workspaceId={workspaceId} />;
}
