"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLanguageFromFileName } from "@/lib/viewer-utils";

interface CodeViewerProps {
  url: string;
  fileName: string;
}

export function CodeViewer({ url, fileName }: CodeViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const text = await res.text();
        if (cancelled) return;

        setRawContent(text);
        setLineCount(text.split("\n").length);

        // Highlight with shiki
        const lang = getLanguageFromFileName(fileName);
        try {
          const { codeToHtml } = await import("shiki");
          const highlighted = await codeToHtml(text, {
            lang,
            theme: "github-dark-default",
          });
          if (!cancelled) setHtml(highlighted);
        } catch {
          // Fallback to plain text if shiki fails for this language
          if (!cancelled) setHtml(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url, fileName]);

  async function handleCopy() {
    await navigator.clipboard.writeText(rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!rawContent && !html) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  const lang = getLanguageFromFileName(fileName);

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--overlay-6)] px-4 py-2">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="rounded bg-[var(--overlay-6)] px-1.5 py-0.5 font-mono text-[11px]">
            {lang}
          </span>
          <span>{lineCount} lines</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[12px]"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {html ? (
          <div
            className="code-viewer p-4 text-[13px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-4 font-mono text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {rawContent}
          </pre>
        )}
      </div>
    </div>
  );
}
