"use client";

import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FileStatus } from "@/types/models";

const STATUS_CONFIG: Record<
  FileStatus,
  { label: string; className: string; spinning?: boolean }
> = {
  uploaded: {
    label: "Uploaded",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
  processing: {
    label: "Processing",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    spinning: true,
  },
  ready: {
    label: "Processed",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  partial: {
    label: "Partial",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
};

interface FileStatusBadgeProps {
  status: FileStatus;
  compact?: boolean;
}

export function FileStatusBadge({ status, compact }: FileStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (compact) {
    // Only show dot while actively processing
    if (status !== "processing") return null;
    return (
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px] font-medium", config.className)}
    >
      {config.spinning && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {config.label}
    </Badge>
  );
}
