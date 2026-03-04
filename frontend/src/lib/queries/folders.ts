"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DataResponse, Folder } from "@/types/models";

export function useCreateFolder(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parent_id?: string | null }) =>
      api.post<DataResponse<Folder>>(
        `/workspaces/${workspaceId}/folders`,
        data,
      ),
    onSuccess: (_data, variables) => {
      toast.success(`Created folder "${variables.name}"`);
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to create folder");
    },
  });
}

export function useRenameFolder(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      api.patch<DataResponse<Folder>>(
        `/workspaces/${workspaceId}/folders/${folderId}`,
        { name },
      ),
    onSuccess: () => {
      toast.success("Folder renamed");
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to rename folder");
    },
  });
}

export function useDeleteFolder(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (folderId: string) =>
      api.delete(`/workspaces/${workspaceId}/folders/${folderId}`),
    onSuccess: () => {
      toast.success("Folder deleted");
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to delete folder");
    },
  });
}
