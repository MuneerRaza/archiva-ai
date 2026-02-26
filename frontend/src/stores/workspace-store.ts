import { create } from "zustand";
import type { Workspace } from "@/types/models";

interface WorkspaceState {
  current: Workspace | null;
  workspaces: Workspace[];
  setCurrent: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  current: null,
  workspaces: [],
  setCurrent: (current) => set({ current }),
  setWorkspaces: (workspaces) => set({ workspaces }),
}));
