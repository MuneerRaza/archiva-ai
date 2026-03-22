import { create } from "zustand";

export type FolderUploadPhase = "idle" | "creating-folders" | "uploading" | "done";

interface UploadState {
  folderPhase: FolderUploadPhase;
  total: number;
  done: number;
  failed: number;
  foldersTotal: number;
  foldersDone: number;
  abortController: AbortController | null;
}

interface UploadActions {
  startFolderUpload: (fileCount: number, folderCount: number) => void;
  setPhase: (phase: FolderUploadPhase) => void;
  onFolderCreated: () => void;
  onFileUploaded: () => void;
  onFileFailed: () => void;
  cancelFolderUpload: () => void;
  reset: () => void;
}

const initialState: UploadState = {
  folderPhase: "idle",
  total: 0,
  done: 0,
  failed: 0,
  foldersTotal: 0,
  foldersDone: 0,
  abortController: null,
};

export const useUploadStore = create<UploadState & UploadActions>((set, get) => ({
  ...initialState,

  startFolderUpload: (fileCount, folderCount) =>
    set({
      folderPhase: "creating-folders",
      total: fileCount,
      done: 0,
      failed: 0,
      foldersTotal: folderCount,
      foldersDone: 0,
      abortController: new AbortController(),
    }),

  setPhase: (phase) => set({ folderPhase: phase }),

  onFolderCreated: () => set((s) => ({ foldersDone: s.foldersDone + 1 })),

  onFileUploaded: () => set((s) => ({ done: s.done + 1 })),

  onFileFailed: () => set((s) => ({ failed: s.failed + 1 })),

  cancelFolderUpload: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ ...initialState });
  },

  reset: () => set({ ...initialState }),
}));
