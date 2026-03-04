"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";

interface FileContextMenuProps {
  workspaceId: string;
  type: "file" | "folder";
  targetId: string;
  targetName: string;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (type: "file" | "folder", id: string, currentName: string) => void;
  onDelete: (type: "file" | "folder", id: string) => void;
  onReprocess?: (fileId: string) => void;
}

export function FileContextMenu({
  workspaceId,
  type,
  targetId,
  targetName,
  position,
  onClose,
  onRename,
  onDelete,
  onReprocess,
}: FileContextMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function handleRename() {
    onClose();
    onRename(type, targetId, targetName);
  }

  function handleDeleteClick() {
    onClose();
    onDelete(type, targetId);
  }

  async function handleDownload() {
    if (type === "file") {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.get<{
          data: { url: string; expires_in: number };
        }>(`/workspaces/${workspaceId}/files/${targetId}/download`);
        let url = res.data.url;
        if (url.startsWith("/api/")) {
          url = new URL(url, window.location.origin).toString();
        }
        window.open(url, "_blank");
      } catch {
        // Silently fail
      }
    }
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-[var(--overlay-8)] bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      {type === "file" && (
        <>
          <button
            onClick={() => {
              router.push(`/app/${workspaceId}/file/${targetId}`);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </button>
          <button
            onClick={handleDownload}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          {onReprocess && (
            <button
              onClick={() => {
                onClose();
                onReprocess(targetId);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reprocess
            </button>
          )}
          <div className="my-1 h-px bg-[var(--overlay-6)]" />
        </>
      )}
      <button
        onClick={handleRename}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
      >
        <Pencil className="h-3.5 w-3.5" />
        Rename
      </button>
      <button
        onClick={handleDeleteClick}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}
