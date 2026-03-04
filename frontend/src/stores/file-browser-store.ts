import { create } from "zustand";
import { persist } from "zustand/middleware";

type ViewMode = "list" | "grid";

interface BreadcrumbEntry {
  id: string;
  name: string;
}

interface ClipboardState {
  ids: string[];
  operation: "cut" | "copy";
}

interface FileBrowserState {
  currentFolderId: string | null;
  breadcrumbs: BreadcrumbEntry[];
  selectedIds: Set<string>;
  lastClickedId: string | null;
  focusedId: string | null;
  sortBy: string;
  sortDir: "asc" | "desc";
  viewMode: ViewMode;
  folderViewModes: Record<string, ViewMode>;
  selectionMode: "windows" | "checkbox";
  searchQuery: string;
  searchOpen: boolean;
  clipboard: ClipboardState | null;
  navigateToFolder: (folderId: string, folderName: string) => void;
  navigateToRoot: () => void;
  navigateToBreadcrumb: (folderId: string | null) => void;
  selectSingle: (id: string) => void;
  toggleSelected: (id: string) => void;
  rangeSelect: (targetId: string, allIds: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  moveFocus: (direction: "up" | "down" | "left" | "right", allIds: string[], shift: boolean, ctrl: boolean, columns?: number) => void;
  toggleFocused: () => void;
  setSortBy: (field: string) => void;
  toggleSortDir: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectionMode: (mode: "windows" | "checkbox") => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  cut: () => void;
  copy: () => void;
  clearClipboard: () => void;
}

export const useFileBrowserStore = create<FileBrowserState>()(
  persist(
    (set, get) => ({
  currentFolderId: null,
  breadcrumbs: [],
  selectedIds: new Set(),
  lastClickedId: null,
  focusedId: null,
  sortBy: "name",
  sortDir: "asc",
  viewMode: "list" as ViewMode,
  folderViewModes: {} as Record<string, ViewMode>,
  selectionMode: "windows" as "windows" | "checkbox",
  searchQuery: "",
  searchOpen: false,
  clipboard: null,

  navigateToFolder: (folderId, folderName) =>
    set((state) => {
      const savedViewMode = state.folderViewModes[folderId];
      return {
        currentFolderId: folderId,
        breadcrumbs: [...state.breadcrumbs, { id: folderId, name: folderName }],
        selectedIds: new Set(),
        lastClickedId: null,
        focusedId: null,
        ...(savedViewMode ? { viewMode: savedViewMode } : {}),
      };
    }),

  navigateToRoot: () =>
    set((state) => {
      const savedViewMode = state.folderViewModes["root"];
      return {
        currentFolderId: null,
        breadcrumbs: [],
        selectedIds: new Set(),
        lastClickedId: null,
        focusedId: null,
        ...(savedViewMode ? { viewMode: savedViewMode } : {}),
      };
    }),

  navigateToBreadcrumb: (folderId) =>
    set((state) => {
      if (folderId === null) {
        const savedViewMode = state.folderViewModes["root"];
        return {
          currentFolderId: null,
          breadcrumbs: [],
          selectedIds: new Set(),
          lastClickedId: null,
        focusedId: null,
          ...(savedViewMode ? { viewMode: savedViewMode } : {}),
        };
      }
      const idx = state.breadcrumbs.findIndex((b) => b.id === folderId);
      if (idx === -1) return state;
      const savedViewMode = state.folderViewModes[folderId];
      return {
        currentFolderId: folderId,
        breadcrumbs: state.breadcrumbs.slice(0, idx + 1),
        selectedIds: new Set(),
        lastClickedId: null,
        focusedId: null,
        ...(savedViewMode ? { viewMode: savedViewMode } : {}),
      };
    }),

  selectSingle: (id) =>
    set({ selectedIds: new Set([id]), lastClickedId: id, focusedId: id }),

  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next, lastClickedId: id, focusedId: id };
    }),

  rangeSelect: (targetId, allIds) =>
    set((state) => {
      const lastIdx = state.lastClickedId ? allIds.indexOf(state.lastClickedId) : -1;
      const targetIdx = allIds.indexOf(targetId);
      if (lastIdx === -1 || targetIdx === -1) {
        return { selectedIds: new Set([targetId]), lastClickedId: targetId };
      }
      const start = Math.min(lastIdx, targetIdx);
      const end = Math.max(lastIdx, targetIdx);
      const rangeIds = allIds.slice(start, end + 1);
      const next = new Set(state.selectedIds);
      for (const rid of rangeIds) {
        next.add(rid);
      }
      return { selectedIds: next, lastClickedId: targetId };
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set(), lastClickedId: null, focusedId: null }),

  isSelected: (id) => get().selectedIds.has(id),

  moveFocus: (direction, allIds, shift, ctrl, columns = 1) =>
    set((state) => {
      if (allIds.length === 0) return state;
      const currentIdx = state.focusedId ? allIds.indexOf(state.focusedId) : -1;
      let nextIdx: number;
      const step = (direction === "up" || direction === "down") ? columns : 1;
      if (currentIdx === -1) {
        nextIdx = (direction === "down" || direction === "right") ? 0 : allIds.length - 1;
      } else if (direction === "down" || direction === "right") {
        nextIdx = Math.min(currentIdx + step, allIds.length - 1);
      } else {
        nextIdx = Math.max(currentIdx - step, 0);
      }
      const nextId = allIds[nextIdx];

      if (ctrl) {
        // Ctrl+Arrow: move focus only, don't change selection
        return { focusedId: nextId };
      }

      if (shift) {
        // Shift+Arrow: extend selection from anchor to focused
        const anchorIdx = state.lastClickedId ? allIds.indexOf(state.lastClickedId) : nextIdx;
        const start = Math.min(anchorIdx, nextIdx);
        const end = Math.max(anchorIdx, nextIdx);
        const rangeIds = allIds.slice(start, end + 1);
        return { selectedIds: new Set(rangeIds), focusedId: nextId };
      }

      // Plain arrow: move focus and select single
      return { selectedIds: new Set([nextId]), lastClickedId: nextId, focusedId: nextId };
    }),

  toggleFocused: () =>
    set((state) => {
      if (!state.focusedId) return state;
      const next = new Set(state.selectedIds);
      if (next.has(state.focusedId)) {
        next.delete(state.focusedId);
      } else {
        next.add(state.focusedId);
      }
      return { selectedIds: next, lastClickedId: state.focusedId };
    }),

  setSortBy: (field) =>
    set((state) => ({
      sortBy: field,
      sortDir: state.sortBy === field && state.sortDir === "asc" ? "desc" : "asc",
    })),

  toggleSortDir: () =>
    set((state) => ({
      sortDir: state.sortDir === "asc" ? "desc" : "asc",
    })),

  setViewMode: (mode) =>
    set((state) => {
      const key = state.currentFolderId ?? "root";
      return {
        viewMode: mode,
        folderViewModes: { ...state.folderViewModes, [key]: mode },
      };
    }),

  setSelectionMode: (mode) => set({ selectionMode: mode }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchOpen: (open) => set({ searchOpen: open }),

  cut: () =>
    set((state) => {
      if (state.selectedIds.size === 0) return state;
      return { clipboard: { ids: Array.from(state.selectedIds), operation: "cut" as const } };
    }),

  copy: () =>
    set((state) => {
      if (state.selectedIds.size === 0) return state;
      return { clipboard: { ids: Array.from(state.selectedIds), operation: "copy" as const } };
    }),

  clearClipboard: () => set({ clipboard: null }),
    }),
    {
      name: "archiva-file-browser",
      partialize: (state) => ({
        viewMode: state.viewMode,
        folderViewModes: state.folderViewModes,
        selectionMode: state.selectionMode,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        currentFolderId: state.currentFolderId,
        breadcrumbs: state.breadcrumbs,
      }),
    },
  ),
);
