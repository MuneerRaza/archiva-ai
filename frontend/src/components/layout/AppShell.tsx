"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatToggleFab } from "@/components/chat/chat-toggle-fab";
import { UploadProgress } from "@/components/files/upload-progress";
import { useChatContextSync } from "@/hooks/use-chat-context-sync";
import { useProcessingEvents } from "@/hooks/use-processing-events";
import { useStoreHydrated } from "@/hooks/use-store-hydration";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  workspaceId: string;
  children: ReactNode;
}


export function AppShell({ workspaceId, children }: AppShellProps) {
  useProcessingEvents(workspaceId);
  useChatContextSync();
  const hydrated = useStoreHydrated();

  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const { chatPanelOpen, chatPanelFullscreen, setChatPanelOpen, setChatPanelFullscreen } = useUIStore();

  // Close chat panel when navigating away from browse
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      if (chatPanelOpen) {
        setChatPanelOpen(false);
        setChatPanelFullscreen(false);
      }
    }
  }, [pathname, chatPanelOpen, setChatPanelOpen, setChatPanelFullscreen]);

  const mainHidden = chatPanelOpen && chatPanelFullscreen;

  if (!hydrated) {
    return <div className="h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar workspaceId={workspaceId} />
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[width] duration-200",
          mainHidden && "w-0 flex-none overflow-hidden",
        )}
      >
        {children}
      </main>
      <ChatPanel workspaceId={workspaceId} />
      <ChatToggleFab />
      <UploadProgress workspaceId={workspaceId} />
    </div>
  );
}
