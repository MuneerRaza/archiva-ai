import { FolderOpen, Upload } from "lucide-react";

interface EmptyStateProps {
  isRoot: boolean;
}

export function EmptyState({ isRoot }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--overlay-8)] bg-[var(--overlay-3)]">
        {isRoot ? (
          <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <FolderOpen
            className="h-5 w-5 text-muted-foreground"
            strokeWidth={1.5}
          />
        )}
      </div>
      <div className="text-center">
        <h2 className="text-[15px] font-medium text-foreground">
          {isRoot ? "No files yet" : "This folder is empty"}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {isRoot
            ? "Upload documents to get started with your AI workspace."
            : "Upload files or create a subfolder to organize your work."}
        </p>
      </div>
    </div>
  );
}
