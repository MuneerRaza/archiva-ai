"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type {
  DataResponse,
  FileItem,
} from "@/types/models";

interface FileDownloadResponse {
  url: string;
  expires_in: number;
}

export function useUploadFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["upload-file"],
    mutationFn: ({
      file,
      folderId,
    }: {
      file: File;
      folderId: string | null;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (folderId) {
        formData.append("folder_id", folderId);
      }
      return api.upload<DataResponse<FileItem>>(
        `/workspaces/${workspaceId}/files`,
        formData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
  });
}

export function useUpdateFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fileId,
      data,
    }: {
      fileId: string;
      data: { name?: string; folder_id?: string | null; move_to_root?: boolean };
    }) =>
      api.patch<DataResponse<FileItem>>(
        `/workspaces/${workspaceId}/files/${fileId}`,
        data,
      ),
    onSuccess: () => {
      toast.success("File updated");
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to update file");
    },
  });
}

export function useDeleteFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      api.delete(`/workspaces/${workspaceId}/files/${fileId}`),
    onSuccess: () => {
      toast.success("File deleted");
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to delete file");
    },
  });
}

export function useBulkDeleteFiles(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileIds: string[]) =>
      api.delete<DataResponse<{ deleted: number }>>(
        `/workspaces/${workspaceId}/files`,
        { file_ids: fileIds },
      ),
    onSuccess: (_data, fileIds) => {
      toast.success(`Deleted ${fileIds.length} file(s)`);
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to delete files");
    },
  });
}

export function useMoveFiles(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fileIds,
      targetFolderId,
    }: {
      fileIds: string[];
      targetFolderId: string | null;
    }) =>
      api.patch<DataResponse<{ moved: number }>>(
        `/workspaces/${workspaceId}/files/move`,
        { file_ids: fileIds, target_folder_id: targetFolderId },
      ),
    onSuccess: (_data, variables) => {
      toast.success(`Moved ${variables.fileIds.length} file(s)`);
      queryClient.invalidateQueries({
        queryKey: ["browse", workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to move files");
    },
  });
}

export function useFileDownloadUrl(workspaceId: string, fileId: string) {
  return useQuery({
    queryKey: ["file-download", workspaceId, fileId],
    queryFn: () =>
      api.get<DataResponse<FileDownloadResponse>>(
        `/workspaces/${workspaceId}/files/${fileId}/download`,
      ),
    enabled: false,
    select: (res) => res.data,
  });
}
