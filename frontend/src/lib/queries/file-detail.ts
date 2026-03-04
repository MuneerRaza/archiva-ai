"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DataResponse, FileDetail } from "@/types/models";

export function useFileDetail(workspaceId: string, fileId: string) {
  return useQuery({
    queryKey: ["file-detail", workspaceId, fileId],
    queryFn: () =>
      api.get<DataResponse<FileDetail>>(
        `/workspaces/${workspaceId}/files/${fileId}/detail`,
      ),
    select: (res) => res.data,
    retry: 1,
  });
}

export function useClearArtifacts(workspaceId: string, fileId: string) {
  const qc = useQueryClient();
  const queryKey = ["file-detail", workspaceId, fileId];

  return useMutation({
    mutationFn: (fields: string[]) =>
      api.delete(`/workspaces/${workspaceId}/files/${fileId}/artifacts`, { fields }),
    onMutate: async (fields) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<DataResponse<FileDetail>>(queryKey);

      if (previous?.data?.content) {
        const updatedContent = { ...previous.data.content };
        for (const field of fields) {
          if (field === "summary") updatedContent.summary = null;
          if (field === "overview") updatedContent.overview = null;
          if (field === "structure") updatedContent.structure = null;
          if (field === "raw_text") updatedContent.raw_text = null;
        }
        qc.setQueryData<DataResponse<FileDetail>>(queryKey, {
          ...previous,
          data: { ...previous.data, content: updatedContent },
        });
      }

      return { previous };
    },
    onError: (_err, _fields, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}
