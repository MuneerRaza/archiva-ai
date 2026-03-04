"use client";

import { Download, FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

interface FallbackViewerProps {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function FallbackViewer({
  fileName,
  mimeType,
  sizeBytes,
  downloadUrl,
}: FallbackViewerProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--overlay-8)] bg-[var(--overlay-3)]">
        <FileQuestion className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h3 className="text-[15px] font-medium">{fileName}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {mimeType} &middot; {formatBytes(sizeBytes)}
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Preview not available for this file type
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => window.open(downloadUrl, "_blank")}
      >
        <Download className="mr-2 h-4 w-4" />
        Download
      </Button>
    </div>
  );
}
