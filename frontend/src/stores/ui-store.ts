import { create } from "zustand";
import { persist } from "zustand/middleware";

const DETAIL_PANE_MIN = 260;
const DETAIL_PANE_MAX = 480;
const DETAIL_PANE_DEFAULT = 300;

const CHAT_PANEL_MIN = 380;
const CHAT_PANEL_MAX = 700;
const CHAT_PANEL_DEFAULT = 440;

type AccentColor = "default" | "blue" | "purple" | "teal" | "green" | "orange" | "rose" | "red" | "yellow";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  detailPaneOpen: boolean;
  detailPaneWidth: number;
  toggleDetailPane: () => void;
  setDetailPaneWidth: (width: number) => void;

  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;

  chatPanelOpen: boolean;
  chatPanelFullscreen: boolean;
  chatPanelWidth: number;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setChatPanelFullscreen: (fullscreen: boolean) => void;
  setChatPanelWidth: (width: number) => void;
}

function syncAccentToDOM(color: AccentColor) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (color === "default") {
    el.removeAttribute("data-accent");
  } else {
    el.setAttribute("data-accent", color);
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      detailPaneOpen: false,
      detailPaneWidth: DETAIL_PANE_DEFAULT,
      toggleDetailPane: () => set((s) => ({ detailPaneOpen: !s.detailPaneOpen })),
      setDetailPaneWidth: (width) =>
        set({ detailPaneWidth: Math.max(DETAIL_PANE_MIN, Math.min(DETAIL_PANE_MAX, width)) }),

      accentColor: "default" as AccentColor,
      setAccentColor: (color) => {
        syncAccentToDOM(color);
        set({ accentColor: color });
      },

      chatPanelOpen: false,
      chatPanelFullscreen: false,
      chatPanelWidth: CHAT_PANEL_DEFAULT,
      toggleChatPanel: () =>
        set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
      setChatPanelFullscreen: (fullscreen) =>
        set({ chatPanelFullscreen: fullscreen }),
      setChatPanelWidth: (width) =>
        set({
          chatPanelWidth: Math.max(
            CHAT_PANEL_MIN,
            Math.min(CHAT_PANEL_MAX, width),
          ),
        }),
    }),
    {
      name: "archiva-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        detailPaneOpen: state.detailPaneOpen,
        detailPaneWidth: state.detailPaneWidth,
        chatPanelOpen: state.chatPanelOpen,
        chatPanelFullscreen: state.chatPanelFullscreen,
        chatPanelWidth: state.chatPanelWidth,
        accentColor: state.accentColor,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncAccentToDOM(state.accentColor);
        }
      },
    },
  ),
);

export type { AccentColor };
export { DETAIL_PANE_MIN, DETAIL_PANE_MAX, CHAT_PANEL_MIN, CHAT_PANEL_MAX };
