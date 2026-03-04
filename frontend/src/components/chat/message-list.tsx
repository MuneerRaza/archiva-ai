"use client";

import { useCallback, useEffect, useRef } from "react";
import { Bot, FileSearch, FolderOpen, Lightbulb, RefreshCw, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { LogoIcon } from "@/components/logo";
import { MessageBubble, markdownComponents } from "@/components/chat/message-bubble";
import { ToolCallCard } from "@/components/chat/tool-call-card";
import { ToolCallMessage } from "@/components/chat/tool-call-card";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";
import type { AgentMessage } from "@/types/models";

interface MessageListProps {
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRetryMessage?: (content: string, afterMessageId: string) => void;
  onResendLastMessage?: () => void;
  onSuggestedMessage?: (message: string) => void;
  isLoadingSession?: boolean;
  showServerProcessing?: boolean;
}

const SUGGESTED_MESSAGES = [
  { icon: FolderOpen, text: "What files are in my workspace?" },
  { icon: Lightbulb, text: "Summarize my most recent documents" },
  { icon: Search, text: "Search for key topics across all files" },
  { icon: FileSearch, text: "Give me an overview of this workspace" },
];

export function MessageList({
  onEditMessage,
  onRetryMessage,
  onResendLastMessage,
  onSuggestedMessage,
  isLoadingSession,
  showServerProcessing,
}: MessageListProps) {
  const {
    messages,
    isStreaming,
    streamingText,
    streamingThinking,
    toolCalls,
    error,
    branches,
    activeBranchIndex,
    sessionId,
    streamingSessionId,
  } = useChatStore();

  const setActiveBranch = useChatStore((s) => s.setActiveBranch);

  // Only show streaming UI if we're viewing the session that's actually streaming
  const viewingStreamingSession =
    streamingSessionId !== null &&
    (sessionId === streamingSessionId ||
      (streamingSessionId === "new" && sessionId === null));

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Auto-scroll: smooth for discrete events (new messages, tool calls)
  useEffect(() => {
    if (userScrolledRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, toolCalls.length]);

  // For streaming text/thinking growth: rAF-throttled instant scroll (no jitter)
  useEffect(() => {
    if ((!streamingText && !streamingThinking) || userScrolledRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [streamingText, streamingThinking]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 100;
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isStreaming) userScrolledRef.current = false;
  }, [isStreaming]);

  const handleBranchNav = useCallback(
    (forkId: string, delta: number) => {
      const current = activeBranchIndex.get(forkId) ?? 0;
      const branchList = branches.get(forkId);
      if (!branchList) return;
      const next = Math.max(0, Math.min(branchList.length, current + delta));
      setActiveBranch(forkId, next);
    },
    [branches, activeBranchIndex, setActiveBranch],
  );

  // Whether we have an active stream on the viewed session
  const hasActiveStream = viewingStreamingSession && (isStreaming || !!streamingText || toolCalls.length > 0);

  // Loading state — show skeleton only when actually loading from server.
  // An empty messages array + no active stream = legitimately empty session (not loading).
  // We show loading ONLY when TanStack query is actively fetching AND messages not hydrated yet.
  const showLoading = !!sessionId && messages.length === 0 && !hasActiveStream && isLoadingSession;

  if (showLoading) {
    return (
      <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <ChatLoadingSkeleton />
        </div>
      </div>
    );
  }

  // Empty state
  const isEmpty = messages.length === 0 && !hasActiveStream;

  if (isEmpty) {
    return (
      <div ref={containerRef} className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4">
        <LogoIcon className="mb-4 h-12 w-12 opacity-40" />
        <p className="mb-6 text-sm text-muted-foreground">
          How can I help you today?
        </p>
        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          {SUGGESTED_MESSAGES.map((s) => (
            <button
              key={s.text}
              onClick={() => onSuggestedMessage?.(s.text)}
              className="flex items-start gap-2.5 rounded-xl border border-[var(--overlay-8)] bg-[var(--overlay-2)] px-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-[var(--overlay-4)] hover:text-foreground"
            >
              <s.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
              <span className="leading-relaxed">{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const displayItems = buildDisplayItems(messages);

  // Find last assistant turn for retry button
  let lastAssistantIdx = -1;
  for (let i = displayItems.length - 1; i >= 0; i--) {
    const item = displayItems[i];
    if (item.type === "assistant_turn" || (item.type === "message" && item.msg.role === "assistant")) {
      lastAssistantIdx = i;
      break;
    }
  }

  // Detect orphaned last user message (error occurred, no assistant response)
  const lastDisplayItem = displayItems[displayItems.length - 1];
  const isOrphanedLastUser =
    !isStreaming &&
    !!sessionId &&
    lastDisplayItem?.type === "message" &&
    lastDisplayItem.msg.role === "user";

  // Is there an active streaming turn to show?
  const hasStreamingTurn =
    viewingStreamingSession && isStreaming &&
    (toolCalls.length > 0 || streamingText || streamingThinking);

  // Show typing dots when streaming but no text has arrived yet
  const showTypingDots =
    viewingStreamingSession && isStreaming && !streamingText;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {displayItems.map((item, idx) => {
          if (item.type === "message") {
            const isUserMsg = item.msg.role === "user";
            const isLastAssistant = idx === lastAssistantIdx && item.msg.role === "assistant";

            const msgBranches = branches.get(item.msg.id);
            const branchInfo = msgBranches && msgBranches.length > 0
              ? {
                  total: msgBranches.length + 1,
                  current: activeBranchIndex.get(item.msg.id) ?? msgBranches.length,
                  onPrev: () => handleBranchNav(item.msg.id, -1),
                  onNext: () => handleBranchNav(item.msg.id, 1),
                }
              : undefined;

            // Assistant message with thinking — render under bot avatar like assistant_turn
            if (!isUserMsg && item.msg.thinking) {
              return (
                <div key={item.msg.id} className="group flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--overlay-6)] text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <ThinkingBlock content={item.msg.thinking} defaultCollapsed />
                    <div className="relative">
                      <div className="rounded-2xl bg-[var(--overlay-4)] px-4 py-2.5 text-sm text-foreground">
                        <div className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {(item.msg.content ?? "").trim()}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {!isStreaming && (
                        <AssistantTurnActions
                          content={(item.msg.content ?? "").trim()}
                          onRetry={
                            isLastAssistant && onRetryMessage
                              ? () => {
                                  const userMsg = findPrecedingUserMessage(messages, item.msg);
                                  if (userMsg) {
                                    onRetryMessage(userMsg.content ?? "", userMsg.id);
                                  }
                                }
                              : undefined
                          }
                          branch={branchInfo}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const isOrphanedUser = isUserMsg && isOrphanedLastUser && idx === displayItems.length - 1;

            return (
              <div key={item.msg.id}>
                <MessageBubble
                  role={item.msg.role as "user" | "assistant"}
                  content={item.msg.content ?? ""}
                  onEdit={
                    isUserMsg && onEditMessage
                      ? (newContent) => onEditMessage(item.msg.id, newContent)
                      : undefined
                  }
                  onRetry={
                    isLastAssistant && onRetryMessage && !isStreaming
                      ? () => {
                          const userMsg = findPrecedingUserMessage(messages, item.msg);
                          if (userMsg) {
                            onRetryMessage(userMsg.content ?? "", userMsg.id);
                          }
                        }
                      : undefined
                  }
                  branch={branchInfo}
                />
                {isOrphanedUser && onResendLastMessage && !error && (
                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={onResendLastMessage}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--overlay-8)] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-[var(--overlay-4)] hover:text-foreground"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            );
          }

          if (item.type === "system") {
            return (
              <div key={`sys-${idx}`} className="flex justify-center">
                <span className="rounded-full bg-[var(--overlay-6)] px-3 py-1 text-xs text-muted-foreground">
                  {item.content}
                </span>
              </div>
            );
          }

          if (item.type === "tool_pair") {
            return (
              <ToolCallMessage
                key={`tool-${idx}`}
                toolName={item.toolName}
                toolArgs={item.toolArgs}
                toolResult={item.toolResult}
              />
            );
          }

          // Grouped assistant turn: bot avatar + tool calls + text
          if (item.type === "assistant_turn") {
            const isLast = idx === lastAssistantIdx;
            const assistantMsg = item.assistantMsg;

            const msgBranches = assistantMsg ? branches.get(assistantMsg.id) : undefined;
            const branchInfo = msgBranches && msgBranches.length > 0
              ? {
                  total: msgBranches.length + 1,
                  current: activeBranchIndex.get(assistantMsg!.id) ?? msgBranches.length,
                  onPrev: () => handleBranchNav(assistantMsg!.id, -1),
                  onNext: () => handleBranchNav(assistantMsg!.id, 1),
                }
              : undefined;

            return (
              <div key={`turn-${idx}`} className="group flex gap-3">
                {/* Bot avatar */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--overlay-6)] text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Per-message thinking — rendered first (LLM thinks before tool calls) */}
                  {assistantMsg?.thinking && (
                    <ThinkingBlock content={assistantMsg.thinking} defaultCollapsed />
                  )}
                  {/* Tool calls */}
                  {item.tools.map((tool, ti) => (
                    <ToolCallMessage
                      key={`turn-tool-${idx}-${ti}`}
                      toolName={tool.toolName}
                      toolArgs={tool.toolArgs}
                      toolResult={tool.toolResult}
                    />
                  ))}
                  {/* Assistant text */}
                  {assistantMsg && (
                    <div className="relative">
                      <div className={cn(
                        "rounded-2xl bg-[var(--overlay-4)] px-4 py-2.5 text-sm text-foreground",
                      )}>
                        <div className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {(assistantMsg.content ?? "").trim()}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {/* Action buttons */}
                      {!isStreaming && (
                        <AssistantTurnActions
                          content={(assistantMsg.content ?? "").trim()}
                          onRetry={
                            isLast && onRetryMessage
                              ? () => {
                                  const userMsg = findPrecedingUserMessage(messages, assistantMsg);
                                  if (userMsg) {
                                    onRetryMessage(userMsg.content ?? "", userMsg.id);
                                  }
                                }
                              : undefined
                          }
                          branch={branchInfo}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* ── Active streaming turn ── */}
        {(hasStreamingTurn || showTypingDots) && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--overlay-6)] text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {/* Thinking first — LLM reasons before calling tools */}
              {viewingStreamingSession && streamingThinking && (
                <ThinkingBlock content={streamingThinking} isStreaming={!streamingText} />
              )}
              {viewingStreamingSession && toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
              {showTypingDots && <TypingDots />}
              {viewingStreamingSession && streamingText && (
                <div className="rounded-2xl bg-[var(--overlay-4)] px-4 py-2.5 text-sm text-foreground">
                  <div className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {streamingText.trim()}
                    </ReactMarkdown>
                    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Server-side processing indicator (reload/reconnect scenario) */}
        {showServerProcessing && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--overlay-6)] text-muted-foreground">
              <Bot className="h-3.5 w-3.5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="w-fit rounded-2xl bg-[var(--overlay-4)] px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Processing your request...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p>{error}</p>
            {onResendLastMessage && (
              <button
                onClick={onResendLastMessage}
                className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";

function ThinkingBlock({
  content,
  isStreaming: isThinkingStreaming,
  defaultCollapsed,
}: {
  content: string;
  isStreaming?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const wasStreamingRef = useRef(isThinkingStreaming);

  // Auto-collapse when thinking stream finishes
  useEffect(() => {
    if (wasStreamingRef.current && !isThinkingStreaming) {
      setExpanded(false);
    }
    wasStreamingRef.current = isThinkingStreaming;
  }, [isThinkingStreaming]);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary/80 transition-colors hover:text-primary"
      >
        <Lightbulb className="h-3 w-3" />
        <span className="font-medium">
          {isThinkingStreaming ? "Thinking..." : "Thought process"}
        </span>
        {isThinkingStreaming && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
        <div className="flex-1" />
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-primary/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

function AssistantTurnActions({
  content,
  onRetry,
  branch,
}: {
  content: string;
  onRetry?: () => void;
  branch?: {
    total: number;
    current: number;
    onPrev: () => void;
    onNext: () => void;
  };
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  return (
    <div
      className={cn(
        "absolute -bottom-6 left-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
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
      <button
        onClick={handleCopy}
        className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
        title="Copy message"
      >
        {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {onRetry && (
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
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findPrecedingUserMessage(
  messages: AgentMessage[],
  assistantMsg: AgentMessage,
): AgentMessage | null {
  const idx = messages.findIndex((m) => m.id === assistantMsg.id);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i];
  }
  return null;
}

interface ToolPairData {
  toolName: string;
  toolArgs: Record<string, unknown> | null;
  toolResult: Record<string, unknown> | null;
}

type DisplayItem =
  | { type: "message"; msg: AgentMessage }
  | { type: "system"; content: string }
  | { type: "tool_pair"; toolName: string; toolArgs: Record<string, unknown> | null; toolResult: Record<string, unknown> | null }
  | { type: "assistant_turn"; tools: ToolPairData[]; assistantMsg: AgentMessage | null };

/**
 * Build display items from messages, grouping consecutive tool calls with
 * the following assistant message into a single "assistant_turn".
 */
function buildDisplayItems(messages: AgentMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "system") {
      items.push({ type: "system", content: msg.content ?? "" });
      i++;
      continue;
    }

    if (msg.role === "user") {
      items.push({ type: "message", msg });
      i++;
      continue;
    }

    // Check if this starts a tool_call sequence → group into assistant_turn
    if (msg.role === "tool_call") {
      const tools: ToolPairData[] = [];
      let j = i;

      // Collect consecutive tool_call / tool_result pairs
      while (j < messages.length && (messages[j].role === "tool_call" || messages[j].role === "tool_result")) {
        const m = messages[j];
        if (m.role === "tool_call") {
          const next = messages[j + 1];
          if (next && next.role === "tool_result" && next.tool_name === m.tool_name) {
            tools.push({
              toolName: m.tool_name ?? "",
              toolArgs: m.tool_args,
              toolResult: next.tool_result,
            });
            j += 2;
          } else {
            tools.push({
              toolName: m.tool_name ?? "",
              toolArgs: m.tool_args,
              toolResult: null,
            });
            j++;
          }
        } else {
          // Orphan tool_result
          tools.push({
            toolName: m.tool_name ?? "",
            toolArgs: null,
            toolResult: m.tool_result,
          });
          j++;
        }
      }

      // Check if an assistant message follows
      let assistantMsg: AgentMessage | null = null;
      if (j < messages.length && messages[j].role === "assistant") {
        assistantMsg = messages[j];
        j++;
      }

      items.push({ type: "assistant_turn", tools, assistantMsg });
      i = j;
      continue;
    }

    // Standalone assistant message (no preceding tool calls)
    if (msg.role === "assistant") {
      items.push({ type: "message", msg });
      i++;
      continue;
    }

    // Orphan tool_result without tool_call
    if (msg.role === "tool_result") {
      items.push({
        type: "tool_pair",
        toolName: msg.tool_name ?? "",
        toolArgs: null,
        toolResult: msg.tool_result,
      });
      i++;
      continue;
    }

    i++;
  }

  return items;
}

/**
 * Three pulsing dots — shown while waiting for LLM text output.
 */
function TypingDots() {
  return (
    <div className="w-fit rounded-2xl bg-[var(--overlay-4)] px-4 py-3">
      <div className="flex items-center gap-1">
        <span
          className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[typing-dot_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[typing-dot_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "200ms" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[typing-dot_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: "400ms" }}
        />
      </div>
    </div>
  );
}

/**
 * Skeleton loading animation — mimics a conversation being loaded.
 * Shows animated placeholder bubbles for user + assistant messages.
 */
function ChatLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* User message skeleton */}
      <div className="flex gap-3 flex-row-reverse">
        <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 animate-pulse" />
        <div className="flex flex-col items-end gap-1.5">
          <div
            className="h-4 rounded-full bg-primary/15 animate-pulse"
            style={{ width: 180, animationDelay: "0ms" }}
          />
          <div
            className="h-4 rounded-full bg-primary/10 animate-pulse"
            style={{ width: 120, animationDelay: "75ms" }}
          />
        </div>
      </div>

      {/* Assistant message skeleton */}
      <div className="flex gap-3">
        <div className="h-7 w-7 shrink-0 rounded-lg bg-[var(--overlay-6)] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="rounded-2xl bg-[var(--overlay-4)] px-4 py-3 space-y-2.5">
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "90%", animationDelay: "100ms" }}
            />
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "75%", animationDelay: "175ms" }}
            />
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "60%", animationDelay: "250ms" }}
            />
          </div>
        </div>
      </div>

      {/* Second user message skeleton */}
      <div className="flex gap-3 flex-row-reverse">
        <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 animate-pulse" />
        <div
          className="h-4 rounded-full bg-primary/15 animate-pulse"
          style={{ width: 140, animationDelay: "300ms" }}
        />
      </div>

      {/* Second assistant message skeleton */}
      <div className="flex gap-3">
        <div className="h-7 w-7 shrink-0 rounded-lg bg-[var(--overlay-6)] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="rounded-2xl bg-[var(--overlay-4)] px-4 py-3 space-y-2.5">
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "85%", animationDelay: "375ms" }}
            />
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "70%", animationDelay: "450ms" }}
            />
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "55%", animationDelay: "525ms" }}
            />
            <div
              className="h-3.5 rounded-full bg-[var(--overlay-8)] animate-pulse"
              style={{ width: "40%", animationDelay: "600ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
