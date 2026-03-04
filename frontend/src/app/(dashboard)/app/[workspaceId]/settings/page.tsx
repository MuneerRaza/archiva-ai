import { Suspense } from "react";

import { WorkspaceSettings } from "@/components/workspace/workspace-settings";

interface SettingsPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { workspaceId } = await params;

  return (
    <Suspense>
      <WorkspaceSettings workspaceId={workspaceId} />
    </Suspense>
  );
}
