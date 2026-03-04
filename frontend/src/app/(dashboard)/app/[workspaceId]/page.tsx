import { DropZone } from "@/components/files/drop-zone";
import { FileBrowser } from "@/components/files/file-browser";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;

  return (
    <DropZone workspaceId={workspaceId}>
      <FileBrowser workspaceId={workspaceId} />
    </DropZone>
  );
}
