"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Square,
  Upload,
} from "lucide-react";
import { useIsMutating } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ReprocessDialog } from "@/components/files/reprocess-dialog";
import {
  useCancelAllProcessing,
  useCancelProcessing,
  useProcessingHistory,
} from "@/lib/queries/processing";
import { getFileIcon } from "@/lib/file-icons";
import { cn } from "@/lib/utils";
import type { ProcessingJob } from "@/types/models";

interface ActivityViewProps {
  workspaceId: string;
}

type StatusFilter =
  | "all"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

interface JobContextMenuState {
  x: number;
  y: number;
  fileId: string;
  fileName: string;
  canReprocess: boolean;
}

export function ActivityView({ workspaceId }: ActivityViewProps) {
  const router = useRouter();
  const { data: jobs, isLoading, refetch, isFetching } = useProcessingHistory(workspaceId);
  const uploading = useIsMutating({ mutationKey: ["upload-file"] });
  const cancelOne = useCancelProcessing(workspaceId);
  const cancelAll = useCancelAllProcessing(workspaceId);
  const [reprocessTarget, setReprocessTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<JobContextMenuState | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!ctxMenu) return;
    function close() { setCtxMenu(null); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    function handleClick(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ctxMenu]);

  const handleJobContextMenu = useCallback(
    (e: React.MouseEvent, fileId: string, fileName: string, canReprocess: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ x: e.clientX, y: e.clientY, fileId, fileName, canReprocess });
    },
    [],
  );

  // Group jobs by file_id, then filter
  const { groupedJobs, activeCount } = useMemo(() => {
    if (!jobs) return { groupedJobs: [], activeCount: 0 };

    let active = 0;
    const fileMap = new Map<string, { jobs: ProcessingJob[]; latestJob: ProcessingJob }>();

    for (const job of jobs) {
      if (job.status === "queued" || job.status === "running") active++;

      const key = job.file_id;
      const existing = fileMap.get(key);
      if (existing) {
        existing.jobs.push(job);
      } else {
        fileMap.set(key, { jobs: [job], latestJob: job });
      }
    }

    // Sort groups by most recent job timestamp (latest first)
    let groups = Array.from(fileMap.values()).sort((a, b) => {
      const aTime = new Date(a.latestJob.created_at).getTime();
      const bTime = new Date(b.latestJob.created_at).getTime();
      return bTime - aTime;
    });

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      groups = groups.filter(
        (g) => (g.latestJob.file_name ?? "").toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "running") {
        groups = groups.filter((g) =>
          g.latestJob.status === "queued" || g.latestJob.status === "running",
        );
      } else {
        groups = groups.filter((g) => g.latestJob.status === statusFilter);
      }
    }

    return { groupedJobs: groups, activeCount: active };
  }, [jobs, searchQuery, statusFilter]);

  function toggleExpanded(fileId: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "running", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "partial", label: "Partial" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--overlay-6)] px-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-[15px] font-semibold">Activity</h1>
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-500/15 px-1.5 py-0 text-[10px] font-medium text-blue-400">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[11px] text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => cancelAll.mutate()}
              disabled={cancelAll.isPending}
            >
              <Square className="h-3 w-3 fill-current" />
              Stop all
            </Button>
          )}
          {jobs && (
            <span className="text-[12px] text-muted-foreground">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh activity"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Inline upload status bar (replaces the floating card on this page) */}
      {uploading > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--overlay-6)] bg-blue-500/5 px-4 py-2">
          <Upload className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[12px] font-medium">
            Uploading {uploading} file{uploading > 1 ? "s" : ""}...
          </span>
          <Progress className="ml-auto h-1 w-32" />
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--overlay-6)] px-4 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <div className="flex gap-0.5 rounded-lg bg-[var(--overlay-3)] p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groupedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--overlay-3)] ring-1 ring-[var(--overlay-6)]">
              <ListChecks className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No matching jobs"
                  : "No processing activity"}
              </p>
              <p className="mt-1 max-w-[280px] text-[12px] text-muted-foreground/50">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Upload files to your workspace and processing jobs will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {groupedJobs.map(({ jobs: fileJobs, latestJob }) => {
              const fileId = latestJob.file_id;
              const isExpanded = expandedFiles.has(fileId);
              const hasMultipleRuns = fileJobs.length > 1;
              const isLatestActive = latestJob.status === "queued" || latestJob.status === "running";
              const canReprocess = !isLatestActive;

              return (
                <div
                  key={fileId}
                  id={`job-${latestJob.id}`}
                  className="rounded-lg border border-[var(--overlay-6)] bg-[var(--overlay-2)] overflow-hidden"
                  onContextMenu={(e) =>
                    handleJobContextMenu(
                      e,
                      latestJob.file_id,
                      latestJob.file_name ?? "Unknown file",
                      canReprocess,
                    )
                  }
                >
                  {/* File header row */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* File icon */}
                    <FileIcon mimeType={latestJob.file_mime_type} />

                    {/* File name + status inline */}
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-[13px] font-medium text-foreground/90">
                        {latestJob.file_name ?? "Unknown file"}
                      </span>
                    </div>

                    {/* Status indicator — compact, no badge */}
                    <StatusIndicator status={latestJob.status} />

                    {/* Timestamp */}
                    <span className="shrink-0 text-[11px] text-muted-foreground/40">
                      {formatRelativeTime(latestJob.created_at)}
                    </span>

                    {/* Stop button — active jobs only */}
                    {isLatestActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px] text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => cancelOne.mutate(latestJob.file_id)}
                        disabled={cancelOne.isPending}
                      >
                        <Square className="h-3 w-3 fill-current" />
                        Stop
                      </Button>
                    )}

                    {/* Reprocess button */}
                    {canReprocess && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setReprocessTarget({
                            id: latestJob.file_id,
                            name: latestJob.file_name ?? "Unknown file",
                          })
                        }
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reprocess
                      </Button>
                    )}
                  </div>

                  {/* Steps row — compact, text-only, beneath the header */}
                  <StepsRow job={latestJob} />

                  {/* Progress bar for active jobs */}
                  {isLatestActive && (
                    <div className="flex items-center gap-2 px-3 pb-2.5">
                      <Progress value={latestJob.progress} className="h-1 flex-1" />
                      <span className="text-[10px] tabular-nums text-muted-foreground/60">
                        {Math.round(latestJob.progress)}%
                      </span>
                    </div>
                  )}

                  {/* Error for latest */}
                  {latestJob.status === "failed" && latestJob.error_message && (
                    <div className="mx-3 mb-2.5 flex items-start gap-1.5 rounded-md bg-destructive/5 px-2.5 py-1.5">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive/70" />
                      <p className="text-[11px] text-destructive/80 line-clamp-2">
                        {latestJob.error_message}
                      </p>
                    </div>
                  )}

                  {/* Previous runs toggle */}
                  {hasMultipleRuns && (
                    <>
                      <button
                        onClick={() => toggleExpanded(fileId)}
                        className="flex w-full items-center gap-1.5 border-t border-[var(--overlay-4)] px-3 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:bg-[var(--overlay-2)] hover:text-muted-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {fileJobs.length - 1} previous run{fileJobs.length - 1 !== 1 ? "s" : ""}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[var(--overlay-4)] bg-[var(--overlay-2)]">
                          {fileJobs.slice(1).map((job) => (
                            <HistoryRow key={job.id} job={job} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reprocessTarget && (
        <ReprocessDialog
          workspaceId={workspaceId}
          fileId={reprocessTarget.id}
          fileName={reprocessTarget.name}
          open={true}
          onOpenChange={(open) => {
            if (!open) setReprocessTarget(null);
          }}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 min-w-[160px] rounded-md border border-[var(--overlay-8)] bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => {
              router.push(`/app/${workspaceId}/file/${ctxMenu.fileId}`);
              setCtxMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View file
          </button>
          {ctxMenu.canReprocess && (
            <button
              onClick={() => {
                setReprocessTarget({ id: ctxMenu.fileId, name: ctxMenu.fileName });
                setCtxMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reprocess
            </button>
          )}
          <div className="my-1 h-px bg-[var(--overlay-6)]" />
          <button
            onClick={() => {
              navigator.clipboard.writeText(ctxMenu.fileName);
              setCtxMenu(null);
            }}
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

/* ---------- Step status parsing — handles "failed: reason" format ---------- */

function parseStepStatus(raw: string): { status: string; reason: string | null } {
  if (raw.startsWith("failed:")) {
    return { status: "failed", reason: raw.slice(7).trim() };
  }
  return { status: raw, reason: null };
}

/* ---------- Steps row — compact text with dots and failure reasons ---------- */

function StepsRow({ job }: { job: ProcessingJob }) {
  const visibleSteps = Object.entries(job.steps ?? {}).filter(
    ([, raw]) => raw !== "skipped",
  );

  if (visibleSteps.length === 0) return null;

  const failedSteps = visibleSteps
    .map(([step, raw]) => ({ step, ...parseStepStatus(raw) }))
    .filter((s) => s.status === "failed" && s.reason);

  return (
    <div className="space-y-1 px-3 pb-2">
      <div className="flex items-center gap-1">
        {visibleSteps.map(([step, raw], i) => {
          const { status } = parseStepStatus(raw);
          return (
            <span key={step} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground/20">&middot;</span>}
              <StepDot status={status} />
              <span className={cn(
                "text-[11px]",
                status === "completed" ? "text-muted-foreground/60" :
                status === "failed" ? "text-destructive/70" :
                status === "running" ? "text-blue-400" :
                "text-muted-foreground/40",
              )}>
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
            </span>
          );
        })}
      </div>
      {failedSteps.map(({ step, reason }) => (
        <div key={step} className="flex items-start gap-1.5 text-[10px] text-destructive/60">
          <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
          <span className="line-clamp-2">
            <span className="font-medium">{step.charAt(0).toUpperCase() + step.slice(1)}:</span>{" "}
            {reason}
          </span>
        </div>
      ))}
    </div>
  );
}

function StepDot({ status }: { status: string }) {
  if (status === "running") {
    return <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-400" />;
  }
  return (
    <span className={cn(
      "inline-block h-1.5 w-1.5 rounded-full",
      status === "completed" ? "bg-emerald-400/60" :
      status === "failed" ? "bg-destructive/60" :
      "bg-muted-foreground/30",
    )} />
  );
}

/* ---------- History row — minimal for previous runs ---------- */

function HistoryRow({ job }: { job: ProcessingJob }) {
  const failedSteps = Object.entries(job.steps ?? {})
    .map(([step, raw]) => ({ step, ...parseStepStatus(raw) }))
    .filter((s) => s.status === "failed" && s.reason);

  return (
    <div className="space-y-0.5 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <StatusIndicator status={job.status} />
        <StepsInline job={job} />
        <div className="flex-1" />
        <span className="shrink-0 text-[10px] text-muted-foreground/40">
          {formatRelativeTime(job.created_at)}
        </span>
      </div>
      {job.status === "failed" && job.error_message && (
        <div className="flex items-start gap-1.5 pl-5 text-[10px] text-destructive/60">
          <span className="line-clamp-1">{job.error_message}</span>
        </div>
      )}
      {failedSteps.map(({ step, reason }) => (
        <div key={step} className="flex items-start gap-1.5 pl-5 text-[10px] text-destructive/60">
          <span className="line-clamp-1">
            <span className="font-medium">{step.charAt(0).toUpperCase() + step.slice(1)}:</span>{" "}
            {reason}
          </span>
        </div>
      ))}
    </div>
  );
}

function StepsInline({ job }: { job: ProcessingJob }) {
  const visibleSteps = Object.entries(job.steps ?? {}).filter(
    ([, raw]) => raw !== "skipped",
  );

  if (visibleSteps.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {visibleSteps.map(([step, raw], i) => {
        const { status } = parseStepStatus(raw);
        return (
          <span key={step} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/20">&middot;</span>}
            <StepDot status={status} />
            <span className={cn(
              "text-[10px]",
              status === "completed" ? "text-muted-foreground/50" :
              status === "failed" ? "text-destructive/60" :
              status === "running" ? "text-blue-400/80" :
              "text-muted-foreground/30",
            )}>
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const fileIcon = mimeType ? getFileIcon(mimeType) : null;
  const Icon = fileIcon?.icon ?? Clock;
  const iconColor = fileIcon?.color ?? "text-muted-foreground";

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--overlay-4)]">
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </div>
  );
}

function StatusIndicator({ status }: { status: ProcessingJob["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />;
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />;
    case "partial":
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400/80" />;
    case "failed":
      return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive/70" />;
    case "cancelled":
      return <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />;
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
