"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DataResponse, Profile } from "@/types/models";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<DataResponse<Profile>>("/auth/profile"),
    select: (res) => res.data,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { full_name?: string }) =>
      api.patch<DataResponse<Profile>>("/auth/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });
}
