"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsMutating, useMutationState } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronRight, Loader2, Upload, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProcessingHistory } from "@/lib/queries/processing";

interface UploadProgressProps {
  workspaceId: string;
}

type Phase = "uploading" | "processing" | "done" | "hidden";

export function UploadProgress({ workspaceId }: UploadProgressProps) {
  const router = useRouter();
  const pathname = usePathname();
  const uploading = useIsMutating({ mutationKey: ["upload-file"] });
  const { data: jobs } = useProcessingHistory(workspaceId);

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

  const isOnActivityPage = pathname === `/app/${workspaceId}/activity`;

  // Track uploaded count — when uploading drops, count the difference
  useEffect(() => {
    const prev = prevUploadingRef.current;
    if (uploading > 0 && prev === 0) {
      // Upload batch started — record timestamp to filter mutations
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
      // While uploading, track max seen
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

  if (phase === "hidden" || dismissed || isOnActivityPage) return null;

  function handleClick() {
    router.push(`/app/${workspaceId}/activity`);
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setDismissed(true);
  }

  const avgProgress = activeJobs.length > 0
    ? Math.round(activeJobs.reduce((sum, j) => sum + (j.progress ?? 0), 0) / activeJobs.length)
    : undefined;
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
                Uploading {uploading} file{uploading > 1 ? "s" : ""}...
                {hasFailures && (
                  <span className="text-red-400"> ({failedCount} failed)</span>
                )}
              </span>
            </>
          )}
          {phase === "processing" && (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
              <span className="flex-1 text-[13px] font-medium">
                Processing {activeJobs.length} file{activeJobs.length > 1 ? "s" : ""}
              </span>
              {avgProgress !== undefined && avgProgress > 0 && (
                <span className="text-[11px] text-muted-foreground">{avgProgress}%</span>
              )}
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

        {phase !== "done" && (
          <Progress
            value={phase === "processing" ? avgProgress : undefined}
            className="mt-2 h-1"
          />
        )}

        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {phase === "done" ? "Click to view logs" : "Click to view activity"}
        </p>
      </button>

      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2.5 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-[var(--overlay-6)] hover:text-muted-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
