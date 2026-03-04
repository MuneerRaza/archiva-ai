"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  AgentSession,
  AgentSessionDetail,
  DataResponse,
  ListResponse,
} from "@/types/models";

export function useAgentSessions(workspaceId: string) {
  return useQuery({
    queryKey: ["agent-sessions", workspaceId],
    queryFn: () =>
      api.get<ListResponse<AgentSession>>(
        `/workspaces/${workspaceId}/agent/sessions?limit=50`,
      ),
    refetchInterval: (query) => {
      const sessions = query.state.data?.data;
      if (!sessions) return false;
      return sessions.some((s) => s.status === "streaming") ? 3000 : false;
    },
  });
}

export function useAgentSession(workspaceId: string, sessionId: string | null) {
  return useQuery({
    queryKey: ["agent-session", workspaceId, sessionId],
    queryFn: () =>
      api.get<DataResponse<AgentSessionDetail>>(
        `/workspaces/${workspaceId}/agent/sessions/${sessionId}`,
      ),
    enabled: !!sessionId,
  });
}

export function useDeleteAgentSession(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/workspaces/${workspaceId}/agent/sessions/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-sessions", workspaceId] });
    },
  });
}

export function useRenameAgentSession(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      api.patch<DataResponse<AgentSession>>(
        `/workspaces/${workspaceId}/agent/sessions/${sessionId}?title=${encodeURIComponent(title)}`,
        {},
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agent-sessions", workspaceId] });
      qc.invalidateQueries({ queryKey: ["agent-session", workspaceId, vars.sessionId] });
    },
  });
}

export function useTruncateMessages(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      afterMessageId,
      inclusive = false,
    }: {
      sessionId: string;
      afterMessageId: string;
      inclusive?: boolean;
    }) => {
      const params = new URLSearchParams({ after: afterMessageId });
      if (inclusive) params.set("inclusive", "true");
      return api.delete<DataResponse<{ deleted: number }>>(
        `/workspaces/${workspaceId}/agent/sessions/${sessionId}/messages?${params}`,
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["agent-session", workspaceId, vars.sessionId],
      });
    },
  });
}
