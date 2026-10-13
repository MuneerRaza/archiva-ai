"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddDetection,
  useDeleteDetection,
  useDetectPII,
  useLatestPIIRun,
  useRedactPII,
  useUpdateDetection,
} from "@/lib/queries/pii";
import { useWorkspace } from "@/lib/queries/workspaces";
import { TEXT_ENTITY_OPTIONS } from "@/lib/pii-catalog";
import type {
  PIIDetection,
  PIIModality,
  PIISettings,
  RedactionMethod,
  RedactMode,
} from "@/types/models";

interface PIIPanelProps {
  workspaceId: string;
  fileId: string;
  modality: PIIModality;
}

const METHOD_LABELS: Record<RedactionMethod, string> = {
  mask: "Mask (████)",
  label: "Label ([TYPE])",
  box: "Black box",
  blur: "Blur",
  beep: "Beep",
  silence: "Silence",
};

function methodOptionsFor(modality: PIIModality): RedactionMethod[] {
  switch (modality) {
    case "document":
      return ["box"];
    case "image":
    case "video":
      return ["box", "blur"];
    case "audio":
      return ["beep", "silence"];
    default:
      return ["mask", "label"];
  }
}

export function PIIPanel({ workspaceId, fileId, modality }: PIIPanelProps) {
  const { data: run } = useLatestPIIRun(workspaceId, fileId);
  const { data: workspace } = useWorkspace(workspaceId);
  const detect = useDetectPII(workspaceId, fileId);
  const redact = useRedactPII(workspaceId, fileId);

  const classesForModality = pickClasses(workspace?.settings?.ingestion?.pii, modality);

  const detections = useMemo(() => run?.detections ?? [], [run]);
  const grouped = useMemo(() => groupByType(detections), [detections]);

  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<RedactMode>("copy");
  const methodOptions = methodOptionsFor(modality);
  const [method, setMethod] = useState<RedactionMethod>(methodOptions[0]);

  const selectedIds = useMemo(
    () => detections.filter((d) => !deselected.has(d.id)).map((d) => d.id),
    [detections, deselected],
  );
  const selectedCount = selectedIds.length;
  const canAddManual = modality !== "image" && modality !== "video";

  function toggle(id: string) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runDetect() {
    detect.mutate({ modality, classes: classesForModality });
  }

  function handleRedact() {
    if (!run || selectedCount === 0) return;
    redact.mutate({
      runId: run.id,
      mode,
      method: methodOptions.includes(method) ? method : methodOptions[0],
      detection_ids: selectedIds,
    });
  }

  const hasRun = !!run;
  const isEmpty = hasRun && detections.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--overlay-6)] px-4 py-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          PII
        </span>
        {hasRun && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={runDetect}
            disabled={detect.isPending}
          >
            {detect.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Re-scan
          </Button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasRun && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              Scan this file for personally identifiable information.
            </p>
            <Button onClick={runDetect} disabled={detect.isPending} size="sm">
              {detect.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Detect PII
            </Button>
          </div>
        )}

        {hasRun && (
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                {detections.length} item{detections.length === 1 ? "" : "s"}
                {detections.length > 0 && ` · ${selectedCount} selected`}
              </span>
            </div>

            {isEmpty && (
              <p className="text-[13px] text-muted-foreground/70">
                No PII detected automatically. You can add items to redact below.
              </p>
            )}

            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {friendlyType(type)} ({items.length})
                </p>
                {items.map((d) => (
                  <DetectionRow
                    key={d.id}
                    detection={d}
                    runId={run.id}
                    workspaceId={workspaceId}
                    fileId={fileId}
                    selected={!deselected.has(d.id)}
                    onToggle={() => toggle(d.id)}
                  />
                ))}
              </div>
            ))}

            {canAddManual && (
              <AddDetectionForm
                workspaceId={workspaceId}
                fileId={fileId}
                runId={run.id}
                modality={modality}
              />
            )}
          </div>
        )}
      </div>

      {/* Redaction controls */}
      {hasRun && detections.length > 0 && (
        <div className="space-y-3 border-t border-[var(--overlay-6)] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Output</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as RedactMode)}>
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copy">New redacted copy</SelectItem>
                  <SelectItem value="in_place">Redact in place</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as RedactionMethod)}
                disabled={methodOptions.length === 1}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methodOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={handleRedact}
            disabled={selectedCount === 0 || redact.isPending}
          >
            {redact.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Redact {selectedCount} item{selectedCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface DetectionRowProps {
  detection: PIIDetection;
  runId: string;
  workspaceId: string;
  fileId: string;
  selected: boolean;
  onToggle: () => void;
}

function DetectionRow({
  detection,
  runId,
  workspaceId,
  fileId,
  selected,
  onToggle,
}: DetectionRowProps) {
  const update = useUpdateDetection(workspaceId, fileId);
  const remove = useDeleteDetection(workspaceId, fileId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(detection.value ?? "");

  const editable = detection.value !== null;
  const busy = update.isPending || remove.isPending;

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === detection.value) return;
    update.mutate({ runId, detectionId: detection.id, value: trimmed });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
          className="h-7 flex-1 font-mono text-[12px]"
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--overlay-3)]">
      <Checkbox checked={selected} onCheckedChange={onToggle} disabled={busy} />
      <span className="flex-1 truncate font-mono text-[12px]">
        {detection.value ?? `${friendlyType(detection.entity_type)} region`}
      </span>
      {detection.source === "manual" && (
        <span className="text-[10px] text-primary/60">added</span>
      )}
      {editable && (
        <button
          onClick={() => {
            setDraft(detection.value ?? "");
            setEditing(true);
          }}
          className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Edit value"
          disabled={busy}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={() => remove.mutate({ runId, detectionId: detection.id })}
        className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label="Remove item"
        disabled={busy}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

interface AddDetectionFormProps {
  workspaceId: string;
  fileId: string;
  runId: string;
  modality: PIIModality;
}

function AddDetectionForm({ workspaceId, fileId, runId }: AddDetectionFormProps) {
  const add = useAddDetection(workspaceId, fileId);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [entityType, setEntityType] = useState("CUSTOM");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    add.mutate(
      { runId, entity_type: entityType, value: trimmed },
      {
        onSuccess: () => {
          setValue("");
          setEntityType("CUSTOM");
          setOpen(false);
        },
      },
    );
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-[12px]"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add item to redact
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-[var(--overlay-6)] p-2.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Text to redact (must appear in the file)"
        className="h-8 text-[12px]"
      />
      <div className="flex items-center gap-2">
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="h-8 flex-1 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CUSTOM">Custom</SelectItem>
            {TEXT_ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={submit}
          disabled={add.isPending || !value.trim()}
          aria-label="Add"
        >
          {add.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function groupByType(detections: PIIDetection[]): Record<string, PIIDetection[]> {
  const out: Record<string, PIIDetection[]> = {};
  for (const d of detections) {
    (out[d.entity_type] ??= []).push(d);
  }
  return out;
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TEXT_ENTITY_OPTIONS.map((o) => [o.value, o.label]),
);

function friendlyType(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  if (type === "CUSTOM") return "Custom";
  // Title-case visual classes ("person") and unknown entity codes.
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace(/_/g, " ");
}

/** The workspace's default class/entity list for this modality. */
function pickClasses(
  pii: PIISettings | undefined,
  modality: PIIModality,
): string[] | undefined {
  if (!pii) return undefined;
  switch (modality) {
    case "image":
      return pii.image_classes;
    case "video":
      return pii.video_classes;
    case "audio":
      return pii.audio_entities;
    default:
      return pii.text_entities;
  }
}
