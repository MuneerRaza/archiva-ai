"use client";

import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";

import { useUIStore } from "@/stores/ui-store";

export function ChatToggleFab() {
  const { chatPanelOpen, setChatPanelOpen } = useUIStore();
  const pathname = usePathname();

  // Only show on browse page: /app/{workspaceId} (no sub-path)
  const isBrowsePage = /\/app\/[^/]+\/?$/.test(pathname);

  if (chatPanelOpen || !isBrowsePage) return null;

  return (
    <button
      onClick={() => setChatPanelOpen(true)}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      aria-label="Open agent"
    >
      <Bot className="h-5 w-5" />
    </button>
  );
}
