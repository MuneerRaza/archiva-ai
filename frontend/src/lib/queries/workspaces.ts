"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DataResponse, ListResponse, Workspace } from "@/types/models";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<ListResponse<Workspace>>("/workspaces"),
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ["workspaces", workspaceId],
    queryFn: () =>
      api.get<DataResponse<Workspace>>(`/workspaces/${workspaceId}`),
    select: (res) => res.data,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<DataResponse<Workspace>>("/workspaces", data),
    onSuccess: (_data, variables) => {
      toast.success(`Created workspace "${variables.name}"`);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: () => {
      toast.error("Failed to create workspace");
    },
  });
}

export function useUpdateWorkspace(workspaceId: string, options?: { silent?: boolean }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; settings?: Record<string, unknown> }) =>
      api.patch<DataResponse<Workspace>>(`/workspaces/${workspaceId}`, data),
    onSuccess: (res) => {
      if (!options?.silent) {
        toast.success("Workspace updated");
      }
      // For silent auto-saves, set query data directly from the response
      // instead of invalidating — prevents refetch from overwriting local state
      if (options?.silent) {
        queryClient.setQueryData(["workspaces", workspaceId], res);
        queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }
    },
    onError: () => {
      toast.error("Failed to save changes");
    },
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}`),
    onSuccess: () => {
      toast.success("Workspace deleted");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: () => {
      toast.error("Failed to delete workspace");
    },
  });
}
