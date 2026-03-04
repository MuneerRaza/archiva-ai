"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { useUploadFile } from "@/lib/queries/files";
import { useFileBrowserStore } from "@/stores/file-browser-store";

interface DropZoneProps {
  workspaceId: string;
  children: React.ReactNode;
}

export function DropZone({ workspaceId, children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { currentFolderId } = useFileBrowserStore();
  const uploadFile = useUploadFile(workspaceId);
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
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        uploadFile.mutate({ file, folderId: currentFolderId });
      }
    },
    [currentFolderId, uploadFile],
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
              Drop files to upload
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
