interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h2 className="text-2xl font-semibold">Files</h2>
      <p className="text-muted-foreground">
        Workspace: {workspaceId}
      </p>
      <p className="text-sm text-muted-foreground">
        File browser will go here.
      </p>
    </div>
  );
}
