"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentViewerProps {
  url: string;
  downloadUrl: string;
  fileName: string;
  scrollToAnchor?: string;
  onNavigateComplete?: () => void;
}

export function DocumentViewer({ url, downloadUrl, fileName, scrollToAnchor, onNavigateComplete }: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();

        // Dynamic import — bundler resolves browser-compatible entry via package.json "browser" field
        const mammothModule = await import("mammoth");
        // CJS→ESM interop: convertToHtml may be on .default or directly on module
        const mod = mammothModule as Record<string, unknown>;
        const mammoth = (mod.default ?? mammothModule) as typeof mammothModule;
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (!cancelled) {
          setHtml(result.value);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render document");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  // Inject heading IDs after HTML is rendered into the DOM
  useEffect(() => {
    if (loading || !html || !containerRef.current) return;
    const headings = containerRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings.forEach((el, i) => {
      el.id = `heading-${i}`;
    });
  }, [loading, html]);

  // Scroll to anchor when requested
  useEffect(() => {
    if (!scrollToAnchor || loading || !containerRef.current) return;
    const el = containerRef.current.querySelector(`#${CSS.escape(scrollToAnchor)}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onNavigateComplete?.();
  }, [scrollToAnchor, loading, onNavigateComplete]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <FileText className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(downloadUrl, "_blank")}
        >
          <Download className="mr-2 h-4 w-4" />
          Download instead
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--overlay-6)] px-4 py-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-[12px] text-muted-foreground truncate">{fileName}</span>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div
            ref={containerRef}
            className="document-viewer prose prose-invert max-w-none p-6 lg:p-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </ScrollArea>
      )}
    </div>
  );
}
