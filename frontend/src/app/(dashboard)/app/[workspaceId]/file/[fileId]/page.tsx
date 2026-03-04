import { FileDetailView } from "@/components/files/file-detail-view";

interface FilePageProps {
  params: Promise<{ workspaceId: string; fileId: string }>;
}

export default async function FilePage({ params }: FilePageProps) {
  const { workspaceId, fileId } = await params;

  return <FileDetailView workspaceId={workspaceId} fileId={fileId} />;
}
