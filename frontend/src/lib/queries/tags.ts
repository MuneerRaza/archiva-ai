"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DataResponse, Tag } from "@/types/models";

export function useTags(workspaceId: string) {
  return useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () =>
      api.get<Tag[]>(`/workspaces/${workspaceId}/tags`),
  });
}

export function useCreateTag(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      api.post<DataResponse<Tag>>(`/workspaces/${workspaceId}/tags`, data),
    onSuccess: (_data, variables) => {
      toast.success(`Created tag "${variables.name}"`);
      queryClient.invalidateQueries({ queryKey: ["tags", workspaceId] });
    },
    onError: () => {
      toast.error("Failed to create tag");
    },
  });
}

export function useAddTagToFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, tagId }: { fileId: string; tagId: string }) =>
      api.post(`/workspaces/${workspaceId}/tags/files/${fileId}/${tagId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["file-detail", workspaceId, variables.fileId],
      });
    },
    onError: () => {
      toast.error("Failed to add tag");
    },
  });
}

export function useRemoveTagFromFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, tagId }: { fileId: string; tagId: string }) =>
      api.delete(`/workspaces/${workspaceId}/tags/files/${fileId}/${tagId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["file-detail", workspaceId, variables.fileId],
      });
    },
    onError: () => {
      toast.error("Failed to remove tag");
    },
  });
}
