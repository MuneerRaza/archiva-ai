"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateFolderDialog } from "@/components/files/create-folder-dialog";
import { EmptyState } from "@/components/files/empty-state";
import { FileContextMenu } from "@/components/files/file-context-menu";
import { FileBrowserToolbar } from "@/components/files/file-browser-toolbar";
import { BulkReprocessDialog, ReprocessDialog, getStepsForFile } from "@/components/files/reprocess-dialog";
import { FileGrid } from "@/components/files/file-grid";
import { FileTable } from "@/components/files/file-table";
import { RenameDialog } from "@/components/files/rename-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDragSelect } from "@/hooks/use-drag-select";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useBrowse } from "@/lib/queries/browse";
import { useBulkDeleteFiles, useDeleteFile, useMoveFiles, useUploadFile } from "@/lib/queries/files";
import { useDeleteFolder } from "@/lib/queries/folders";
import { useWorkspace } from "@/lib/queries/workspaces";
import { useFileBrowserStore } from "@/stores/file-browser-store";

/** Count how many columns the CSS grid has by checking the first row of children. */
function getGridColumns(container: HTMLElement | null): number {
  if (!container) return 1;
  const grid = container.querySelector(".grid");
  if (!grid) return 1;
  const children = grid.children;
  if (children.length === 0) return 1;
  const firstTop = (children[0] as HTMLElement).offsetTop;
  let cols = 1;
  for (let i = 1; i < children.length; i++) {
    if ((children[i] as HTMLElement).offsetTop !== firstTop) break;
    cols++;
  }
  return cols;
}

interface FileBrowserProps {
  workspaceId: string;
}

