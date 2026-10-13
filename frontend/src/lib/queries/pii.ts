"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type {
  DataResponse,
  PIIDetectionCreate,
  PIIDetectionUpdate,
  PIIDetectRequest,
  PIIRedactRequest,
  PIIRedactResult,
  PIIRun,
} from "@/types/models";

export function useLatestPIIRun(workspaceId: string, fileId: string, enabled = true) {
  return useQuery({
    queryKey: ["pii-run", workspaceId, fileId],
    queryFn: () =>
      api.get<DataResponse<PIIRun | null>>(
        `/workspaces/${workspaceId}/files/${fileId}/pii`,
      ),
    select: (res) => res.data,
    enabled,
  });
}

export function useDetectPII(workspaceId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PIIDetectRequest) =>
      api.post<DataResponse<PIIRun>>(
        `/workspaces/${workspaceId}/files/${fileId}/pii/detect`,
        body,
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(["pii-run", workspaceId, fileId], { data: res.data });
      toast.success(`Found ${res.data.detection_count} PII item${res.data.detection_count === 1 ? "" : "s"}`);
    },
    onError: () => {
      toast.error("PII detection failed");
    },
  });
}

export function useRedactPII(workspaceId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, ...body }: PIIRedactRequest & { runId: string }) =>
      api.post<DataResponse<PIIRedactResult>>(
        `/workspaces/${workspaceId}/files/${fileId}/pii/runs/${runId}/redact`,
        body,
      ),
    onSuccess: (res) => {
      const n = res.data.redaction_count;
      toast.success(
        res.data.mode === "copy"
          ? `Redacted ${n} item${n === 1 ? "" : "s"} into a new copy`
          : `Redacted ${n} item${n === 1 ? "" : "s"} in place`,
      );
      queryClient.invalidateQueries({ queryKey: ["browse", workspaceId] });
      // file-detail carries updated_at → viewer busts its cache after in-place edits.
      queryClient.invalidateQueries({ queryKey: ["file-detail", workspaceId, fileId] });
    },
    onError: () => {
      toast.error("Redaction failed");
    },
  });
}

export function useAddDetection(workspaceId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, ...body }: PIIDetectionCreate & { runId: string }) =>
      api.post<DataResponse<PIIRun>>(
        `/workspaces/${workspaceId}/files/${fileId}/pii/runs/${runId}/detections`,
        body,
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(["pii-run", workspaceId, fileId], { data: res.data });
      toast.success("Item added");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not add item");
    },
  });
}

export function useUpdateDetection(workspaceId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      detectionId,
      ...body
    }: PIIDetectionUpdate & { runId: string; detectionId: string }) =>
      api.patch<DataResponse<PIIRun>>(
        `/workspaces/${workspaceId}/files/${fileId}/pii/runs/${runId}/detections/${detectionId}`,
        body,
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(["pii-run", workspaceId, fileId], { data: res.data });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update item");
    },
  });
}

export function useDeleteDetection(workspaceId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, detectionId }: { runId: string; detectionId: string }) =>
      api.delete<DataResponse<PIIRun>>(
        `/workspaces/${workspaceId}/files/${fileId}/pii/runs/${runId}/detections/${detectionId}`,
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(["pii-run", workspaceId, fileId], { data: res.data });
    },
    onError: () => {
      toast.error("Could not remove item");
    },
  });
}
