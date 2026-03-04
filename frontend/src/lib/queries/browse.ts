"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { FileItem, Folder, Pagination } from "@/types/models";

interface BrowseResponse {
  folders: Folder[];
  files: FileItem[];
  pagination: Pagination;
}

export function useBrowse(
  workspaceId: string,
  folderId: string | null,
  sortBy: string = "name",
  sortDir: string = "asc",
) {
  const params = new URLSearchParams();
  if (folderId) params.set("folder_id", folderId);
  params.set("sort_by", sortBy);
  params.set("sort_dir", sortDir);

  return useQuery({
    queryKey: ["browse", workspaceId, folderId, sortBy, sortDir],
    queryFn: () =>
      api.get<BrowseResponse>(
        `/workspaces/${workspaceId}/browse?${params.toString()}`,
      ),
  });
}
