"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { useFolderUpload } from "@/hooks/use-folder-upload";
import { useUploadFile } from "@/lib/queries/files";
import { useFileBrowserStore } from "@/stores/file-browser-store";

interface DropZoneProps {
  workspaceId: string;
  children: React.ReactNode;
}

/** Recursively read all files from a FileSystemDirectoryEntry. */
function readDirectoryFiles(
  entry: FileSystemDirectoryEntry,
  basePath: string,
): Promise<File[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const allFiles: File[] = [];

    function readBatch(): void {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(allFiles);
          return;
        }
        for (const child of entries) {
          if (child.isFile) {
            const file = await new Promise<File>((res) =>
              (child as FileSystemFileEntry).file(res),
            );
            // Construct a new File with webkitRelativePath set via the path
            const withPath = new File([file], file.name, { type: file.type });
            Object.defineProperty(withPath, "webkitRelativePath", {
              value: `${basePath}/${file.name}`,
              writable: false,
            });
            allFiles.push(withPath);
          } else if (child.isDirectory) {
            const subFiles = await readDirectoryFiles(
              child as FileSystemDirectoryEntry,
              `${basePath}/${child.name}`,
            );
            allFiles.push(...subFiles);
          }
        }
        // readEntries may return results in batches
        readBatch();
      });
    }

    readBatch();
  });
}

export function DropZone({ workspaceId, children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { currentFolderId } = useFileBrowserStore();
  const uploadFile = useUploadFile(workspaceId);
  const folderUpload = useFolderUpload(workspaceId, currentFolderId);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter.current = 0;

      const items = e.dataTransfer.items;
      const looseFiles: File[] = [];
      const directoryFiles: File[] = [];

      if (items && items.length > 0) {
        // Check for directory entries via webkitGetAsEntry
        const entries: { entry: FileSystemEntry; item: DataTransferItem }[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) {
            entries.push({ entry, item: items[i] });
          }
        }

        for (const { entry, item } of entries) {
          if (entry.isDirectory) {
            const files = await readDirectoryFiles(
              entry as FileSystemDirectoryEntry,
              entry.name,
            );
            directoryFiles.push(...files);
          } else {
            const file = item.getAsFile();
            if (file) looseFiles.push(file);
          }
        }
      } else {
        // Fallback: no items API
        looseFiles.push(...Array.from(e.dataTransfer.files));
      }

      // Upload directories via folder upload hook
      if (directoryFiles.length > 0) {
        folderUpload.mutate(directoryFiles);
      }

      // Upload loose files individually
      for (const file of looseFiles) {
        uploadFile.mutate({ file, folderId: currentFolderId });
      }
    },
    [currentFolderId, uploadFile, folderUpload],
  );

  return (
    <div
      className="relative flex flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-primary">
              Drop files or folders to upload
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
