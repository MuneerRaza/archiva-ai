"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const API_ROOT = API_BASE ? `${API_BASE}/api` : "/api";

export function useProcessingEvents(workspaceId: string) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      const url = `${API_ROOT}/workspaces/${workspaceId}/processing/events`;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("event:")) continue;
            const eventType = line.slice(6).trim();

            if (
              eventType === "processing_started" ||
              eventType === "processing_completed" ||
              eventType === "processing_failed"
            ) {
              queryClient.invalidateQueries({ queryKey: ["browse", workspaceId] });
              queryClient.invalidateQueries({ queryKey: ["processing-history", workspaceId] });
              queryClient.invalidateQueries({
                predicate: (query) => {
                  const key = query.queryKey;
                  return (
                    (key[0] === "file-detail" && key[1] === workspaceId) ||
                    (key[0] === "processing" && key[1] === workspaceId)
                  );
                },
              });
            }
          }
        }
      } catch {
        // AbortError or network failure — expected on cleanup
      }
    }

    connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [workspaceId, queryClient]);
}
