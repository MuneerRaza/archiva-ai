import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AgentMessage, ContextLocation } from "@/types/models";

interface ToolCallEvent {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "running" | "done";
}

interface ChatState {
  // Messages in current session (includes history + streaming)
  messages: AgentMessage[];
  setMessages: (messages: AgentMessage[]) => void;
  addMessage: (message: AgentMessage) => void;
  truncateAfter: (messageId: string) => void;
  /** Remove a message and everything after it (inclusive) */
  truncateFrom: (messageId: string) => AgentMessage[];

  /** Which session owns the current error (so it survives session switches) */
  errorSessionId: string | null;
  setErrorSessionId: (id: string | null) => void;

  // Branching (frontend-only, ChatGPT-style)
  branches: Map<string, AgentMessage[][]>;
  activeBranchIndex: Map<string, number>;
  addBranch: (forkMessageId: string, branchMessages: AgentMessage[]) => void;
  setActiveBranch: (forkMessageId: string, index: number) => void;

  // Streaming state
  isStreaming: boolean;
  setStreaming: (streaming: boolean) => void;

  /** Which session has an active stream (null = none, "new" = new unsaved chat) */
  streamingSessionId: string | null;
  setStreamingSessionId: (id: string | null) => void;

  // Current streaming text (assistant response being built)
  streamingText: string;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;

  // Current streaming thinking text (reasoning being built)
  streamingThinking: string;
  appendStreamingThinking: (text: string) => void;
  clearStreamingThinking: () => void;

  // Active tool calls during streaming
  toolCalls: ToolCallEvent[];
  addToolCall: (tc: Omit<ToolCallEvent, "status">) => void;
  updateToolCallResult: (id: string, result: Record<string, unknown>) => void;
  clearToolCalls: () => void;

  // Status indicator
  statusText: string | null;
  setStatusText: (text: string | null) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;

  // Current session ID (the one being viewed)
  sessionId: string | null;
  setSessionId: (id: string | null) => void;

  // Abort controller for current stream
  abortController: AbortController | null;
  setAbortController: (controller: AbortController | null) => void;

  // Dynamic context location (folder/file user is viewing)
  contextLocation: ContextLocation | null;
  contextName: string | null;
  contextManuallySet: boolean;
  setContextLocation: (loc: ContextLocation | null, name?: string) => void;
  setContextManuallySet: (manual: boolean) => void;

  /** Add an ephemeral system message for context changes (only call when chat is visible) */
  addContextSystemMessage: (name: string) => void;

  /** Switch to a different session without aborting any active stream */
  switchSession: (id: string | null) => void;

  // Reset everything for new session
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
  (set, get) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  truncateAfter: (messageId) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return s;
      return { messages: s.messages.slice(0, idx + 1) };
    }),
  truncateFrom: (messageId) => {
    const state = get();
    const idx = state.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return [];
    const removed = state.messages.slice(idx);
    set({ messages: state.messages.slice(0, idx) });
    return removed;
  },

  errorSessionId: null,
  setErrorSessionId: (id) => set({ errorSessionId: id }),

  // Branching
  branches: new Map(),
  activeBranchIndex: new Map(),
  addBranch: (forkMessageId, branchMessages) =>
    set((s) => {
      const newBranches = new Map(s.branches);
      const existing = newBranches.get(forkMessageId) ?? [];
      newBranches.set(forkMessageId, [...existing, branchMessages]);
      const newIndex = new Map(s.activeBranchIndex);
      // Active branch is the latest (current thread)
      newIndex.set(forkMessageId, existing.length);
      return { branches: newBranches, activeBranchIndex: newIndex };
    }),
  setActiveBranch: (forkMessageId, index) =>
    set((s) => {
      const newIndex = new Map(s.activeBranchIndex);
      newIndex.set(forkMessageId, index);
      return { activeBranchIndex: newIndex };
    }),

  isStreaming: false,
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  streamingSessionId: null,
  setStreamingSessionId: (id) => set({ streamingSessionId: id }),

  streamingText: "",
  appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  clearStreamingText: () => set({ streamingText: "" }),

  streamingThinking: "",
  appendStreamingThinking: (text) => set((s) => ({ streamingThinking: s.streamingThinking + text })),
  clearStreamingThinking: () => set({ streamingThinking: "" }),

  toolCalls: [],
  addToolCall: (tc) =>
    set((s) => ({
      toolCalls: [...s.toolCalls, { ...tc, status: "running" as const }],
    })),
  updateToolCallResult: (id, result) =>
    set((s) => ({
      toolCalls: s.toolCalls.map((tc) =>
        tc.id === id ? { ...tc, result, status: "done" as const } : tc,
      ),
    })),
  clearToolCalls: () => set({ toolCalls: [] }),

  statusText: null,
  setStatusText: (text) => set({ statusText: text }),

  error: null,
  setError: (error) => set({ error }),

  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  abortController: null,
  setAbortController: (controller) => set({ abortController: controller }),

  contextLocation: null,
  contextName: null,
  contextManuallySet: false,
  setContextLocation: (loc, name) => {
    set({ contextLocation: loc, contextName: name ?? null });
  },
  setContextManuallySet: (manual) => set({ contextManuallySet: manual }),
  addContextSystemMessage: (name) => {
    const state = get();
    if (!state.sessionId) return;
    state.addMessage({
      id: `ctx-${Date.now()}`,
      session_id: state.sessionId,
      role: "system" as AgentMessage["role"],
      content: name === "home" ? "At home" : `Changed to: ${name}`,
      tool_name: null,
      tool_args: null,
      tool_result: null,
      created_at: new Date().toISOString(),
    });
  },

  switchSession: (id) => {
    // Clear session-specific display state. Streaming buffers (streamingText,
    // streamingThinking, toolCalls) are NOT cleared — they belong to the
    // streaming session and must survive session switches so data isn't lost.
    //
    // Preserve the error if we're switching BACK to the session that owned it.
    // This way, "LLM error → switch away → switch back" still shows the error.
    //
    // Messages are always cleared on session switch. Keeping previous messages
    // when switching back to a streaming session can leak another session's
    // content into the view and hide the active stream state.
    const s = get();
    set({
      messages: [],
      error: s.errorSessionId === id ? s.error : null,
      errorSessionId: s.errorSessionId === id ? s.errorSessionId : null,
      sessionId: id,
      branches: new Map(),
      activeBranchIndex: new Map(),
    });
  },

  reset: () =>
    set({
      messages: [],
      isStreaming: false,
      streamingText: "",
      streamingThinking: "",
      toolCalls: [],
      statusText: null,
      error: null,
      errorSessionId: null,
      sessionId: null,
      abortController: null,
      streamingSessionId: null,
      branches: new Map(),
      activeBranchIndex: new Map(),
    }),
}),
  {
    name: "archiva-chat",
    partialize: (state) => ({
      sessionId: state.sessionId,
    }),
  },
));

export type { ToolCallEvent };
