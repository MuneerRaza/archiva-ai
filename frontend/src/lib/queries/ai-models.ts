"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type {
  AIModel,
  AIModelCreate,
  AIModelTestRequest,
  AIModelTestResult,
  AIModelUpdate,
  DataResponse,
  ListResponse,
} from "@/types/models";

export function useAIModels() {
  return useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api.get<ListResponse<AIModel>>("/ai-models"),
    select: (res) => res.data,
  });
}

export function useCreateAIModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AIModelCreate) =>
      api.post<DataResponse<AIModel>>("/ai-models", data),
    onSuccess: (_data, variables) => {
      toast.success(`Added model "${variables.label}"`);
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: () => {
      toast.error("Failed to add model");
    },
  });
}

export function useUpdateAIModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: AIModelUpdate & { id: string }) =>
      api.patch<DataResponse<AIModel>>(`/ai-models/${id}`, data),
    onSuccess: () => {
      toast.success("Model updated");
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: () => {
      toast.error("Failed to update model");
    },
  });
}

export function useDeleteAIModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ai-models/${id}`),
    onSuccess: () => {
      toast.success("Model removed");
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: () => {
      toast.error("Failed to remove model");
    },
  });
}

export function useTestAIModel() {
  return useMutation({
    mutationFn: (data: AIModelTestRequest) =>
      api.post<DataResponse<AIModelTestResult>>("/ai-models/test", data),
    onSuccess: (res) => {
      if (res.data.success) {
        toast.success("Connection successful");
      } else {
        toast.error(res.data.error ?? "Connection failed");
      }
    },
    onError: () => {
      toast.error("Failed to reach the server");
    },
  });
}

export function useRefreshCapabilities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<DataResponse<AIModel>>(`/ai-models/${id}/refresh-capabilities`),
    onSuccess: () => {
      toast.success("Capabilities updated");
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: (error: Error) => {
      const msg = (error as { message?: string }).message ?? "Failed to detect capabilities";
      toast.error(msg);
    },
  });
}
