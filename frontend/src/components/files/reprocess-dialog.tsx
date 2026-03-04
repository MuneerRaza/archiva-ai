"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReprocess } from "@/lib/queries/processing";
import { useWorkspace } from "@/lib/queries/workspaces";
import type { IngestionSettings } from "@/types/models";

type FileCategory = "document" | "text" | "spreadsheet" | "image" | "audio" | "video" | "unknown";

interface StepDef {
  id: string;
  label: string;
  description: string;
}

const STEP_DEFS: Record<string, StepDef> = {
  extraction: { id: "extraction", label: "Extraction", description: "Re-extract text content from the file" },
  transcription: { id: "transcription", label: "Transcription", description: "Transcribe audio using speech-to-text" },
  description: { id: "description", label: "Description", description: "Generate a description using vision model" },
  overview: { id: "overview", label: "Overview", description: "Generate a brief 1-2 sentence overview" },
  summary: { id: "summary", label: "Summary", description: "Generate an AI summary of the content" },
  structure: { id: "structure", label: "Structure", description: "Extract document structure and headings" },
};

export function resolveCategory(mimeType: string, fileName: string): FileCategory {
  const exactMap: Record<string, FileCategory> = {
    "application/pdf": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
    "application/vnd.ms-excel": "spreadsheet",
    "text/csv": "spreadsheet",
  };
  if (exactMap[mimeType]) return exactMap[mimeType];
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("text/")) return "text";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["json", "md", "py", "js", "ts", "tsx", "jsx", "go", "rs", "java", "c", "cpp"].includes(ext)) return "text";
  return "unknown";
}

/**
 * Derive available processing steps from workspace ingestion settings + file category.
 * Returns step IDs in pipeline order.
 */
