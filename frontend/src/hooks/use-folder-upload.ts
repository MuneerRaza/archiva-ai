"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useUploadStore } from "@/stores/upload-store";
import type { DataResponse, FileItem, Folder } from "@/types/models";

interface FolderUploadResult {
  total: number;
  succeeded: number;
  failed: number;
  cancelled: boolean;
}

/**
 * Parse webkitRelativePath values from a file list into unique directory paths,
 * grouped by depth (shallowest first) so parents are created before children.
 */
function extractDirectoryPathsByDepth(files: File[]): string[][] {
  const dirs = new Set<string>();
  for (const file of files) {
    const relativePath = file.webkitRelativePath;
    if (!relativePath) continue;
    const segments = relativePath.split("/").slice(0, -1);
    for (let i = 1; i <= segments.length; i++) {
      dirs.add(segments.slice(0, i).join("/"));
    }
  }

  // Group by depth
  const byDepth = new Map<number, string[]>();
  for (const dir of dirs) {
    const depth = dir.split("/").length;
    const group = byDepth.get(depth);
    if (group) {
      group.push(dir);
    } else {
      byDepth.set(depth, [dir]);
    }
  }

  // Return sorted by depth (ascending)
  return Array.from(byDepth.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, paths]) => paths);
}

function parentPath(dirPath: string): string | null {
  const idx = dirPath.lastIndexOf("/");
  return idx === -1 ? null : dirPath.slice(0, idx);
}

async function ensureFolder(
  workspaceId: string,
  name: string,
  parentId: string | null,
): Promise<Folder> {
  const res = await api.post<DataResponse<Folder>>(
    `/workspaces/${workspaceId}/folders/ensure`,
    { name, parent_id: parentId },
  );
  return res.data;
}

async function uploadFile(
  workspaceId: string,
  file: File,
  folderId: string | null,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  if (folderId) {
    formData.append("folder_id", folderId);
  }
  await api.upload<DataResponse<FileItem>>(
    `/workspaces/${workspaceId}/files`,
    formData,
  );
}

/** Upload files with limited concurrency, reporting progress via store. */
async function uploadWithConcurrency(
  workspaceId: string,
  files: { file: File; folderId: string | null }[],
  concurrency: number,
  signal: AbortSignal,
): Promise<{ succeeded: number; failed: number; cancelled: boolean }> {
  let succeeded = 0;
  let failed = 0;
  let index = 0;

  async function worker(): Promise<void> {
    while (index < files.length) {
      if (signal.aborted) return;
      const current = index++;
      const { file, folderId } = files[current];
      try {
        await uploadFile(workspaceId, file, folderId);
        succeeded++;
        useUploadStore.getState().onFileUploaded();
      } catch {
        if (signal.aborted) return;
        failed++;
        useUploadStore.getState().onFileFailed();
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return { succeeded, failed, cancelled: signal.aborted };
}

export function useFolderUpload(
  workspaceId: string,
  baseFolderId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["upload-folder"],
    mutationFn: async (files: File[]): Promise<FolderUploadResult> => {
      // 1. Extract folder structure grouped by depth
      const depthGroups = extractDirectoryPathsByDepth(files);
      const totalFolders = depthGroups.reduce((sum, g) => sum + g.length, 0);

      const store = useUploadStore.getState();
      store.startFolderUpload(files.length, totalFolders);
      const signal = useUploadStore.getState().abortController!.signal;

      const pathToId = new Map<string, string>();

      // Create folders level by level — each level in parallel
      for (const levelPaths of depthGroups) {
        if (signal.aborted) {
          return { total: files.length, succeeded: 0, failed: 0, cancelled: true };
        }

        const results = await Promise.all(
          levelPaths.map(async (dirPath) => {
            const segments = dirPath.split("/");
            const name = segments[segments.length - 1];
            const parent = parentPath(dirPath);
            const parentId = parent !== null ? (pathToId.get(parent) ?? null) : baseFolderId;

            const folder = await ensureFolder(workspaceId, name, parentId);
            useUploadStore.getState().onFolderCreated();
            return { dirPath, folderId: folder.id };
          }),
        );

        for (const { dirPath, folderId } of results) {
          pathToId.set(dirPath, folderId);
        }
      }

      // 2. Switch to uploading phase
      useUploadStore.getState().setPhase("uploading");

      // 3. Map files to their folder IDs
      const fileEntries = files.map((file) => {
        const relativePath = file.webkitRelativePath;
        const segments = relativePath.split("/").slice(0, -1);
        const dirPath = segments.join("/");
        const folderId = dirPath ? (pathToId.get(dirPath) ?? baseFolderId) : baseFolderId;
        return { file, folderId };
      });

      // 4. Upload files with concurrency
      const { succeeded, failed, cancelled } = await uploadWithConcurrency(
        workspaceId,
        fileEntries,
        6,
        signal,
      );

      return { total: files.length, succeeded, failed, cancelled };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["browse", workspaceId] });
      if (result.cancelled) {
        toast.info(`Upload cancelled — ${result.succeeded} file(s) uploaded`);
      } else if (result.failed === 0) {
        toast.success(`Uploaded ${result.succeeded} file(s)`);
      } else {
        toast.warning(
          `Uploaded ${result.succeeded} file(s), ${result.failed} failed`,
        );
      }
    },
    onError: () => {
      toast.error("Folder upload failed");
    },
    onSettled: () => {
      useUploadStore.getState().reset();
    },
  });
}