export function FileBrowser({ workspaceId }: FileBrowserProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    currentFolderId,
    breadcrumbs,
    navigateToFolder,
    navigateToBreadcrumb,
    sortBy,
    sortDir,
    selectedIds,
    clearSelection,
    viewMode,
    searchQuery,
    selectAll,
    setSearchQuery,
    setSearchOpen,
    cut,
    copy,
    clipboard,
    clearClipboard,
    moveFocus,
    toggleFocused,
  } = useFileBrowserStore();

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkReprocessOpen, setBulkReprocessOpen] = useState(false);

  // Lifted rename state (Fix 2)
  const [renameTarget, setRenameTarget] = useState<{
    type: "file" | "folder";
    id: string;
    currentName: string;
  } | null>(null);

  // Lifted single-item delete state (Fix 2)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "file" | "folder";
    id: string;
  } | null>(null);

  const [reprocessTarget, setReprocessTarget] = useState<{
    id: string;
    name: string;
    mime_type: string;
  } | null>(null);

  const [contextMenuState, setContextMenuState] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const browseQuery = useBrowse(workspaceId, currentFolderId, sortBy, sortDir);
  const { data: workspace } = useWorkspace(workspaceId);
  const ingestion = workspace?.settings?.ingestion;
  const uploadFile = useUploadFile(workspaceId);
  const bulkDelete = useBulkDeleteFiles(workspaceId);
  const deleteFile = useDeleteFile(workspaceId);
  const deleteFolder = useDeleteFolder(workspaceId);
  const moveFiles = useMoveFiles(workspaceId);
  const rawFolders = browseQuery.data?.folders ?? [];
  const rawFiles = browseQuery.data?.files ?? [];

  const { folders, files } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { folders: rawFolders, files: rawFiles };
    }
    const q = searchQuery.toLowerCase();
    return {
      folders: rawFolders.filter((f) => f.name.toLowerCase().includes(q)),
      files: rawFiles.filter((f) => f.name.toLowerCase().includes(q)),
    };
  }, [rawFolders, rawFiles, searchQuery]);

  // All item IDs in display order (folders first, then files)
  const allItemIds = useMemo(
    () => [...folders.map((f) => f.id), ...files.map((f) => f.id)],
    [folders, files],
  );

  const isLoading = browseQuery.isLoading;
  const isEmpty = folders.length === 0 && files.length === 0;

  const handleDragSelection = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        clearSelection();
      } else {
        selectAll(ids);
      }
    },
    [clearSelection, selectAll],
  );

  const { rect: dragRect, justDraggedRef } = useDragSelect({
    containerRef: contentAreaRef,
    onSelectionChange: handleDragSelection,
    enabled: !isEmpty && !isLoading,
  });

  useKeyboardShortcuts({
    onDelete: () => {
      if (selectedIds.size > 0) setBulkDeleteOpen(true);
    },
    onSelectAll: () => {
      selectAll(allItemIds);
    },
    onEscape: () => {
      clearSelection();
      setSearchQuery("");
      setSearchOpen(false);
    },
    onNewFolder: () => setCreateFolderOpen(true),
    onFocusSearch: () => setSearchOpen(true),
    onCut: () => {
      if (selectedIds.size > 0) cut();
    },
    onCopy: () => {
      if (selectedIds.size > 0) copy();
    },
    onPaste: () => {
      if (!clipboard) return;
      if (clipboard.operation === "cut") {
        moveFiles.mutate(
          { fileIds: clipboard.ids, targetFolderId: currentFolderId },
          {
            onSuccess: () => {
              clearClipboard();
              clearSelection();
            },
          },
        );
      }
      // Copy-paste (duplicate) not implemented yet — would need a backend endpoint
    },
    onArrowDown: (shift, ctrl) => {
      const cols = viewMode === "grid" ? getGridColumns(contentAreaRef.current) : 1;
      moveFocus("down", allItemIds, shift, ctrl, cols);
    },
    onArrowUp: (shift, ctrl) => {
      const cols = viewMode === "grid" ? getGridColumns(contentAreaRef.current) : 1;
      moveFocus("up", allItemIds, shift, ctrl, cols);
    },
    onArrowLeft: (shift, ctrl) => {
      moveFocus("left", allItemIds, shift, ctrl);
    },
    onArrowRight: (shift, ctrl) => {
      moveFocus("right", allItemIds, shift, ctrl);
    },
    onSpace: () => {
      toggleFocused();
    },
  });

  const handleNavigate = useCallback(
    (folderId: string, folderName: string) => {
      navigateToFolder(folderId, folderName);
    },
    [navigateToFolder],
  );

  function handleFileOpen(fileId: string) {
    router.push(`/app/${workspaceId}/file/${fileId}`);
  }

  function handleMoveToFolder(itemIds: string[], targetFolderId: string) {
    moveFiles.mutate(
      { fileIds: itemIds, targetFolderId },
      { onSuccess: () => clearSelection() },
    );
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList) return;

    for (const file of Array.from(fileList)) {
      uploadFile.mutate({ file, folderId: currentFolderId });
    }
    e.target.value = "";
  }

  function handleBulkDeleteClick() {
    if (selectedIds.size === 0) return;
    setBulkDeleteOpen(true);
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedIds);
    const folderIdSet = new Set(folders.map((f) => f.id));
    const folderIds = ids.filter((id) => folderIdSet.has(id));
    const fileIds = ids.filter((id) => !folderIdSet.has(id));

    // Delete folders individually (cascade deletes their contents on backend)
    for (const fid of folderIds) {
      deleteFolder.mutate(fid);
    }
    // Bulk delete files
    if (fileIds.length > 0) {
      bulkDelete.mutate(fileIds);
    }

    clearSelection();
    setBulkDeleteOpen(false);
  }

  const bulkReprocessFiles = useMemo(() => {
    const folderIdSet = new Set(folders.map((f) => f.id));
    return Array.from(selectedIds)
      .filter((id) => !folderIdSet.has(id))
      .map((id) => {
        const f = files.find((file) => file.id === id);
        return { id, name: f?.name ?? "", mime_type: f?.mime_type ?? "" };
      });
  }, [selectedIds, folders, files]);

  function handleSingleDeleteConfirm() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "file") {
      deleteFile.mutate(deleteTarget.id);
    } else {
      deleteFolder.mutate(deleteTarget.id);
    }
    setDeleteTarget(null);
  }

  function handleFileContextMenu(e: React.MouseEvent, fileId: string) {
    e.preventDefault();
    const file = files.find((f) => f.id === fileId);
    setContextMenuState({
      type: "file",
      id: fileId,
      name: file?.name ?? "",
      x: e.clientX,
      y: e.clientY,
    });
  }

  function handleFolderContextMenu(e: React.MouseEvent, folderId: string) {
    e.preventDefault();
    const folder = folders.find((f) => f.id === folderId);
    setContextMenuState({
      type: "folder",
      id: folderId,
      name: folder?.name ?? "",
      x: e.clientX,
      y: e.clientY,
    });
  }

  function handleBackgroundClick(e: React.MouseEvent) {
    // Deselect when clicking empty area (not on a file/folder item)
    const target = e.target as HTMLElement;
    if (target.closest("[data-id]")) return;
    // Skip clear if a drag-select just finished
    if (justDraggedRef.current) return;
    clearSelection();
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <FileBrowserToolbar
        breadcrumbs={breadcrumbs}
        onNavigate={navigateToBreadcrumb}
        onGoBack={() => {
          if (breadcrumbs.length > 1) {
            navigateToBreadcrumb(breadcrumbs[breadcrumbs.length - 2].id);
          } else {
            navigateToBreadcrumb(null);
          }
        }}
        canGoBack={currentFolderId !== null}
        onCreateFolder={() => setCreateFolderOpen(true)}
        onUploadClick={handleUploadClick}
        onBulkDelete={handleBulkDeleteClick}
        onBulkReprocess={() => setBulkReprocessOpen(true)}
        selectionHasOnlyFiles={selectedIds.size > 0 && Array.from(selectedIds).every((id) => !folders.some((f) => f.id === id))}
        selectionHasReprocessable={
          selectedIds.size > 0 &&
          !!ingestion &&
          Array.from(selectedIds).some((id) => {
            const file = files.find((f) => f.id === id);
            return file ? getStepsForFile(ingestion, file.mime_type, file.name).length > 0 : false;
          })
        }
        onDropItems={(itemIds, targetFolderId) => {
          moveFiles.mutate(
            { fileIds: itemIds, targetFolderId },
            { onSuccess: () => clearSelection() },
          );
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {isLoading || !hydrated ? (
        !hydrated || viewMode === "list" ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-lg" />
            ))}
          </div>
        )
      ) : isEmpty ? (
        <EmptyState isRoot={currentFolderId === null} />
      ) : (
        <ScrollArea className="flex-1" onClick={handleBackgroundClick}>
          <div ref={contentAreaRef} className="relative" style={{ minHeight: "calc(100vh - 120px)" }}>
            {viewMode === "grid" ? (
              <FileGrid
                folders={folders}
                files={files}
                allItemIds={allItemIds}
                onFolderOpen={(id) => {
                  const folder = folders.find((f) => f.id === id);
                  if (folder) handleNavigate(id, folder.name);
                }}
                onFileOpen={handleFileOpen}
                onFileContextMenu={handleFileContextMenu}
                onFolderContextMenu={handleFolderContextMenu}
                onMoveToFolder={handleMoveToFolder}
              />
            ) : (
              <FileTable
                folders={folders}
                files={files}
                allItemIds={allItemIds}
                onFolderOpen={(id) => {
                  const folder = folders.find((f) => f.id === id);
                  if (folder) handleNavigate(id, folder.name);
                }}
                onFileOpen={handleFileOpen}
                onFileContextMenu={handleFileContextMenu}
                onFolderContextMenu={handleFolderContextMenu}
                onMoveToFolder={handleMoveToFolder}
              />
            )}
          </div>
        </ScrollArea>
      )}

      {/* Rubber band selection overlay */}
      {dragRect && (
        <div
          className="pointer-events-none fixed z-50 border border-primary/60 bg-primary/10"
          style={{
            left: dragRect.x,
            top: dragRect.y,
            width: dragRect.width,
            height: dragRect.height,
          }}
        />
      )}

      <CreateFolderDialog
        workspaceId={workspaceId}
        parentId={currentFolderId}
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
      />

      {contextMenuState && (
        <FileContextMenu
          workspaceId={workspaceId}
          type={contextMenuState.type}
          targetId={contextMenuState.id}
          targetName={contextMenuState.name}
          position={{ x: contextMenuState.x, y: contextMenuState.y }}
          onClose={() => setContextMenuState(null)}
          onRename={(type, id, currentName) => setRenameTarget({ type, id, currentName })}
          onDelete={(type, id) => setDeleteTarget({ type, id })}
          onReprocess={
            contextMenuState.type === "file" &&
            ingestion &&
            getStepsForFile(
              ingestion,
              files.find((f) => f.id === contextMenuState.id)?.mime_type ?? "",
              contextMenuState.name,
            ).length > 0
              ? (fileId) => {
                  const file = files.find((f) => f.id === fileId);
                  setReprocessTarget({ id: fileId, name: file?.name ?? "", mime_type: file?.mime_type ?? "" });
                }
              : undefined
          }
        />
      )}

      {/* Rename dialog — rendered in parent so it persists after context menu closes */}
      {renameTarget && (
        <RenameDialog
          workspaceId={workspaceId}
          type={renameTarget.type}
          targetId={renameTarget.id}
          currentName={renameTarget.currentName}
          open={true}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
        />
      )}

      {/* Reprocess dialog */}
      {reprocessTarget && (
        <ReprocessDialog
          workspaceId={workspaceId}
          fileId={reprocessTarget.id}
          fileName={reprocessTarget.name}
          mimeType={reprocessTarget.mime_type}
          open={true}
          onOpenChange={(open) => {
            if (!open) setReprocessTarget(null);
          }}
        />
      )}

      {/* Single-item delete from context menu */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.type ?? "item"}?`}
        description={`This will permanently delete this ${deleteTarget?.type ?? "item"}. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleSingleDeleteConfirm}
      />

      {/* Bulk reprocess */}
      <BulkReprocessDialog
        workspaceId={workspaceId}
        files={bulkReprocessFiles}
        open={bulkReprocessOpen}
        onOpenChange={setBulkReprocessOpen}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected items?"
        description={`This will permanently delete ${selectedIds.size} item(s). This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
}
