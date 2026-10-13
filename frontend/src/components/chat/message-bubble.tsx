"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import type { BundledLanguage } from "shiki";
import { codeToHtml } from "shiki";

import { cn } from "@/lib/utils";

interface BranchInfo {
  total: number;
  current: number;
  onPrev: () => void;
  onNext: () => void;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  /** Edit handler — only shown on user messages */
  onEdit?: (newContent: string) => void;
  /** Retry handler — only shown on the last assistant message */
  onRetry?: () => void;
  /** Branch navigation (shown at fork points) */
  branch?: BranchInfo;
}

// ---------------------------------------------------------------------------
// Code block with syntax highlighting + copy button
// ---------------------------------------------------------------------------

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const code = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className ?? "");
  const lang = match?.[1] ?? "text";

  // Highlight asynchronously
  useMemo(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: lang as BundledLanguage,
      theme: "github-dark-default",
    })
      .then((html) => {
        if (!cancelled) setHighlighted(html);
      })
      .catch(() => {
        // Unsupported language — fall back to plain
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-[var(--overlay-6)]">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-[var(--overlay-4)] px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      {highlighted ? (
        <div
          className="overflow-x-auto p-3 text-[13px] leading-relaxed [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown component overrides
// ---------------------------------------------------------------------------

export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-4 text-lg font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-sm font-semibold">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-medium">{children}</h4>
  ),
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-0.5 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-[var(--overlay-6)]">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--overlay-4)] text-left text-muted-foreground">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t border-[var(--overlay-6)] px-3 py-2">
      {children}
    </td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return (
      <code
        className="rounded bg-[var(--overlay-6)] px-1.5 py-0.5 text-[13px]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-[var(--overlay-6)]" />,
  input: ({ checked, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mr-1.5 rounded"
      {...props}
    />
  ),
};

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

export function MessageBubble({
  role,
  content,
  isStreaming,
  onEdit,
  onRetry,
  branch,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ctxMenu) return;
    function close() { setCtxMenu(null); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    function handleClick(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const cleanContent = useMemo(() => {
    return content.trim();
  }, [content]);

  const handleCopyMessage = useCallback(() => {
    navigator.clipboard.writeText(cleanContent);
    setCtxMenu(null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [cleanContent]);

  const handleStartEdit = useCallback(() => {
    setEditText(content);
    setEditing(true);
    // Focus textarea and auto-size after render
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
        ta.focus();
      }
    }, 0);
  }, [content]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditText("");
  }, []);

  const handleSubmitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== content && onEdit) {
      onEdit(trimmed);
    }
    setEditing(false);
    setEditText("");
  }, [editText, content, onEdit]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSubmitEdit, handleCancelEdit],
  );

  return (
    <div
      className={cn(
        "group flex gap-3 pb-4",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-[var(--overlay-6)] text-muted-foreground",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Message */}
      <div className="relative max-w-[80%]">
        {isUser && editing ? (
          /* Edit mode — matches the original bubble width */
          <div className="flex min-w-[300px] flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleEditKeyDown}
              className="min-h-[60px] w-full resize-none rounded-xl border border-[var(--overlay-8)] bg-[var(--overlay-4)] px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={handleCancelEdit}
                className="flex h-7 items-center gap-1 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEdit}
                disabled={editText.trim() === content.trim()}
                className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-[var(--overlay-4)] text-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{cleanContent}</p>
          ) : (
            <div className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                // rehype-raw renders inline HTML the model emits (e.g. <br>
                // in table cells); rehype-sanitize then strips anything unsafe.
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={markdownComponents}
              >
                {cleanContent}
              </ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary" />
              )}
            </div>
          )}
        </div>
        )}

        {/* Branch navigation + action buttons */}
        {!isStreaming && !editing && (
          <div
            className={cn(
              "absolute -bottom-6 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "right-0" : "left-0",
              branch && "opacity-100",
            )}
          >
            {branch && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <button
                  onClick={branch.onPrev}
                  disabled={branch.current === 0}
                  className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground disabled:opacity-30"
                  aria-label="Previous branch"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span>{branch.current + 1}/{branch.total}</span>
                <button
                  onClick={branch.onNext}
                  disabled={branch.current === branch.total - 1}
                  className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground disabled:opacity-30"
                  aria-label="Next branch"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
            {/* Copy button — assistant messages only */}
            {!isUser && (
              <button
                onClick={handleCopyMessage}
                className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                title="Copy message"
              >
                {copied ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <Copy className="h-2.5 w-2.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            {isUser && onEdit && (
              <button
                onClick={handleStartEdit}
                className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                title="Edit message"
              >
                <Pencil className="h-2.5 w-2.5" />
                Edit
              </button>
            )}
            {!isUser && onRetry && (
              <button
                onClick={onRetry}
                className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                title="Retry"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Context menu */}
        {ctxMenu && (
          <div
            ref={ctxRef}
            className="fixed z-50 min-w-[140px] rounded-md border border-[var(--overlay-8)] bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              onClick={handleCopyMessage}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
            {isUser && onEdit && (
              <button
                onClick={() => {
                  setCtxMenu(null);
                  handleStartEdit();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {!isUser && onRetry && (
              <button
                onClick={() => {
                  setCtxMenu(null);
                  onRetry();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-popover-foreground transition-colors hover:bg-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
