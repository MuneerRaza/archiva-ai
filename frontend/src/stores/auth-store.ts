"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  workspaceId: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setWorkspaceId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  workspaceId: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setWorkspaceId: (workspaceId) => set({ workspaceId }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, workspaceId: null, isLoading: false }),
}));
