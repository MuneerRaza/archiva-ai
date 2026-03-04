"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, FileText, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { FileStatusBadge } from "@/components/files/file-status-badge";
import { useSearch } from "@/lib/queries/search";
import { getFileIcon } from "@/lib/file-icons";
import type { FileStatus } from "@/types/models";

function useDebouncedValue(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

const VALID_STATUSES = new Set<FileStatus>(["uploaded", "processing", "ready", "partial", "failed"]);

function toFileStatus(status: string): FileStatus {
  return VALID_STATUSES.has(status as FileStatus) ? (status as FileStatus) : "uploaded";
}

interface ContextMenuState {
  x: number;
  y: number;
  fileId: string;
  fileName: string;
}

export default function SearchPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSearch(workspaceId, debouncedQuery);
  const results = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, fileId: string, fileName: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, fileId, fileName });
    },
    [],
  );

  const handleOpen = useCallback(() => {
    if (!contextMenu) return;
    router.push(`/app/${workspaceId}/file/${contextMenu.fileId}`);
    setContextMenu(null);
  }, [contextMenu, router, workspaceId]);

  const handleDownload = useCallback(async () => {
    if (!contextMenu) return;
    try {
      const { api } = await import("@/lib/api");
      const res = await api.get<{ data: { url: string } }>(
        `/workspaces/${workspaceId}/files/${contextMenu.fileId}/download`,
      );
      let url = res.data.url;
      if (url.startsWith("/api/")) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        url = `${apiBase}${url}`;
      }
      window.open(url, "_blank");
    } catch {
      // silently fail
    }
    setContextMenu(null);
  }, [contextMenu, workspaceId]);

  const handleCopyName = useCallback(() => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.fileName);
    setContextMenu(null);
  }, [contextMenu]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--overlay-6)] px-6 py-4">
        <h1 className="text-lg font-semibold">Search</h1>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by name or content..."
            className="pl-9"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!debouncedQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-[14px] text-muted-foreground">
              Type to search across all files in this workspace
            </p>
          </div>
        )}

        {debouncedQuery && !isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-[14px] text-muted-foreground">
              No results found for &quot;{debouncedQuery}&quot;
            </p>
          </div>
        )}

        {debouncedQuery && (isLoading || results.length > 0) && (
          <div className="space-y-1">
            {!isLoading && (
              <p className="mb-3 text-[12px] text-muted-foreground">
                {total} result{total !== 1 ? "s" : ""}
              </p>
            )}

            {results.map((result) => {
              const { icon: FileIcon, color } = getFileIcon(result.mime_type);
              return (
                <button
                  key={result.id}
                  onClick={() =>
                    router.push(`/app/${workspaceId}/file/${result.id}`)
                  }
                  onContextMenu={(e) => handleContextMenu(e, result.id, result.name)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-[var(--overlay-4)]"
                >
                  <FileIcon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {result.name}
                      </span>
                      <FileStatusBadge
                        status={toFileStatus(result.status)}
                        compact
                      />
                    </div>
                    {result.summary && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                        {result.summary.slice(0, 200)}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      <span>{formatBytes(result.size_bytes)}</span>
                      {result.word_count != null && result.word_count > 0 && (
                        <span>{result.word_count.toLocaleString()} words</span>
                      )}
                      {result.page_count != null && result.page_count > 0 && (
                        <span>{result.page_count} page{result.page_count !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-md border border-[var(--overlay-8)] bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleOpen}
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
          <div className="my-1 h-px bg-[var(--overlay-6)]" />
          <button
            onClick={handleCopyName}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy name
          </button>
        </div>
      )}
    </div>
  );
}
