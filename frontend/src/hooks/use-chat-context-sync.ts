"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useChatStore } from "@/stores/chat-store";
import { useFileBrowserStore } from "@/stores/file-browser-store";

/**
 * Syncs the chat store's contextLocation based on current route:
 * - Browse pages: follows currentFolderId from file-browser-store
 * - File detail pages: sets context to that file
 * - Other pages: defaults to workspace root
 *
 * Respects contextManuallySet — if the user explicitly picked a context
 * via the folder navigator, auto-sync won't override it.
 */
export function useChatContextSync() {
  const pathname = usePathname();
  const currentFolderId = useFileBrowserStore((s) => s.currentFolderId);
  const breadcrumbs = useFileBrowserStore((s) => s.breadcrumbs);

  useEffect(() => {
    const store = useChatStore.getState();

    // If context was manually set via navigator, don't auto-sync
    if (store.contextManuallySet) return;

    // Match file detail page: /app/{workspaceId}/file/{fileId}
    const fileMatch = /\/app\/[^/]+\/file\/([^/]+)/.exec(pathname);
    if (fileMatch) {
      const fileId = fileMatch[1];
      if (
        store.contextLocation?.type !== "file" ||
        store.contextLocation.id !== fileId
      ) {
        store.setContextLocation({ type: "file", id: fileId });
      }
      return;
    }

    // Match browse page (workspace root): /app/{workspaceId} (no sub-path or trailing slash only)
    const isBrowsePage = /\/app\/[^/]+\/?$/.test(pathname);
    if (isBrowsePage) {
      if (currentFolderId) {
        if (
          store.contextLocation?.type !== "folder" ||
          store.contextLocation.id !== currentFolderId
        ) {
          // Use breadcrumb name if available
          const folderName = breadcrumbs.length > 0
            ? breadcrumbs[breadcrumbs.length - 1].name
            : undefined;
          store.setContextLocation(
            { type: "folder", id: currentFolderId },
            folderName,
          );
        }
      } else {
        if (store.contextLocation?.type !== "workspace") {
          store.setContextLocation({ type: "workspace", id: null }, "home");
        }
      }
      return;
    }

    // All other pages: default to workspace root
    if (store.contextLocation?.type !== "workspace") {
      store.setContextLocation({ type: "workspace", id: null }, "home");
    }
  }, [pathname, currentFolderId, breadcrumbs]);
}
