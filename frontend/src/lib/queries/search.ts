"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ListResponse } from "@/types/models";

export interface SearchResult {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  folder_id: string | null;
  summary: string | null;
  page_count: number | null;
  word_count: number | null;
  language: string | null;
  rank: number;
  created_at: string;
  updated_at: string;
}

export function useSearch(workspaceId: string, query: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["search", workspaceId, query, limit, offset],
    queryFn: () =>
      api.get<ListResponse<SearchResult>>(
        `/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
      ),
    enabled: query.length > 0,
  });
}
