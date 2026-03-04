"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  Home,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api";
import { getFileIcon } from "@/lib/file-icons";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";
import type { FileItem, Folder } from "@/types/models";

// ── Constants ──────────────────────────────────────────────────────────────
const INDENT_PX = 16;
const GUIDE_LEFT_BASE = 14;
const NAV_FILE_LIMIT = 100;

interface FolderNavigatorProps {
  workspaceId: string;
}

interface TreeNode {
  folder: Folder;
  children: TreeNode[];
}

interface BrowseResponse {
  files: FileItem[];
  folders: Folder[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

// ── Tree building helpers ──────────────────────────────────────────────────

function buildTree(folders: Folder[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const f of folders) {
    map.set(f.id, { folder: f, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.folder.name.localeCompare(b.folder.name));
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);

  return roots;
}

function getAncestorIds(folders: Folder[], targetId: string | null): Set<string> {
  if (!targetId) return new Set();
  const parentMap = new Map<string, string | null>();
  for (const f of folders) {
    parentMap.set(f.id, f.parent_id);
  }
  const ancestors = new Set<string>();
  let current = parentMap.get(targetId) ?? null;
  while (current) {
    ancestors.add(current);
    current = parentMap.get(current) ?? null;
  }
  return ancestors;
}

// ── Paginated file fetching hook ───────────────────────────────────────────

interface NavFilesState {
  files: FileItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
}

function useNavFiles(workspaceId: string, folderId: string | null, enabled: boolean): NavFilesState {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  // Reset when folder changes or disabled
  useEffect(() => {
    setFiles([]);
    setTotal(0);
    setHasMore(false);
    setOffset(0);
  }, [folderId, workspaceId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setIsLoading(true);

    const folderParam = folderId ? `&folder_id=${folderId}` : "";
    api
      .get<BrowseResponse>(
        `/workspaces/${workspaceId}/browse?sort_by=name&sort_dir=asc&limit=${NAV_FILE_LIMIT}&offset=0${folderParam}`,
      )
      .then((data) => {
        if (cancelled || !mountedRef.current) return;
        const fetched = data.files ?? [];
        setFiles(fetched);
        setTotal(data.pagination?.total ?? fetched.length);
        setHasMore(data.pagination?.has_more ?? false);
        setOffset(fetched.length);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [workspaceId, folderId, enabled]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const folderParam = folderId ? `&folder_id=${folderId}` : "";
    api
      .get<BrowseResponse>(
        `/workspaces/${workspaceId}/browse?sort_by=name&sort_dir=asc&limit=${NAV_FILE_LIMIT}&offset=${offset}${folderParam}`,
      )
      .then((data) => {
        if (!mountedRef.current) return;
        const fetched = data.files ?? [];
        setFiles((prev) => [...prev, ...fetched]);
        setHasMore(data.pagination?.has_more ?? false);
        setOffset((prev) => prev + fetched.length);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [workspaceId, folderId, offset, isLoading, hasMore]);

  return { files, total, hasMore, isLoading, loadMore };
}

// ── Indent guides ──────────────────────────────────────────────────────────

function IndentGuides({ guides }: { guides: boolean[] }) {
  return (
    <>
      {guides.map((active, d) =>
        active ? (
          <span
            key={d}
            className="pointer-events-none absolute top-0 h-full bg-[var(--overlay-8)]"
            style={{ left: `${GUIDE_LEFT_BASE + d * INDENT_PX}px`, width: "1px" }}
          />
        ) : null,
      )}
    </>
  );
}

function TreeConnector({ depth, isLast }: { depth: number; isLast: boolean }) {
  const left = GUIDE_LEFT_BASE + depth * INDENT_PX;
  return (
    <>
      <span
        className="pointer-events-none absolute top-1/2 h-px bg-[var(--overlay-8)]"
        style={{ left: `${left}px`, width: "8px" }}
      />
      <span
        className={cn(
          "pointer-events-none absolute bg-[var(--overlay-8)]",
          isLast ? "top-0 h-1/2" : "top-0 h-full",
        )}
        style={{ left: `${left}px`, width: "1px" }}
      />
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function FolderNavigator({ workspaceId }: FolderNavigatorProps) {
  const contextLocation = useChatStore((s) => s.contextLocation);
  const setContextLocation = useChatStore((s) => s.setContextLocation);
  const setContextManuallySet = useChatStore((s) => s.setContextManuallySet);
  const addContextSystemMessage = useChatStore((s) => s.addContextSystemMessage);

  const { data: folders, refetch, isFetching: isLoading } = useQuery({
    queryKey: ["all-folders", workspaceId],
    queryFn: () =>
      api.get<Folder[]>(`/workspaces/${workspaceId}/folders`),
  });

  const tree = useMemo(
    () => (folders ? buildTree(folders) : []),
    [folders],
  );

  const selectedFolderId = contextLocation?.type === "folder"
    ? contextLocation.id
    : null;
  const selectedFileId = contextLocation?.type === "file"
    ? contextLocation.id
    : null;

  const expandedAncestors = useMemo(
    () => (folders && selectedFolderId ? getAncestorIds(folders, selectedFolderId) : new Set<string>()),
    [folders, selectedFolderId],
  );

  const handleSelectRoot = useCallback(() => {
    setContextLocation({ type: "workspace", id: null }, "home");
    setContextManuallySet(true);
    addContextSystemMessage("home");
  }, [setContextLocation, setContextManuallySet, addContextSystemMessage]);

  const handleSelectFolder = useCallback(
    (folder: Folder) => {
      setContextLocation({ type: "folder", id: folder.id }, folder.name);
      setContextManuallySet(true);
      addContextSystemMessage(folder.name);
    },
    [setContextLocation, setContextManuallySet, addContextSystemMessage],
  );

  const handleSelectFile = useCallback(
    (file: FileItem) => {
      setContextLocation({ type: "file", id: file.id }, file.name);
      setContextManuallySet(true);
      addContextSystemMessage(file.name);
    },
    [setContextLocation, setContextManuallySet, addContextSystemMessage],
  );

  const isRoot = !contextLocation || contextLocation.type === "workspace";

  const rootNav = useNavFiles(workspaceId, null, true);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
        <FolderClosed className="h-3.5 w-3.5" />
        <span>Navigator</span>
        <div className="flex-1" />
        <button
          onClick={() => refetch()}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          title="Refresh"
          aria-label="Refresh navigator"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1 pb-2 scrollbar-thin">
        {/* Home root node */}
        <button
          onClick={handleSelectRoot}
          className={cn(
            "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors",
            isRoot
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
          )}
        >
          <Home className={cn("h-3.5 w-3.5 shrink-0", isRoot ? "text-primary" : "text-blue-400")} />
          <span className="font-medium">Home</span>
        </button>

        {/* Root children — files first, then folders */}
        {rootNav.files.map((file, i) => {
          const isLastFile = i === rootNav.files.length - 1;
          const isLast = isLastFile && !rootNav.hasMore && tree.length === 0;
          return (
            <FileNodeItem
              key={file.id}
              file={file}
              depth={0}
              isSelected={file.id === selectedFileId}
              onSelect={handleSelectFile}
              isLast={isLast}
              guides={[]}
            />
          );
        })}

        {rootNav.hasMore && (
          <LoadMoreItem
            remaining={rootNav.total - rootNav.files.length}
            isLoading={rootNav.isLoading}
            onLoadMore={rootNav.loadMore}
            depth={0}
            isLast={tree.length === 0}
            guides={[]}
          />
        )}

        {tree.map((node, i) => (
          <TreeNodeItem
            key={node.folder.id}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
            selectedFileId={selectedFileId}
            onSelectFolder={handleSelectFolder}
            onSelectFile={handleSelectFile}
            expandedAncestors={expandedAncestors}
            workspaceId={workspaceId}
            isLast={i === tree.length - 1}
            guides={[]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tree node (folder) ─────────────────────────────────────────────────────

function TreeNodeItem({
  node,
  depth,
  selectedFolderId,
  selectedFileId,
  onSelectFolder,
  onSelectFile,
  expandedAncestors,
  workspaceId,
  isLast,
  guides,
}: {
  node: TreeNode;
  depth: number;
  selectedFolderId: string | null;
  selectedFileId: string | null;
  onSelectFolder: (folder: Folder) => void;
  onSelectFile: (file: FileItem) => void;
  expandedAncestors: Set<string>;
  workspaceId: string;
  isLast: boolean;
  guides: boolean[];
}) {
  const isSelected = node.folder.id === selectedFolderId;
  const [expanded, setExpanded] = useState(
    expandedAncestors.has(node.folder.id) || isSelected,
  );

  const navFiles = useNavFiles(workspaceId, node.folder.id, expanded);

  const handleClick = useCallback(() => {
    onSelectFolder(node.folder);
    setExpanded((e) => !e);
  }, [node.folder, onSelectFolder]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    [],
  );

  const Icon = expanded ? FolderOpen : FolderClosed;
  const padLeft = INDENT_PX * depth + 24;
  const childGuides = [...guides, !isLast];

  return (
    <>
      {/* Folder row */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className={cn(
          "relative flex w-full items-center gap-1 rounded py-[3px] text-left text-xs transition-colors cursor-pointer",
          isSelected
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
        )}
        style={{ paddingLeft: `${padLeft}px` }}
      >
        <IndentGuides guides={guides} />
        <TreeConnector depth={depth} isLast={isLast} />

        <button
          onClick={handleToggle}
          className="flex h-4 w-4 shrink-0 items-center justify-center"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        </button>
        <Icon className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
        <span className="truncate">{node.folder.name}</span>
      </div>

      {/* Children */}
      {expanded && (
        <>
          {node.children.map((child, i) => {
            const isChildLast = i === node.children.length - 1 && navFiles.files.length === 0 && !navFiles.hasMore;
            return (
              <TreeNodeItem
                key={child.folder.id}
                node={child}
                depth={depth + 1}
                selectedFolderId={selectedFolderId}
                selectedFileId={selectedFileId}
                onSelectFolder={onSelectFolder}
                onSelectFile={onSelectFile}
                expandedAncestors={expandedAncestors}
                workspaceId={workspaceId}
                isLast={isChildLast}
                guides={childGuides}
              />
            );
          })}
          {navFiles.files.map((file, i) => {
            const isLastFile = i === navFiles.files.length - 1;
            const isFileLast = isLastFile && !navFiles.hasMore;
            return (
              <FileNodeItem
                key={file.id}
                file={file}
                depth={depth + 1}
                isSelected={file.id === selectedFileId}
                onSelect={onSelectFile}
                isLast={isFileLast}
                guides={childGuides}
              />
            );
          })}
          {navFiles.hasMore && (
            <LoadMoreItem
              remaining={navFiles.total - navFiles.files.length}
              isLoading={navFiles.isLoading}
              onLoadMore={navFiles.loadMore}
              depth={depth + 1}
              isLast
              guides={childGuides}
            />
          )}
        </>
      )}
    </>
  );
}

// ── File node ──────────────────────────────────────────────────────────────

function FileNodeItem({
  file,
  depth,
  isSelected,
  onSelect,
  isLast,
  guides,
}: {
  file: FileItem;
  depth: number;
  isSelected: boolean;
  onSelect: (file: FileItem) => void;
  isLast: boolean;
  guides: boolean[];
}) {
  const iconInfo = getFileIcon(file.mime_type);
  const padLeft = INDENT_PX * depth + 28;

  return (
    <div className="relative">
      <IndentGuides guides={guides} />
      <TreeConnector depth={depth} isLast={isLast} />
      <button
        onClick={() => onSelect(file)}
        className={cn(
          "relative flex w-full items-center gap-1.5 rounded py-[3px] text-left text-xs transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
        )}
        style={{ paddingLeft: `${padLeft}px` }}
      >
        <iconInfo.icon className={cn("h-3 w-3 shrink-0", iconInfo.color)} />
        <span className="truncate">{file.name}</span>
      </button>
    </div>
  );
}

// ── Load more button ───────────────────────────────────────────────────────

function LoadMoreItem({
  remaining,
  isLoading: loading,
  onLoadMore,
  depth,
  isLast,
  guides,
}: {
  remaining: number;
  isLoading: boolean;
  onLoadMore: () => void;
  depth: number;
  isLast: boolean;
  guides: boolean[];
}) {
  const padLeft = INDENT_PX * depth + 28;

  return (
    <div className="relative">
      <IndentGuides guides={guides} />
      <TreeConnector depth={depth} isLast={isLast} />
      <button
        onClick={onLoadMore}
        disabled={loading}
        className="relative flex w-full items-center gap-1.5 rounded py-[3px] text-left text-[10px] text-muted-foreground/70 transition-colors hover:text-muted-foreground disabled:opacity-50"
        style={{ paddingLeft: `${padLeft}px` }}
      >
        {loading ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <ChevronDown className="h-2.5 w-2.5" />
        )}
        <span>{remaining} more file{remaining !== 1 ? "s" : ""}...</span>
      </button>
    </div>
  );
}
