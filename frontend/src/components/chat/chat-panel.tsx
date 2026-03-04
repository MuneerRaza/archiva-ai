"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  Maximize2,
  MessageSquare,
  Minimize2,
  Pencil,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";

import { ChatInput } from "@/components/chat/chat-input";
import { FolderNavigator } from "@/components/chat/folder-navigator";
import { MessageList } from "@/components/chat/message-list";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useAgentSession,
  useAgentSessions,
  useDeleteAgentSession,
  useRenameAgentSession,
  useTruncateMessages,
} from "@/lib/queries/agent";
import { useAIModels } from "@/lib/queries/ai-models";
import { useWorkspace, useUpdateWorkspace } from "@/lib/queries/workspaces";
import { useChatStore } from "@/stores/chat-store";
import { useUIStore, CHAT_PANEL_MIN, CHAT_PANEL_MAX } from "@/stores/ui-store";
import { useChatStream } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";
import { deriveThinkingCapabilities } from "@/types/models";

interface ChatPanelProps {
  workspaceId: string;
}

const NAV_MIN_HEIGHT = 120;
const NAV_MAX_HEIGHT = 500;
const NAV_DEFAULT_HEIGHT = 220;

export function ChatPanel({ workspaceId }: ChatPanelProps) {
  const {
    chatPanelOpen,
    chatPanelFullscreen,
    chatPanelWidth,
    setChatPanelOpen,
    setChatPanelFullscreen,
    setChatPanelWidth,
  } = useUIStore();

  const {
    sessionId,
    isStreaming,
    streamingSessionId,
    contextLocation,
    reset: resetChat,
    switchSession,
    setMessages,
  } = useChatStore();

  const { sendMessage, abort } = useChatStream();
  const qc = useQueryClient();

  // Queries
  const { data: sessionsData } = useAgentSessions(workspaceId);
  const { data: sessionData, isFetching: isLoadingSession } = useAgentSession(workspaceId, sessionId);
  const deleteSession = useDeleteAgentSession(workspaceId);
  const renameSession = useRenameAgentSession(workspaceId);
  const truncateMessages = useTruncateMessages(workspaceId);
  const { data: workspace } = useWorkspace(workspaceId);
  const updateWorkspace = useUpdateWorkspace(workspaceId, { silent: true });

  // Navigator resizable height state
  const [navHeight, setNavHeight] = useState(NAV_DEFAULT_HEIGHT);

  // Session context menu state
  const [contextMenu, setContextMenu] = useState<{
    sessionId: string;
    sessionTitle: string;
    x: number;
    y: number;
  } | null>(null);

  // Rename dialog state
  const [renameState, setRenameState] = useState<{
    sessionId: string;
    title: string;
  } | null>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Collapsed-view session list popover
  const [sessionListOpen, setSessionListOpen] = useState(false);

  // Hydrate messages from server data.
  // On session switch, handleSelectSession removes cached query data, forcing
  // a fresh fetch. This guarantees we always get the latest server state.
  useEffect(() => {
    if (!sessionData?.data?.messages) return;
    if (sessionData.data.id !== sessionId) return;
    const currentMessages = useChatStore.getState().messages;
    // Don't overwrite during active streaming on this session
    if (streamingSessionId === sessionData.data.id && currentMessages.length > 0) return;
    // Don't overwrite when error displayed with existing messages
    if (useChatStore.getState().error && currentMessages.length > 0) return;
    // Don't replace with fewer messages — stale cached data would overwrite
    // locally finalized messages (e.g. right after streaming completes, the
    // cache still has the pre-streaming snapshot until the refetch lands).
    if (sessionData.data.messages.length < currentMessages.length) return;
    setMessages(sessionData.data.messages);
  }, [sessionData, sessionId, setMessages, streamingSessionId]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const handleSend = useCallback(
    (message: string) => {
      sendMessage({
        workspaceId,
        message,
        sessionId,
        contextLocation,
      });
    },
    [workspaceId, sessionId, contextLocation, sendMessage],
  );

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      // Don't abort — let the stream continue in the background.
      // switchSession(null) preserves streaming buffers and streamingSessionId.
      switchSession(null);
    } else {
      resetChat();
    }
  }, [isStreaming, switchSession, resetChat]);

  const handleClose = useCallback(() => {
    setChatPanelOpen(false);
    setChatPanelFullscreen(false);
  }, [setChatPanelOpen, setChatPanelFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    setChatPanelFullscreen(!chatPanelFullscreen);
  }, [chatPanelFullscreen, setChatPanelFullscreen]);

  // Switch sessions WITHOUT aborting the active stream.
  // The stream continues in the background — events are silently
  // discarded when the user is on a different session.
  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === sessionId) return;
      // Remove stale cached session detail — forces TanStack to fetch fresh
      // from server. This guarantees correct messages after streaming finishes
      // while the user was on a different session.
      qc.removeQueries({ queryKey: ["agent-session", workspaceId, id] });
      switchSession(id);
    },
    [sessionId, switchSession, workspaceId, qc],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession.mutate(id);
      if (sessionId === id) {
        resetChat();
      }
      setContextMenu(null);
    },
    [deleteSession, sessionId, resetChat],
  );

  const handleRenameSubmit = useCallback(() => {
    if (!renameState) return;
    const trimmed = renameState.title.trim();
    if (trimmed) {
      renameSession.mutate({ sessionId: renameState.sessionId, title: trimmed });
    }
    setRenameState(null);
  }, [renameState, renameSession]);

  const handleSessionContextMenu = useCallback(
    (e: React.MouseEvent, sid: string, title: string) => {
      e.preventDefault();
      setContextMenu({ sessionId: sid, sessionTitle: title, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleEnterSelectMode = useCallback(
    (initialId?: string) => {
      const initial = new Set<string>();
      if (initialId) initial.add(initialId);
      setSelectedIds(initial);
      setSelectMode(true);
      setContextMenu(null);
    },
    [],
  );

  const handleToggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) {
      deleteSession.mutate(id);
      if (sessionId === id) {
        resetChat();
      }
    }
    handleExitSelectMode();
  }, [selectedIds, deleteSession, sessionId, resetChat, handleExitSelectMode]);

  // Edit a user message: save branch, truncate, re-send with new content
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!sessionId || isStreaming) return;
      const store = useChatStore.getState();
      const idx = store.messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        const branchMessages = store.messages.slice(idx);
        store.addBranch(messageId, branchMessages);
      }
      const isClientId = messageId.startsWith("temp-") || messageId.startsWith("partial-");
      if (!isClientId) {
        truncateMessages.mutate({ sessionId, afterMessageId: messageId, inclusive: true });
      }
      store.truncateFrom(messageId);
      sendMessage({ workspaceId, message: newContent, sessionId, contextLocation });
    },
    [sessionId, isStreaming, workspaceId, contextLocation, truncateMessages, sendMessage],
  );

  // Retry: save branch, truncate after user message, re-send same text
  const handleRetryMessage = useCallback(
    (userContent: string, afterMessageId: string) => {
      if (!sessionId || isStreaming) return;
      const store = useChatStore.getState();
      const idx = store.messages.findIndex((m) => m.id === afterMessageId);
      if (idx !== -1 && idx + 1 < store.messages.length) {
        const branchMessages = store.messages.slice(idx + 1);
        store.addBranch(afterMessageId, branchMessages);
      }
      const isClientId = afterMessageId.startsWith("temp-") || afterMessageId.startsWith("partial-");
      if (!isClientId) {
        // Truncate inclusive — removes user message from DB too (backend re-saves it)
        truncateMessages.mutate({ sessionId, afterMessageId, inclusive: true });
      }
      store.truncateAfter(afterMessageId);
      // User message stays in local store — skip adding a duplicate
      sendMessage({ workspaceId, message: userContent, sessionId, contextLocation, skipOptimisticMessage: true });
    },
    [sessionId, isStreaming, workspaceId, contextLocation, truncateMessages, sendMessage],
  );

  // Resend orphaned last user message (when error occurred, no assistant response saved)
  const handleResendLastMessage = useCallback(() => {
    if (!sessionId || isStreaming) return;
    const store = useChatStore.getState();
    const msgs = store.messages;
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== "user") return;

    const content = lastMsg.content ?? "";
    const isClientId = lastMsg.id.startsWith("temp-") || lastMsg.id.startsWith("partial-");
    // Only truncate from DB if the message has a server-assigned ID
    if (!isClientId) {
      truncateMessages.mutate({ sessionId, afterMessageId: lastMsg.id, inclusive: true });
    }
    // Remove from local store
    store.truncateFrom(lastMsg.id);
    // Re-send (backend saves the user message fresh)
    sendMessage({ workspaceId, message: content, sessionId, contextLocation });
  }, [sessionId, isStreaming, workspaceId, contextLocation, truncateMessages, sendMessage]);

  // Detect when server transitions from streaming → idle (completion after reload)
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const current = sessionsData?.data?.find((s) => s.id === sessionId);
    if (!current) return;
    if (prevStatusRef.current === "streaming" && current.status === "idle") {
      qc.invalidateQueries({ queryKey: ["agent-session", workspaceId, sessionId] });
    }
    prevStatusRef.current = current.status;
  }, [sessionsData, sessionId, workspaceId, qc]);

  // Thinking capabilities — derive from stored ai_models capabilities (no network call)
  const agentSettings = workspace?.settings?.agent;
  const { data: aiModels } = useAIModels();
  const agentModelId = agentSettings?.model_id;
  const agentModel = (aiModels ?? []).find((m) => m.id === agentModelId);
  const agentNotConfigured = !agentModelId || !agentModel;
  const thinkingCapabilities = agentModel
    ? deriveThinkingCapabilities(agentModel.capabilities)
    : undefined;

  const thinkingEnabled = agentSettings?.thinking_enabled ?? false;
  const thinkingBudget = agentSettings?.thinking_budget ?? "medium";

  const handleToggleThinking = useCallback(() => {
    if (!workspace) return;
    const newSettings = {
      ...workspace.settings,
      agent: {
        ...workspace.settings.agent,
        thinking_enabled: !thinkingEnabled,
      },
    };
    updateWorkspace.mutate({ settings: newSettings as unknown as Record<string, unknown> });
  }, [workspace, thinkingEnabled, updateWorkspace]);

  const handleSetThinkingBudget = useCallback(
    (level: string) => {
      if (!workspace) return;
      const newSettings = {
        ...workspace.settings,
        agent: {
          ...workspace.settings.agent,
          thinking_budget: level,
          // Auto-enable thinking when setting a budget level
          thinking_enabled: true,
        },
      };
      updateWorkspace.mutate({ settings: newSettings as unknown as Record<string, unknown> });
    },
    [workspace, updateWorkspace],
  );

  // Resize chat panel width (collapsed mode)
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (chatPanelFullscreen) return;
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = chatPanelWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX;
        const newWidth = Math.max(CHAT_PANEL_MIN, Math.min(CHAT_PANEL_MAX, startWidth + delta));
        setChatPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [chatPanelFullscreen, chatPanelWidth, setChatPanelWidth],
  );

  // Resize navigator vertically (fullscreen mode)
  const handleNavResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = navHeight;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        setNavHeight(Math.max(NAV_MIN_HEIGHT, Math.min(NAV_MAX_HEIGHT, startHeight + delta)));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [navHeight],
  );

  if (!chatPanelOpen) return null;

  const sessions = sessionsData?.data ?? [];
  const sessionTitle =
    sessionData?.data?.title ?? (sessionId ? "Chat" : "New Chat");

  // Is the currently-viewed session the one streaming?
  const viewingStreamingSession =
    streamingSessionId !== null &&
    (sessionId === streamingSessionId ||
      (streamingSessionId === "new" && sessionId === null));

  // Server says streaming but we have no active SSE connection (reload scenario).
  // Suppress during refetch — cached status is stale and would flash "processing"
  // right after client streaming finishes (before the refetch lands with status: idle).
  const isServerStreaming = sessionData?.data?.status === "streaming";
  const isClientStreaming = isStreaming && viewingStreamingSession;
  const showServerProcessing = !!isServerStreaming && !isClientStreaming && !isLoadingSession;

  return (
    <div
      className={cn(
        "relative flex border-l border-[var(--overlay-6)] bg-background",
        chatPanelFullscreen ? "flex-1" : "shrink-0 flex-col",
      )}
      style={chatPanelFullscreen ? undefined : { width: chatPanelWidth }}
    >
      {/* Resize handle (collapsed mode only) */}
      {!chatPanelFullscreen && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-primary/10"
        />
      )}

      {chatPanelFullscreen ? (
        /* ── FULLSCREEN LAYOUT ── */
        <>
          {/* Left sidebar */}
          <div className="flex w-[260px] shrink-0 flex-col border-r border-[var(--overlay-6)]">
            {/* Sessions section */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {selectMode ? (
                /* Select mode header */
                <div className="flex items-center gap-2 border-b border-[var(--overlay-6)] px-3 py-3 text-[13px] font-medium">
                  <span className="text-foreground">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      if (selectedIds.size === sessions.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(sessions.map((s) => s.id)));
                      }
                    }}
                    className="flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                    title={selectedIds.size === sessions.length ? "Deselect all" : "Select all"}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {selectedIds.size === sessions.length ? "None" : "All"}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0}
                    className="flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-30"
                    title="Delete selected"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleExitSelectMode}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                /* Normal header */
                <div className="flex items-center gap-2 border-b border-[var(--overlay-6)] px-3 py-3 text-[13px] font-medium text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  <span>Chats</span>
                  <div className="flex-1" />
                  <button
                    onClick={handleNewChat}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--overlay-8)] bg-[var(--overlay-4)] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-[var(--overlay-6)] hover:text-foreground"
                    title="New chat"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex-1 space-y-0.5 overflow-y-auto px-1.5 scrollbar-thin">
                {sessions.map((s) => {
                  const isChecked = selectedIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onContextMenu={
                        selectMode
                          ? undefined
                          : (e) => handleSessionContextMenu(e, s.id, s.title ?? "Untitled")
                      }
                      onClick={selectMode ? () => handleToggleSelect(s.id) : () => handleSelectSession(s.id)}
                      className={cn(
                        "group flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-[13px] transition-colors",
                        selectMode && isChecked
                          ? "bg-primary/10 text-primary"
                          : s.id === sessionId && !selectMode
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
                      )}
                    >
                      {selectMode && (
                        <span className="shrink-0">
                          {isChecked ? (
                            <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Square className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                      {!selectMode && s.status === "streaming" && s.id !== sessionId && (
                        <LoadingDots className="shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {s.title ?? "Untitled"}
                      </span>
                      {!selectMode && (
                        <span className="shrink-0 text-[10px] text-muted-foreground/60">
                          {new Date(s.updated_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigator resize handle */}
            <div
              onMouseDown={handleNavResizeStart}
              className="h-1 shrink-0 cursor-row-resize border-t border-[var(--overlay-6)] hover:bg-primary/10"
            />

            {/* Navigator section — resizable height */}
            <div
              className="shrink-0 overflow-hidden"
              style={{ height: navHeight }}
            >
              <FolderNavigator workspaceId={workspaceId} />
            </div>
          </div>

          {/* Main chat area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top bar */}
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--overlay-6)] px-3">
              <span className="flex-1 truncate text-sm font-medium">
                {sessionTitle}
              </span>
              {/* Streaming indicator in background */}
              {isStreaming && !viewingStreamingSession && (
                <span className="flex items-center gap-1 text-[10px] text-yellow-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  Background
                </span>
              )}
              <button
                onClick={handleToggleFullscreen}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                aria-label="Exit fullscreen"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
                aria-label="Close chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <MessageList
              onEditMessage={handleEditMessage}
              onRetryMessage={handleRetryMessage}
              onResendLastMessage={handleResendLastMessage}
              onSuggestedMessage={handleSend}
              isLoadingSession={!!sessionId && (isLoadingSession || sessionData?.data?.id !== sessionId)}
              showServerProcessing={showServerProcessing}
            />
            <ChatInput
              onSend={handleSend}
              onStop={abort}
              isStreaming={isStreaming && viewingStreamingSession}
              disabled={agentNotConfigured}
              placeholder={agentNotConfigured ? "Configure an AI model in Settings to start chatting" : undefined}
              thinkingEnabled={thinkingEnabled}
              onToggleThinking={handleToggleThinking}
              thinkingCapabilities={agentNotConfigured ? undefined : thinkingCapabilities}
              thinkingBudget={thinkingBudget}
              onSetThinkingBudget={handleSetThinkingBudget}
            />
          </div>
        </>
      ) : (
        /* ── COLLAPSED (SLIDE-IN) LAYOUT ── */
        <>
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--overlay-6)] px-3">
            <button
              onClick={handleNewChat}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              + New
            </button>

            {/* Session title as popover trigger for session list */}
            <Popover open={sessionListOpen} onOpenChange={setSessionListOpen}>
              <PopoverTrigger asChild>
                <button className="flex flex-1 items-center justify-center gap-1 truncate text-sm font-medium hover:text-primary">
                  <span className="truncate">{sessionTitle}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin"
              >
                {sessions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No sessions yet
                  </div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        handleSelectSession(s.id);
                        setSessionListOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                        s.id === sessionId
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
                      )}
                    >
                      {/* Streaming indicator */}
                      {s.status === "streaming" && s.id !== sessionId ? (
                        <LoadingDots className="shrink-0" />
                      ) : (
                        <MessageSquare className="h-3 w-3 shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {s.title ?? "Untitled"}
                      </span>
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>

            <button
              onClick={handleToggleFullscreen}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
              aria-label="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <MessageList
            onEditMessage={handleEditMessage}
            onRetryMessage={handleRetryMessage}
            onResendLastMessage={handleResendLastMessage}
            onSuggestedMessage={handleSend}
            isLoadingSession={!!sessionId && (isLoadingSession || sessionData?.data?.id !== sessionId)}
            showServerProcessing={showServerProcessing}
          />
          <ChatInput
            onSend={handleSend}
            onStop={abort}
            isStreaming={isStreaming && viewingStreamingSession}
            disabled={agentNotConfigured}
            placeholder={agentNotConfigured ? "Configure an AI model in Settings to chat" : undefined}
            thinkingEnabled={thinkingEnabled}
            onToggleThinking={handleToggleThinking}
            thinkingCapabilities={agentNotConfigured ? undefined : thinkingCapabilities}
            thinkingBudget={thinkingBudget}
            onSetThinkingBudget={handleSetThinkingBudget}
          />
        </>
      )}

      {/* Session context menu */}
      {contextMenu && (
        <SessionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => {
            setRenameState({
              sessionId: contextMenu.sessionId,
              title: contextMenu.sessionTitle,
            });
            setContextMenu(null);
          }}
          onDelete={() => handleDeleteSession(contextMenu.sessionId)}
          onSelect={() => handleEnterSelectMode(contextMenu.sessionId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Rename dialog */}
      {renameState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg border border-[var(--overlay-6)] bg-background p-4 shadow-xl">
            <h3 className="mb-3 text-sm font-medium">Rename Chat</h3>
            <input
              autoFocus
              value={renameState.title}
              onChange={(e) =>
                setRenameState({ ...renameState, title: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenameState(null);
              }}
              className="w-full rounded-md border border-[var(--overlay-8)] bg-[var(--overlay-4)] px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setRenameState(null)}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-[var(--overlay-6)]"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Right-click context menu for session tiles.
 */
function SessionContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-md border border-[var(--overlay-6)] bg-popover py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-[var(--overlay-4)]"
      >
        <Pencil className="h-3 w-3" />
        Rename
      </button>
      <button
        onClick={() => { onSelect(); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-[var(--overlay-4)]"
      >
        <CheckSquare className="h-3 w-3" />
        Select
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );
}

