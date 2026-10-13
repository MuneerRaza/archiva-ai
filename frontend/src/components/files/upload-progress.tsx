"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsMutating, useMutationState } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, Square, Upload, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProcessingHistory } from "@/lib/queries/processing";
import { useUploadStore } from "@/stores/upload-store";

interface UploadProgressProps {
  workspaceId: string;
}

type Phase = "uploading" | "processing" | "done" | "hidden";

export function UploadProgress({ workspaceId }: UploadProgressProps) {
  const router = useRouter();
  const uploadingFiles = useIsMutating({ mutationKey: ["upload-file"] });
  const uploadingFolder = useIsMutating({ mutationKey: ["upload-folder"] });
  const uploading = uploadingFiles + uploadingFolder;
  const { data: jobs } = useProcessingHistory(workspaceId);

  // Folder upload store
  const folderPhase = useUploadStore((s) => s.folderPhase);
  const folderTotal = useUploadStore((s) => s.total);
  const folderDone = useUploadStore((s) => s.done);
  const folderFailed = useUploadStore((s) => s.failed);
  const foldersTotal = useUploadStore((s) => s.foldersTotal);
  const foldersDone = useUploadStore((s) => s.foldersDone);

  const activeJobs = jobs?.filter(
    (j) => j.status === "queued" || j.status === "running",
  ) ?? [];

  const failedMutations = useMutationState({
    filters: { mutationKey: ["upload-file"], status: "error" },
    select: (m) => m.state.submittedAt,
  });

  const succeededMutations = useMutationState({
    filters: { mutationKey: ["upload-file"], status: "success" },
    select: (m) => m.state.submittedAt,
  });

  const [phase, setPhase] = useState<Phase>("hidden");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUploadingRef = useRef(0);
  const hadActivityRef = useRef(false);
  const batchStartRef = useRef<number>(0);

  // Track uploaded count — when uploading drops, count the difference
  useEffect(() => {
    const prev = prevUploadingRef.current;
    if (uploading > 0 && prev === 0) {
      batchStartRef.current = Date.now();
      setUploadedCount(0);
      setDismissed(false);
      hadActivityRef.current = true;
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    }
    if (uploading > 0) {
      setUploadedCount((c) => Math.max(c, uploading));
    }
    prevUploadingRef.current = uploading;
  }, [uploading]);

  // Count failures and successes in the current batch
  const batchStart = batchStartRef.current;
  const failedCount = failedMutations.filter((t) => t >= batchStart).length;
  const succeededCount = succeededMutations.filter((t) => t >= batchStart).length;
  const hasFailures = failedCount > 0;
  const totalSettled = failedCount + succeededCount;

  // Determine phase
  useEffect(() => {
    if (uploading > 0) {
      setPhase("uploading");
      hadActivityRef.current = true;
      return;
    }
    if (activeJobs.length > 0) {
      setPhase("processing");
      hadActivityRef.current = true;
      setDismissed(false);
      return;
    }
    // Nothing active
    if (hadActivityRef.current && phase !== "hidden") {
      setPhase("done");
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setPhase("hidden");
        hadActivityRef.current = false;
      }, 4000);
    }
  }, [uploading, activeJobs.length, phase]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (phase === "hidden" || dismissed) return null;

  function handleClick() {
    router.push(`/app/${workspaceId}/activity`);
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setDismissed(true);
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    useUploadStore.getState().cancelFolderUpload();
  }

  // Folder upload progress
  const isFolderActive = folderPhase !== "idle" && folderPhase !== "done";
  const folderProgress = folderTotal > 0 ? Math.round((folderDone / folderTotal) * 100) : 0;

  // Processing wave: the in-flight jobs plus everything that finished since
  // the wave's oldest still-active job was queued. Gives a done / total count
  // instead of just "how many are running right now".
  let waveDone = 0;
  let waveTotal = activeJobs.length;
  if (activeJobs.length > 0 && jobs) {
    const waveStart = Math.min(
      ...activeJobs.map((j) => new Date(j.created_at).getTime()),
    );
    waveDone = jobs.filter(
      (j) =>
        (j.status === "completed" ||
          j.status === "partial" ||
          j.status === "failed") &&
        new Date(j.created_at).getTime() >= waveStart,
    ).length;
    waveTotal = waveDone + activeJobs.length;
  }
  const waveProgress =
    waveTotal > 0 ? Math.round((waveDone / waveTotal) * 100) : 0;
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-72 rounded-lg border bg-popover shadow-lg transition-all",
        phase === "done" && hasFailures
          ? "border-red-500/20"
          : phase === "done"
            ? "border-green-500/20"
            : "border-[var(--overlay-8)]",
      )}
    >
      <button
        onClick={handleClick}
        className="w-full cursor-pointer p-3 pr-8 text-left transition-colors hover:bg-popover/90"
      >
        <div className="flex items-center gap-2.5">
          {phase === "uploading" && (
            <>
              <Upload className="h-4 w-4 shrink-0 text-blue-400" />
              <span className="flex-1 text-[13px] font-medium">
                {isFolderActive && folderPhase === "creating-folders" ? (
                  foldersTotal > 0
                    ? `Creating folders ${foldersDone} / ${foldersTotal}...`
                    : "Creating folders..."
                ) : isFolderActive && folderPhase === "uploading" ? (
                  <>Uploading {folderDone} / {folderTotal} files...</>
                ) : uploadingFolder > 0 ? (
                  `Uploading folder${uploadingFiles > 0 ? ` + ${uploadingFiles} file${uploadingFiles > 1 ? "s" : ""}` : ""}...`
                ) : (
                  `Uploading ${uploading} file${uploading > 1 ? "s" : ""}...`
                )}
                {(hasFailures || (isFolderActive && folderFailed > 0)) && (
                  <span className="text-red-400"> ({isFolderActive ? folderFailed : failedCount} failed)</span>
                )}
              </span>
            </>
          )}
          {phase === "processing" && (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
              <span className="flex-1 text-[13px] font-medium">
                Processing {waveDone} / {waveTotal} file{waveTotal !== 1 ? "s" : ""}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {waveTotal - waveDone} left
              </span>
            </>
          )}
          {phase === "done" && !hasFailures && (
            <>
              <Check className="h-4 w-4 shrink-0 text-green-400" />
              <span className="flex-1 text-[13px] font-medium text-green-400">
                {totalSettled > 1 ? `${totalSettled} files uploaded` : "Upload complete"}
              </span>
            </>
          )}
          {phase === "done" && hasFailures && (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="flex-1 text-[13px] font-medium text-red-400">
                {succeededCount} uploaded, {failedCount} failed
              </span>
            </>
          )}
        </div>

        {phase === "uploading" && isFolderActive && folderPhase === "creating-folders" ? (
          <Progress value={foldersTotal > 0 ? Math.round((foldersDone / foldersTotal) * 100) : undefined} className="mt-2 h-1" />
        ) : phase === "uploading" && isFolderActive && folderPhase === "uploading" ? (
          <Progress value={folderProgress} className="mt-2 h-1" />
        ) : phase !== "done" ? (
          <Progress
            value={phase === "processing" ? waveProgress : undefined}
            className="mt-2 h-1"
          />
        ) : null}

        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {phase === "done" ? "Click to view logs" : "Click to view activity"}
        </p>
      </button>

      {/* Cancel button for active folder uploads */}
      {phase === "uploading" && isFolderActive && (
        <button
          onClick={handleCancel}
          className="absolute right-2 top-2.5 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="Cancel upload"
          title="Cancel upload"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Dismiss button (only when not showing cancel) */}
      {!(phase === "uploading" && isFolderActive) && (
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2.5 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-[var(--overlay-6)] hover:text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
