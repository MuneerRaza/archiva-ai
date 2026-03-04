"use client";

import { useState } from "react";
import { Folder as FolderIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/file-icons";
import { FileStatusBadge } from "@/components/files/file-status-badge";
import { useFileBrowserStore } from "@/stores/file-browser-store";
import type { FileItem, Folder } from "@/types/models";

interface FileTableProps {
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FileTable({
  folders,
  files,
  allItemIds,
  onFolderOpen,
  onFileOpen,
  onFileContextMenu,
  onFolderContextMenu,
  onMoveToFolder,
}: FileTableProps) {
  const {
    selectedIds,
    selectSingle,
    toggleSelected,
    rangeSelect,
    selectAll,
    clearSelection,
    selectionMode,
    clipboard,
    focusedId,
  } = useFileBrowserStore();
  const isCheckbox = selectionMode === "checkbox";
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const allSelected = allItemIds.length > 0 && allItemIds.every((id) => selectedIds.has(id));

  function handleSelectAll() {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(allItemIds);
    }
  }

  function handleRowClick(e: React.MouseEvent, id: string, type: "file" | "folder") {
    if (isCheckbox) {
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
    if (isCheckbox) return;
    if (type === "folder") onFolderOpen(id);
    else onFileOpen(id);
  }

  const isCut = (id: string) => clipboard?.operation === "cut" && clipboard.ids.includes(id);

  function handleDragStart(e: React.DragEvent, id: string) {
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
    const filtered = ids.filter((id) => id !== folderId);
    if (filtered.length > 0) {
      onMoveToFolder?.(filtered, folderId);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {isCheckbox && (
            <TableHead className="w-[40px] pl-5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
          )}
          <TableHead className={cn(!isCheckbox && "pl-5")}>
            <span className="text-[13px] font-medium">Name</span>
          </TableHead>
          <TableHead className="w-[100px]">
            <span className="text-[13px] font-medium">Size</span>
          </TableHead>
          <TableHead className="w-[100px]">
            <span className="text-[13px] font-medium">Status</span>
          </TableHead>
          <TableHead className="w-[140px]">
            <span className="text-[13px] font-medium">Modified</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map((folder) => {
          const isSelected = selectedIds.has(folder.id);
          const isFocused = focusedId === folder.id;
          return (
            <TableRow
              key={`folder-${folder.id}`}
              data-id={folder.id}
              className={cn(
                "cursor-pointer select-none",
                isSelected && "bg-primary/5",
                isFocused && "ring-1 ring-inset ring-primary/60",
                dropTargetId === folder.id && "bg-primary/10",
                isCut(folder.id) && "opacity-40",
              )}
              draggable
              onDragStart={(e) => handleDragStart(e, folder.id)}
              onDragOver={(e) => handleFolderDragOver(e, folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
              onClick={(e) => handleRowClick(e, folder.id, "folder")}
              onDoubleClick={() => handleDoubleClick(folder.id, "folder")}
              onContextMenu={(e) => onFolderContextMenu(e, folder.id)}
            >
              {isCheckbox && (
                <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelected(folder.id)}
                    aria-label={`Select ${folder.name}`}
                  />
                </TableCell>
              )}
              <TableCell className={cn(!isCheckbox && "pl-5")}>
                <div className="flex items-center gap-2 text-[13px]">
                  <FolderIcon
                    className="h-4 w-4 text-blue-400"
                    strokeWidth={1.75}
                  />
                  <span data-name className="font-medium break-all line-clamp-2">{folder.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">
                &mdash;
              </TableCell>
              <TableCell />
              <TableCell className="text-[13px] text-muted-foreground">
                {formatDate(folder.updated_at)}
              </TableCell>
            </TableRow>
          );
        })}

        {files.map((file) => {
          const isSelected = selectedIds.has(file.id);
          const isFocused = focusedId === file.id;
          return (
            <TableRow
              key={`file-${file.id}`}
              data-id={file.id}
              className={cn(
                "cursor-pointer select-none",
                isSelected && "bg-primary/5",
                isFocused && "ring-1 ring-inset ring-primary/60",
                isCut(file.id) && "opacity-40",
              )}
              draggable
              onDragStart={(e) => handleDragStart(e, file.id)}
              onClick={(e) => handleRowClick(e, file.id, "file")}
              onDoubleClick={() => handleDoubleClick(file.id, "file")}
              onContextMenu={(e) => onFileContextMenu(e, file.id)}
            >
              {isCheckbox && (
                <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelected(file.id)}
                    aria-label={`Select ${file.name}`}
                  />
                </TableCell>
              )}
              <TableCell className={cn(!isCheckbox && "pl-5")}>
                <div className="flex items-center gap-2 text-[13px]">
                  {(() => {
                    const { icon: Icon, color } = getFileIcon(file.mime_type);
                    return <Icon className={cn("h-4 w-4", color)} strokeWidth={1.75} />;
                  })()}
                  <span data-name className="break-all line-clamp-2">{file.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">
                {formatBytes(file.size_bytes)}
              </TableCell>
              <TableCell>
                <FileStatusBadge status={file.status} />
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">
                {formatDate(file.updated_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
