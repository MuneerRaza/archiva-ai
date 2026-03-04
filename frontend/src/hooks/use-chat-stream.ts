"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { useChatStore } from "@/stores/chat-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const API_ROOT = API_BASE ? `${API_BASE}/api` : "/api";

interface SendMessageOptions {
  workspaceId: string;
  message: string;
  sessionId?: string | null;
  contextLocation?: { type: string; id: string | null } | null;
  /** Skip adding the optimistic user message (used for retry where message already exists). */
  skipOptimisticMessage?: boolean;
}

/**
 * Hook for streaming agent chat via SSE.
 *
 * All state mutations go through useChatStore.getState() to avoid stale
 * closures during long-running streams.
 *
 * Streaming is session-aware: switching sessions does NOT abort the stream.
 * Events are silently discarded when the user is viewing a different session.
 * The server persists messages, so nothing is lost.
 */
export function useChatStream() {
  const qc = useQueryClient();

  const sendMessage = useCallback(
    async (opts: SendMessageOptions) => {
      const store = useChatStore.getState();
      const { workspaceId, message, contextLocation } = opts;
      const currentSessionId = opts.sessionId ?? store.sessionId;

      // Add user message immediately (optimistic) — unless retrying an existing message
      if (!opts.skipOptimisticMessage) {
        store.addMessage({
          id: `temp-${Date.now()}`,
          session_id: currentSessionId ?? "",
          role: "user",
          content: message,
          tool_name: null,
          tool_args: null,
          tool_result: null,
          created_at: new Date().toISOString(),
        });
      }

      // Reset streaming state
      store.clearStreamingText();
      store.clearStreamingThinking();
      store.clearToolCalls();
      store.setError(null);
      store.setErrorSessionId(null);
      store.setStatusText(null);
      store.setStreaming(true);

      // Track which session is streaming
      store.setStreamingSessionId(currentSessionId ?? "new");

      // Abort any in-flight request (from the SAME session, or a stale one)
      store.abortController?.abort();
      const controller = new AbortController();
      store.setAbortController(controller);

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        const body: Record<string, unknown> = { message };
        if (currentSessionId) body.session_id = currentSessionId;
        if (contextLocation) body.context_location = contextLocation;

        const response = await fetch(
          `${API_ROOT}/workspaces/${workspaceId}/agent/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const text = await response.text();
          const s = useChatStore.getState();
          s.setError(`Request failed: ${response.status} ${text}`);
          s.setStreaming(false);
          s.setStreamingSessionId(null);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const s = useChatStore.getState();
          s.setError("No response stream");
          s.setStreaming(false);
          s.setStreamingSessionId(null);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";

        while (true) {
          // Check abort before each read to exit fast
          if (controller.signal.aborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          // Check abort after read returns (could have been aborted while waiting)
          if (controller.signal.aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (controller.signal.aborted) break;
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                processEvent(currentEvent, parsed, qc, controller);
              } catch {
                // Skip malformed JSON
              }
            }
            // Ignore keepalive comments (lines starting with ":")
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          useChatStore.getState().setError((err as Error).message);
        }
      } finally {
        // Only clean up if this controller is still the active one
        const finalStore = useChatStore.getState();
        if (finalStore.abortController === controller || finalStore.abortController === null) {
          // If streamingSessionId is already null, the done handler already
          // cleaned up — skip to avoid double-clearing or racing with it.
          if (finalStore.streamingSessionId !== null) {
            finalStore.clearStreamingText();
            finalStore.clearStreamingThinking();
            finalStore.clearToolCalls();
            finalStore.setStreaming(false);
            finalStore.setStatusText(null);
            finalStore.setStreamingSessionId(null);
          }
          finalStore.setAbortController(null);
        }
      }
    },
    [qc],
  );

  const abort = useCallback(() => {
    const store = useChatStore.getState();
    store.abortController?.abort();
    store.setAbortController(null);

    const sid = store.sessionId ?? "";

    // Persist partial content as messages if viewing the streaming session
    const isViewing = isViewingStreamingSession(store);

    if (isViewing) {
      // Persist active tool calls as messages
      const currentToolCalls = store.toolCalls;
      for (const tc of currentToolCalls) {
        store.addMessage({
          id: `tc-${tc.id}`,
          session_id: sid,
          role: "tool_call",
          content: null,
          tool_name: tc.name,
          tool_args: tc.arguments,
          tool_result: null,
          created_at: new Date().toISOString(),
        });
        if (tc.result) {
          store.addMessage({
            id: `tr-${tc.id}`,
            session_id: sid,
            role: "tool_result",
            content: null,
            tool_name: tc.name,
            tool_args: null,
            tool_result: tc.result,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Finalize partial streaming text as a message
      if (store.streamingText) {
        store.addMessage({
          id: `partial-${Date.now()}`,
          session_id: sid,
          role: "assistant",
          content: store.streamingText,
          tool_name: null,
          tool_args: null,
          tool_result: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Always clear streaming buffers
    store.clearStreamingText();
    store.clearStreamingThinking();
    store.clearToolCalls();
    store.setStreaming(false);
    store.setStreamingSessionId(null);
  }, []);

  return { sendMessage, abort };
}

/**
 * Check if the user is currently viewing the session that's streaming.
 */
function isViewingStreamingSession(
  state: ReturnType<typeof useChatStore.getState>,
): boolean {
  const { sessionId, streamingSessionId } = state;
  if (!streamingSessionId) return false;
  // "new" means a new chat that hasn't been saved yet — sessionId is null
  if (streamingSessionId === "new" && sessionId === null) return true;
  return sessionId === streamingSessionId;
}

/**
 * Process a single SSE event. Uses getState() for fresh state access.
 *
 * Streaming buffers (text, thinking, tool calls) are ALWAYS accumulated
 * regardless of which session the user is viewing. This ensures no data
 * is lost when switching sessions during an active stream.
 *
 * On "done", messages are finalized into the messages array only if the
 * user is currently viewing the streaming session. Otherwise, buffers are
 * cleared and query invalidation ensures the server-persisted data loads
 * when the user navigates back.
 */
function processEvent(
  event: string,
  data: Record<string, unknown>,
  qc: ReturnType<typeof useQueryClient>,
  controller: AbortController,
) {
  // Bail immediately if this stream was aborted (prevents stale mutations)
  if (controller.signal.aborted) return;

  const store = useChatStore.getState;

  switch (event) {
    // Session created — sent immediately by backend before any LLM work.
    // Updates sessionId so the session tile appears in the sidebar right away.
    case "session_created": {
      const s = store();
      const newId = data.session_id as string;
      // Only update if we're still on the "new" session (user hasn't switched away)
      if (s.streamingSessionId === "new") {
        s.setStreamingSessionId(newId);
      }
      if (s.sessionId === null) {
        s.setSessionId(newId);
      }
      // Refresh session list so the tile appears immediately
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      break;
    }

    // Always accumulate deltas — buffers belong to the streaming session,
    // not the viewed session. The UI conditionally renders them.
    case "text_delta": {
      store().appendStreamingText(data.content as string);
      break;
    }

    case "thinking_delta": {
      store().appendStreamingThinking(data.content as string);
      break;
    }

    case "tool_call_start": {
      store().addToolCall({
        id: data.id as string,
        name: data.name as string,
        arguments: data.arguments as Record<string, unknown>,
      });
      break;
    }

    case "tool_call_result": {
      store().updateToolCallResult(
        data.id as string,
        data.result as Record<string, unknown>,
      );
      break;
    }

    case "status": {
      store().setStatusText(data.text as string);
      break;
    }

    case "done": {
      const newSessionId = data.session_id as string;
      // Read state once for the done handler to avoid races
      const s = store();
      const viewing = isViewingStreamingSession(s);

      // If user is still viewing this session, finalize messages locally
      if (viewing) {
        s.setSessionId(newSessionId);

        // Persist tool calls BEFORE the assistant text (chronological order)
        const currentToolCalls = s.toolCalls;
        for (const tc of currentToolCalls) {
          store().addMessage({
            id: `tc-${tc.id}`,
            session_id: newSessionId,
            role: "tool_call",
            content: null,
            tool_name: tc.name,
            tool_args: tc.arguments,
            tool_result: null,
            created_at: new Date().toISOString(),
          });
          if (tc.result) {
            store().addMessage({
              id: `tr-${tc.id}`,
              session_id: newSessionId,
              role: "tool_result",
              content: null,
              tool_name: tc.name,
              tool_args: null,
              tool_result: tc.result,
              created_at: new Date().toISOString(),
            });
          }
        }

        // Then add assistant text message with thinking attached
        if (s.streamingText) {
          const thinking = s.streamingThinking || null;
          s.addMessage({
            id: (data.message_id as string) ?? `msg-${Date.now()}`,
            session_id: newSessionId,
            role: "assistant",
            content: s.streamingText,
            tool_name: null,
            tool_args: null,
            tool_result: null,
            created_at: new Date().toISOString(),
            thinking,
          });
        }
      }

      // Always clear streaming buffers (whether viewing or not)
      store().clearStreamingText();
      store().clearStreamingThinking();
      store().clearToolCalls();

      // Clear streaming state — only if this controller is still the active one
      const latest = store();
      if (latest.abortController === controller || latest.abortController === null) {
        latest.setStreaming(false);
        latest.setStreamingSessionId(null);
        latest.setStatusText(null);
        latest.setAbortController(null);
      }

      // Invalidate all session queries — ensures fresh data on next view
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      qc.invalidateQueries({ queryKey: ["agent-session"] });
      break;
    }

    case "error":
      store().setError(data.message as string);
      // Record which session owns this error so it survives session switches.
      // When the user switches away and comes back, the error is still shown.
      store().setErrorSessionId(store().streamingSessionId);
      // Refresh session list so the tile persists even if LLM failed
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      break;
  }
}
