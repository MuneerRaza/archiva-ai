"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DataResponse, ListResponse, ProcessingJob } from "@/types/models";

export function useProcessingStatus(workspaceId: string, fileId: string) {
  return useQuery({
    queryKey: ["processing", workspaceId, fileId],
    queryFn: () =>
      api.get<DataResponse<ProcessingJob>>(
        `/workspaces/${workspaceId}/files/${fileId}/processing`,
      ),
    select: (res) => res.data,
    retry: false,
  });
}

interface ReprocessParams {
  fileId: string;
  steps?: string[];
}

export function useReprocess(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, steps }: ReprocessParams) =>
      api.post<DataResponse<{ status: string; file_id: string }>>(
        `/workspaces/${workspaceId}/files/${fileId}/reprocess`,
        steps ? { steps } : undefined,
      ),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({
        queryKey: ["processing", workspaceId, fileId],
      });
      queryClient.invalidateQueries({
        queryKey: ["file-detail", workspaceId, fileId],
      });
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["processing-history", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to start reprocessing");
    },
  });
}

function invalidateProcessing(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
): void {
  queryClient.invalidateQueries({ queryKey: ["processing-history", workspaceId] });
  queryClient.invalidateQueries({ queryKey: ["browse", workspaceId] });
}

export function useCancelProcessing(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      api.post<DataResponse<{ cancelled: boolean; file_id: string }>>(
        `/workspaces/${workspaceId}/files/${fileId}/cancel`,
      ),
    onSuccess: () => {
      invalidateProcessing(queryClient, workspaceId);
    },
    onError: () => {
      toast.error("Failed to stop processing");
    },
  });
}

export function useCancelAllProcessing(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<DataResponse<{ cancelled_count: number }>>(
        `/workspaces/${workspaceId}/processing/cancel-all`,
      ),
    onSuccess: (res) => {
      const n = res.data.cancelled_count;
      toast.success(
        n > 0 ? `Stopped ${n} file${n > 1 ? "s" : ""}` : "Nothing to stop",
      );
      invalidateProcessing(queryClient, workspaceId);
    },
    onError: () => {
      toast.error("Failed to stop processing");
    },
  });
}

export function useProcessingHistory(workspaceId: string) {
  return useQuery({
    queryKey: ["processing-history", workspaceId],
    queryFn: () =>
      api.get<ListResponse<ProcessingJob>>(
        `/workspaces/${workspaceId}/processing/history?limit=100`,
      ),
    select: (res) => res.data,
    refetchInterval: (query) => {
      const jobs = query.state.data?.data;
      if (!jobs) return 5000;
      const hasActive = jobs.some(
        (j) => j.status === "queued" || j.status === "running",
      );
      return hasActive ? 3000 : false;
    },
  });
}
