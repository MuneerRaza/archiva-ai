"use client";

import {
  Eye,
  FileText,
  FolderOpen,
  Search,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ToolCallEvent } from "@/stores/chat-store";

const TOOL_ICONS: Record<string, typeof Search> = {
  browse: FolderOpen,
  search: Search,
  get_info: Eye,
  read: FileText,
};

const TOOL_LABELS: Record<string, string> = {
  browse: "Browse files",
  search: "Search",
  get_info: "Get info",
  read: "Read file",
};

/** Params that are internal IDs — never show in UI */
const HIDDEN_PARAMS = new Set(["workspace_id", "file_id", "folder_id"]);

/** Default values — hide param when it matches its default */
const DEFAULT_VALUES: Record<string, unknown> = {
  offset: 0,
  sort_by: "name",
  match: "",
  include: "summary,structure,metadata,tags",
};

/** Per-tool default limits */
const DEFAULT_LIMITS: Record<string, number> = {
  browse: 30,
  search: 10,
};

/**
 * Resolve a human-readable subject (file/folder name) from tool result output.
 */
function resolveSubject(
  toolName: string,
  args: Record<string, unknown>,
  output: string,
): string {
  if (toolName === "browse") {
    if (!args.folder_id) return "home";
    const m = output.match(/^Contents of folder: (.+)$/m);
    return m ? m[1] : "folder";
  }
  if (toolName === "get_info" || toolName === "read") {
    const m = output.match(/^File: (.+)$/m) ?? output.match(/Content of '([^']+)'/);
    return m ? m[1] : "file";
  }
  if (toolName === "search") {
    const query = args.query as string | undefined;
    return query ? `\u201c${query}\u201d` : "";
  }
  return "";
}

/**
 * Collect non-hidden, non-default params for display after the subject.
 */
function collectExtraParams(
  toolName: string,
  args: Record<string, unknown>,
): string[] {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    if (HIDDEN_PARAMS.has(key)) continue;
    if (value === null || value === undefined) continue;

    // Skip query for search — it's already the subject
    if (toolName === "search" && key === "query") continue;

    // Check defaults
    if (key in DEFAULT_VALUES && value === DEFAULT_VALUES[key]) continue;
    if (key === "limit" && value === (DEFAULT_LIMITS[toolName] ?? -1)) continue;

    // Format include as comma list without key name
    if (key === "include" && typeof value === "string") {
      parts.push(value);
      continue;
    }

    // Format match with quotes
    if (key === "match" && typeof value === "string" && value) {
      parts.push(`match: \u201c${value}\u201d`);
      continue;
    }

    parts.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }

  return parts;
}

/**
 * Format tool arguments for user-friendly display.
 * Shows resolved name + non-default params.
 */
function formatArgsDisplay(
  toolName: string,
  args: Record<string, unknown>,
  result?: Record<string, unknown>,
): string {
  const output = typeof result?.output === "string" ? result.output : "";
  const subject = resolveSubject(toolName, args, output);
  const extra = collectExtraParams(toolName, args);

  if (!subject && extra.length === 0) return "";
  if (!subject) return extra.join(", ");
  if (extra.length === 0) return subject;
  return `${subject} · ${extra.join(", ")}`;
}

interface ToolCallCardProps {
  toolCall: ToolCallEvent;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const Icon = TOOL_ICONS[toolCall.name] ?? Wrench;
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const isRunning = toolCall.status === "running";

  const argsDisplay = formatArgsDisplay(toolCall.name, toolCall.arguments, toolCall.result);

  return (
    <div className={cn(
      "my-1 rounded-lg border bg-[var(--overlay-2)] transition-colors",
      isRunning
        ? "border-primary/30 bg-primary/[0.03]"
        : "border-[var(--overlay-8)]",
    )}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg">
        {isRunning ? (
          <div className="relative h-4 w-4 shrink-0">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <div className="absolute inset-0.5 rounded-full bg-primary/60" />
          </div>
        ) : (
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        {isRunning && <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="font-medium text-foreground">{label}</span>
        {argsDisplay && (
          <span className="truncate text-muted-foreground">
            {argsDisplay}
          </span>
        )}
        {isRunning && (
          <span className="ml-auto text-[10px] text-primary/70">working...</span>
        )}
      </div>
    </div>
  );
}

// Variant for displaying tool calls from message history (not live streaming)
interface ToolCallMessageProps {
  toolName: string;
  toolArgs: Record<string, unknown> | null;
  toolResult?: Record<string, unknown> | null;
}

export function ToolCallMessage({ toolName, toolArgs, toolResult }: ToolCallMessageProps) {
  const tc: ToolCallEvent = {
    id: `hist-${toolName}-${Date.now()}-${Math.random()}`,
    name: toolName,
    arguments: toolArgs ?? {},
    result: toolResult ?? undefined,
    status: "done",
  };
  return <ToolCallCard toolCall={tc} />;
}