export function getStepsForCategory(ingestion: IngestionSettings, category: FileCategory): string[] {
  const steps: string[] = [];

  switch (category) {
    case "document": {
      steps.push("extraction");
      if (ingestion.document.structure) steps.push("structure");
      if (ingestion.document.summary && ingestion.summary_model_id) steps.push("summary");
      if (ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
    case "text": {
      steps.push("extraction");
      if (ingestion.text.summary && ingestion.summary_model_id) steps.push("summary");
      if (ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
    case "spreadsheet": {
      steps.push("extraction");
      if (ingestion.spreadsheet.summary && ingestion.summary_model_id) steps.push("summary");
      if (ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
    case "image": {
      const hasDescription = ingestion.image.description && !!ingestion.vision_model_id;
      if (hasDescription) steps.push("description");
      // Overview/summary need content — for images that comes from description
      if (hasDescription && ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
    case "audio": {
      const hasTranscription = ingestion.audio.transcription && !!ingestion.transcription_model_id;
      if (hasTranscription) steps.push("transcription");
      // Summary/overview need content — for audio that comes from transcription
      if (hasTranscription && ingestion.audio.summary && ingestion.summary_model_id) steps.push("summary");
      if (hasTranscription && ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
    case "video": {
      const hasVideoTranscription = ingestion.video.transcription && !!ingestion.transcription_model_id;
      const hasVideoDescription = ingestion.video.description && !!ingestion.vision_model_id;
      const hasContent = hasVideoTranscription || hasVideoDescription;
      if (hasVideoTranscription) steps.push("transcription");
      if (hasVideoDescription) steps.push("description");
      // Summary/overview need content — from transcription or description
      if (hasContent && ingestion.video.summary && ingestion.summary_model_id) steps.push("summary");
      if (hasContent && ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
    default: {
      steps.push("extraction");
      if (ingestion.summary_model_id) steps.push("summary");
      if (ingestion.generate_overview && ingestion.summary_model_id) steps.push("overview");
      break;
    }
  }

  return steps;
}

export function getStepsForFile(ingestion: IngestionSettings, mimeType: string, fileName: string): string[] {
  return getStepsForCategory(ingestion, resolveCategory(mimeType, fileName));
}

// --- Single file reprocess ---

interface SingleReprocessDialogProps {
  workspaceId: string;
  fileId: string;
  fileName: string;
  mimeType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReprocessDialog({
  workspaceId,
  fileId,
  fileName,
  mimeType,
  open,
  onOpenChange,
}: SingleReprocessDialogProps) {
  const { data: workspace } = useWorkspace(workspaceId);
  const ingestion = workspace?.settings?.ingestion;

  const availableStepIds = useMemo(() => {
    if (!ingestion) return [];
    return getStepsForFile(ingestion, mimeType ?? "", fileName);
  }, [ingestion, mimeType, fileName]);

  const steps = availableStepIds
    .map((id) => STEP_DEFS[id])
    .filter(Boolean);

  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());

  // Sync selected steps when available steps change
  useEffect(() => {
    setSelectedSteps(new Set(availableStepIds));
  }, [availableStepIds]);

  const reprocess = useReprocess(workspaceId);

  function toggleStep(stepId: string) {
    setSelectedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  function handleConfirm() {
    const selected = Array.from(selectedSteps);
    reprocess.mutate(
      { fileId, steps: selected },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedSteps(new Set(availableStepIds));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reprocess File</DialogTitle>
          <DialogDescription className="truncate">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {steps.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No processing steps available for this file type. Configure models and enable features in workspace settings.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                Select which processing steps to run:
              </p>
              {steps.map((step) => (
                <label
                  key={step.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--overlay-6)] p-3 transition-colors hover:bg-[var(--overlay-2)]"
                >
                  <Checkbox
                    checked={selectedSteps.has(step.id)}
                    onCheckedChange={() => toggleStep(step.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{step.label}</p>
                    <p className="text-[12px] text-muted-foreground">{step.description}</p>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedSteps.size === 0 || reprocess.isPending}
          >
            {reprocess.isPending ? "Starting..." : "Reprocess"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Bulk reprocess ---

interface BulkFile {
  id: string;
  name: string;
  mime_type: string;
}

interface BulkReprocessDialogProps {
  workspaceId: string;
  files: BulkFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkReprocessDialog({
  workspaceId,
  files,
  open,
  onOpenChange,
}: BulkReprocessDialogProps) {
  const { data: workspace } = useWorkspace(workspaceId);
  const ingestion = workspace?.settings?.ingestion;
  const reprocess = useReprocess(workspaceId);

  const categories = useMemo(
    () => new Set(files.map((f) => resolveCategory(f.mime_type, f.name))),
    [files],
  );
  const isMixed = categories.size > 1;

  const availableStepIds = useMemo(() => {
    if (!ingestion) return [];
    if (isMixed) return [];
    const singleCategory = Array.from(categories)[0] ?? "unknown";
    return getStepsForCategory(ingestion, singleCategory);
  }, [ingestion, isMixed, categories]);

  const steps = availableStepIds
    .map((id) => STEP_DEFS[id])
    .filter(Boolean);

  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedSteps(new Set(availableStepIds));
  }, [availableStepIds]);

  function toggleStep(stepId: string) {
    setSelectedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (!ingestion) return;

    if (isMixed) {
      for (const file of files) {
        const fileSteps = getStepsForFile(ingestion, file.mime_type, file.name);
        if (fileSteps.length > 0) {
          reprocess.mutate({ fileId: file.id, steps: fileSteps });
        }
      }
    } else {
      const selected = Array.from(selectedSteps);
      for (const file of files) {
        reprocess.mutate({ fileId: file.id, steps: selected });
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reprocess {files.length} Files</DialogTitle>
          <DialogDescription>
            {isMixed
              ? "Selected files have different types"
              : `All ${Array.from(categories)[0] ?? "unknown"} files`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isMixed ? (
            <p className="text-[13px] text-muted-foreground">
              Each file will be reprocessed according to its type and your workspace ingestion settings.
            </p>
          ) : steps.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No processing steps available for this file type. Configure models and enable features in workspace settings.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                Select which processing steps to run:
              </p>
              {steps.map((step) => (
                <label
                  key={step.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--overlay-6)] p-3 transition-colors hover:bg-[var(--overlay-2)]"
                >
                  <Checkbox
                    checked={selectedSteps.has(step.id)}
                    onCheckedChange={() => toggleStep(step.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{step.label}</p>
                    <p className="text-[12px] text-muted-foreground">{step.description}</p>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(!isMixed && selectedSteps.size === 0) || reprocess.isPending}
          >
            {reprocess.isPending ? "Starting..." : "Reprocess"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
