"use client";

import { useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbEntry {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbEntry[];
  onNavigate: (folderId: string | null) => void;
  onDropItems?: (itemIds: string[], targetFolderId: string | null) => void;
}

export function Breadcrumbs({ breadcrumbs, onNavigate, onDropItems }: BreadcrumbsProps) {
  const lastIdx = breadcrumbs.length - 1;
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(undefined);

  function handleDragOver(e: React.DragEvent, folderId: string | null) {
    if (e.dataTransfer.types.includes("application/x-file-ids")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetId(folderId);
    }
  }

  function handleDragLeave() {
    setDropTargetId(undefined);
  }

  function handleDrop(e: React.DragEvent, folderId: string | null) {
    e.preventDefault();
    setDropTargetId(undefined);
    const raw = e.dataTransfer.getData("application/x-file-ids");
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    if (ids.length > 0) {
      onDropItems?.(ids, folderId);
    }
  }

  return (
    <nav className="flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
      <button
        onClick={() => onNavigate(null)}
        onDragOver={(e) => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-[var(--overlay-4)] hover:text-foreground",
          dropTargetId === null && "bg-primary/10 text-foreground",
        )}
      >
        <Home className="h-3.5 w-3.5" />
        <span>Files</span>
      </button>

      {breadcrumbs.map((entry, i) => (
        <span key={entry.id} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {i === lastIdx ? (
            <span className="px-1.5 py-0.5 font-medium text-foreground">
              {entry.name}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(entry.id)}
              onDragOver={(e) => handleDragOver(e, entry.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, entry.id)}
              className={cn(
                "rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-[var(--overlay-4)] hover:text-foreground",
                dropTargetId === entry.id && "bg-primary/10 text-foreground",
              )}
            >
              {entry.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
