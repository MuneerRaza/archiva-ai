"use client";

import { useState } from "react";
import { Folder as FolderIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/file-icons";
import { FileStatusBadge } from "@/components/files/file-status-badge";
import { useFileBrowserStore } from "@/stores/file-browser-store";
import type { FileItem, Folder } from "@/types/models";

interface FileGridProps {
  folders: Folder[];
  files: FileItem[];
  allItemIds: string[];
  onFolderOpen: (folderId: string) => void;
  onFileOpen: (fileId: string) => void;
  onFileContextMenu: (e: React.MouseEvent, fileId: string) => void;
  onFolderContextMenu: (e: React.MouseEvent, folderId: string) => void;
  onMoveToFolder?: (itemIds: string[], targetFolderId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function FileGrid({
  folders,
  files,
  allItemIds,
  onFolderOpen,
  onFileOpen,
  onFileContextMenu,
  onFolderContextMenu,
  onMoveToFolder,
}: FileGridProps) {
  const { selectedIds, selectSingle, toggleSelected, rangeSelect, selectionMode, clipboard, focusedId } =
    useFileBrowserStore();
  const isCheckbox = selectionMode === "checkbox";
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  function handleClick(e: React.MouseEvent, id: string, type: "file" | "folder") {
    if (isCheckbox) {
      // In checkbox mode, clicking item opens it
      if (type === "folder") onFolderOpen(id);
      else onFileOpen(id);
      return;
    }
    // Windows mode
    if (e.shiftKey) {
      rangeSelect(id, allItemIds);
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelected(id);
    } else {
      selectSingle(id);
    }
  }

  function handleDoubleClick(id: string, type: "file" | "folder") {
    if (isCheckbox) return; // Already opens on single click
    if (type === "folder") onFolderOpen(id);
    else onFileOpen(id);
  }

  const isCut = (id: string) => clipboard?.operation === "cut" && clipboard.ids.includes(id);

  function handleDragStart(e: React.DragEvent, id: string) {
    // If dragging a non-selected item, select it first
    const ids = selectedIds.has(id) ? Array.from(selectedIds) : [id];
    e.dataTransfer.setData("application/x-file-ids", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleFolderDragOver(e: React.DragEvent, folderId: string) {
    if (e.dataTransfer.types.includes("application/x-file-ids")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetId(folderId);
    }
  }

  function handleFolderDragLeave() {
    setDropTargetId(null);
  }

  function handleFolderDrop(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    setDropTargetId(null);
    const raw = e.dataTransfer.getData("application/x-file-ids");
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    // Don't move a folder into itself
    const filtered = ids.filter((id) => id !== folderId);
    if (filtered.length > 0) {
      onMoveToFolder?.(filtered, folderId);
    }
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 p-4">
      {folders.map((folder) => {
        const isSelected = selectedIds.has(folder.id);
        const isFocused = focusedId === folder.id;
        return (
          <div
            key={`folder-${folder.id}`}
            data-id={folder.id}
            className={cn(
              "group relative flex cursor-pointer select-none flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors",
              isSelected
                ? "border-primary/40 bg-primary/5"
                : "border-transparent hover:border-[var(--overlay-8)] hover:bg-[var(--overlay-3)]",
              isFocused && "ring-1 ring-primary/60",
              dropTargetId === folder.id && "border-primary bg-primary/10",
              isCut(folder.id) && "opacity-40",
            )}
            draggable
            onDragStart={(e) => handleDragStart(e, folder.id)}
            onDragOver={(e) => handleFolderDragOver(e, folder.id)}
            onDragLeave={handleFolderDragLeave}
            onDrop={(e) => handleFolderDrop(e, folder.id)}
            onClick={(e) => handleClick(e, folder.id, "folder")}
            onDoubleClick={() => handleDoubleClick(folder.id, "folder")}
            onContextMenu={(e) => onFolderContextMenu(e, folder.id)}
          >
            {isCheckbox && (
              <div
                className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 data-[checked=true]:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  data-checked={isSelected}
                  onCheckedChange={() => toggleSelected(folder.id)}
                  aria-label={`Select ${folder.name}`}
                />
              </div>
            )}
            <FolderIcon
              className="h-10 w-10 text-blue-400"
              strokeWidth={1.25}
            />
            <span data-name className="line-clamp-3 break-all text-[12px] font-medium leading-tight">
              {folder.name}
            </span>
          </div>
        );
      })}

      {files.map((file) => {
        const { icon: Icon, color } = getFileIcon(file.mime_type);
        const isSelected = selectedIds.has(file.id);
        const isFocused = focusedId === file.id;

        return (
          <div
            key={`file-${file.id}`}
            data-id={file.id}
            className={cn(
              "group relative flex cursor-pointer select-none flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors",
              isSelected
                ? "border-primary/40 bg-primary/5"
                : "border-transparent hover:border-[var(--overlay-8)] hover:bg-[var(--overlay-3)]",
              isFocused && "ring-1 ring-primary/60",
              isCut(file.id) && "opacity-40",
            )}
            draggable
            onDragStart={(e) => handleDragStart(e, file.id)}
            onClick={(e) => handleClick(e, file.id, "file")}
            onDoubleClick={() => handleDoubleClick(file.id, "file")}
            onContextMenu={(e) => onFileContextMenu(e, file.id)}
          >
            {isCheckbox && (
              <div
                className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 data-[checked=true]:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  data-checked={isSelected}
                  onCheckedChange={() => toggleSelected(file.id)}
                  aria-label={`Select ${file.name}`}
                />
              </div>
            )}
            <div className="absolute right-2 top-2">
              <FileStatusBadge status={file.status} compact />
            </div>
            <Icon
              className={cn("h-10 w-10", color)}
              strokeWidth={1.25}
            />
            <div className="w-full min-w-0">
              <p data-name className="line-clamp-3 break-all text-[12px] font-medium leading-tight">
                {file.name}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatBytes(file.size_bytes)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
