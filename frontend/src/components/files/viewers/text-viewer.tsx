"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import { Skeleton } from "@/components/ui/skeleton";

interface TextViewerProps {
  url: string;
  isMarkdown: boolean;
  scrollToAnchor?: string;
  onNavigateComplete?: () => void;
}

import React from "react";

export function TextViewer({ url, isMarkdown, scrollToAnchor, onNavigateComplete }: TextViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const text = await res.text();
        if (!cancelled) {
          setContent(text);
          setRenderKey((k) => k + 1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Scroll to anchor when requested
  useEffect(() => {
    if (!scrollToAnchor || content === null || !containerRef.current) return;
    const timer = setTimeout(() => {
      const el = containerRef.current?.querySelector(`#${CSS.escape(scrollToAnchor)}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      onNavigateComplete?.();
    }, 50);
    return () => clearTimeout(timer);
  }, [scrollToAnchor, content, onNavigateComplete]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (isMarkdown) {
    return (
      <div ref={containerRef} className="prose prose-invert max-w-none p-6">
        <MarkdownWithHeadingIds key={renderKey} content={content} />
      </div>
    );
  }

  return (
    <pre className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed text-foreground/90">
      {content}
    </pre>
  );
}

function MarkdownWithHeadingIds({ content }: { content: string }) {
  const counterRef = useRef(0);
  counterRef.current = 0;

  function makeHeading(level: number) {
    return function HeadingComponent({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { node?: unknown }) {
      const { node: _node, ...rest } = props as { node?: unknown } & React.HTMLAttributes<HTMLHeadingElement>;
      const id = `heading-${counterRef.current++}`;
      return React.createElement(`h${level}`, { ...rest, id }, children);
    };
  }

  return (
    <Markdown
      components={{
        h1: makeHeading(1),
        h2: makeHeading(2),
        h3: makeHeading(3),
        h4: makeHeading(4),
        h5: makeHeading(5),
        h6: makeHeading(6),
      }}
    >
      {content}
    </Markdown>
  );
}
