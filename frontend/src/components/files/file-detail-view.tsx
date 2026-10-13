"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDetailSidebar } from "@/components/files/file-detail-sidebar";
import { AudioPlayer } from "@/components/files/viewers/audio-player";
import { CodeViewer } from "@/components/files/viewers/code-viewer";
import { DocumentViewer } from "@/components/files/viewers/document-viewer";
import { ExcelViewer } from "@/components/files/viewers/excel-viewer";
import { FallbackViewer } from "@/components/files/viewers/fallback-viewer";
import { ImageViewer } from "@/components/files/viewers/image-viewer";
import { ReprocessDialog } from "@/components/files/reprocess-dialog";
import { SpreadsheetViewer } from "@/components/files/viewers/spreadsheet-viewer";
import { TextViewer } from "@/components/files/viewers/text-viewer";
import { VideoPlayer } from "@/components/files/viewers/video-player";

import { useFileDetail } from "@/lib/queries/file-detail";
import { useUpdateFile } from "@/lib/queries/files";
import { useWorkspace } from "@/lib/queries/workspaces";
import { getViewerType, type ViewerType } from "@/lib/viewer-utils";
import { useUIStore } from "@/stores/ui-store";

const PdfViewer = dynamic(
  () => import("@/components/files/viewers/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <div className="flex flex-1 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" /></div> },
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const API_ROOT = API_BASE ? `${API_BASE}/api` : "/api";

export interface NavigateTarget {
  page?: number;
  anchor?: string;
  /** Monotonic counter to force re-trigger even when navigating to the same target */
  _seq?: number;
}

interface FileDetailViewProps {
  workspaceId: string;
  fileId: string;
}

function stripExtension(name: string): string {
  const dotIdx = name.lastIndexOf(".");
  return dotIdx > 0 ? name.substring(0, dotIdx) : name;
}

function getExtension(name: string): string {
  const dotIdx = name.lastIndexOf(".");
  return dotIdx > 0 ? name.substring(dotIdx) : "";
}

export function FileDetailView({ workspaceId, fileId }: FileDetailViewProps) {
  const { data: detail, isLoading, error } = useFileDetail(workspaceId, fileId);
  const { detailPaneOpen, detailPaneWidth, toggleDetailPane, setDetailPaneWidth } = useUIStore();
  const [navigateTo, setNavigateTo] = useState<NavigateTarget | null>(null);
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("info");
  const { data: workspace } = useWorkspace(workspaceId);
  const piiEnabled = workspace?.settings?.ingestion?.pii?.enabled ?? false;

  function openPiiTab() {
    setDetailTab("pii");
    if (!detailPaneOpen) toggleDetailPane();
  }

  // Inline rename state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateFile = useUpdateFile(workspaceId);

  // Drag-to-resize state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!detailPaneOpen) return;
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = detailPaneWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    },
    [detailPaneOpen, detailPaneWidth],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = startWidth.current + delta;
      setDetailPaneWidth(newWidth);
    }
    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [setDetailPaneWidth]);

  function startEditing() {
    if (!detail) return;
    setEditValue(stripExtension(detail.file.name));
    setIsEditing(true);
    // Focus after render
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  function commitRename() {
    if (!detail) return;
    const trimmed = editValue.trim();
    const ext = getExtension(detail.file.name);
    const newName = trimmed + ext;
    setIsEditing(false);
    if (!trimmed || newName === detail.file.name) return;
    updateFile.mutate({ fileId, data: { name: newName } });
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-1">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-64 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load file";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{errorMessage}</p>
        {error && "status" in error && (
          <p className="text-xs text-muted-foreground">
            Status: {(error as { status: number }).status}
          </p>
        )}
        <Link href={`/app/${workspaceId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to files
          </Button>
        </Link>
      </div>
    );
  }

  const { file, storage_key } = detail;
  const viewerType = getViewerType(file.mime_type, file.name);
  // Key the URL on updated_at so in-place redaction (same storage_key) busts the
  // browser cache and forces the viewer to reload the redacted content.
  const cacheBust = encodeURIComponent(file.updated_at);
  const fileUrl = `${API_ROOT}/storage/local/${storage_key}?v=${cacheBust}`;
  const downloadUrl = fileUrl;

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--overlay-6)] px-4">
        <Link href={`/app/${workspaceId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        {isEditing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            className="h-7 flex-1 text-[14px] font-medium"
          />
        ) : (
          <h1
            className="flex-1 cursor-pointer truncate text-[14px] font-medium rounded px-1 -mx-1 hover:bg-[var(--overlay-4)] transition-colors"
            title={file.name}
            onClick={startEditing}
          >
            {file.name}
          </h1>
        )}

        {piiEnabled && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px]"
            onClick={openPiiTab}
            aria-label="PII detection"
            title="PII detection & redaction"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            PII
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={() => setReprocessOpen(true)}
          disabled={file.status === "processing"}
          aria-label="Reprocess file"
          title="Reprocess"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Viewer + Sidebar + Toggle Strip */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          <FileViewerSwitch
            viewerType={viewerType}
            file={file}
            fileUrl={fileUrl}
            downloadUrl={downloadUrl}
            navigateTo={navigateTo}
            onNavigateComplete={() => setNavigateTo(null)}
          />
        </div>

        {detailPaneOpen && (
          <div
            className="group relative flex w-1.5 shrink-0 cursor-col-resize items-center"
            onMouseDown={onMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize detail pane"
          >
            <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-[var(--overlay-4)] transition-colors group-hover:bg-[var(--overlay-15)] group-active:bg-[var(--overlay-22)]" />
          </div>
        )}

        {detailPaneOpen && (
          <div style={{ width: detailPaneWidth }} className="shrink-0 border-l border-[var(--overlay-6)]">
            <FileDetailSidebar
              detail={detail}
              downloadUrl={downloadUrl}
              piiEnabled={piiEnabled}
              activeTab={detailTab}
              onTabChange={setDetailTab}
              onNavigate={setNavigateTo}
            />
          </div>
        )}

        <button
          onClick={toggleDetailPane}
          className="flex w-7 shrink-0 items-center justify-center border-l border-[var(--overlay-6)] bg-background/50 transition-colors hover:bg-[var(--overlay-3)]"
          aria-label={detailPaneOpen ? "Hide details" : "Show details"}
        >
          {detailPaneOpen ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <ReprocessDialog
        workspaceId={workspaceId}
        fileId={fileId}
        fileName={file.name}
        mimeType={file.mime_type}
        open={reprocessOpen}
        onOpenChange={setReprocessOpen}
      />
    </div>
  );
}

function FileViewerSwitch({
  viewerType,
  file,
  fileUrl,
  downloadUrl,
  navigateTo,
  onNavigateComplete,
}: {
  viewerType: ViewerType;
  file: { name: string; mime_type: string; size_bytes: number };
  fileUrl: string;
  downloadUrl: string;
  navigateTo: NavigateTarget | null;
  onNavigateComplete: () => void;
}) {
  switch (viewerType) {
    case "pdf":
      return <PdfViewer url={fileUrl} goToPage={navigateTo?.page} navigateSeq={navigateTo?._seq} onNavigateComplete={onNavigateComplete} />;
    case "image":
      return <ImageViewer url={fileUrl} alt={file.name} />;
    case "markdown":
      return <TextViewer url={fileUrl} isMarkdown scrollToAnchor={navigateTo?.anchor} onNavigateComplete={onNavigateComplete} />;
    case "text":
      return <TextViewer url={fileUrl} isMarkdown={false} />;
    case "code":
      return <CodeViewer url={fileUrl} fileName={file.name} />;
    case "media":
      if (file.mime_type.startsWith("audio/")) {
        return <AudioPlayer url={fileUrl} mimeType={file.mime_type} fileName={file.name} />;
      }
      return <VideoPlayer url={fileUrl} mimeType={file.mime_type} />;
    case "excel":
      return <ExcelViewer url={fileUrl} />;
    case "spreadsheet":
      return <SpreadsheetViewer url={fileUrl} />;
    case "document":
      return <DocumentViewer url={fileUrl} downloadUrl={downloadUrl} fileName={file.name} scrollToAnchor={navigateTo?.anchor} onNavigateComplete={onNavigateComplete} />;
    case "fallback":
      return (
        <FallbackViewer
          fileName={file.name}
          mimeType={file.mime_type}
          sizeBytes={file.size_bytes}
          downloadUrl={downloadUrl}
        />
      );
  }
}
