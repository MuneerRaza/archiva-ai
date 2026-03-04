"use client";

import { useEffect } from "react";

interface KeyboardShortcutsConfig {
  onDelete?: () => void;
  onSelectAll?: () => void;
  onEscape?: () => void;
  onNewFolder?: () => void;
  onFocusSearch?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onArrowUp?: (shift: boolean, ctrl: boolean) => void;
  onArrowDown?: (shift: boolean, ctrl: boolean) => void;
  onArrowLeft?: (shift: boolean, ctrl: boolean) => void;
  onArrowRight?: (shift: boolean, ctrl: boolean) => void;
  onSpace?: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        config.onEscape?.();
        return;
      }

      // Don't trigger shortcuts when typing in inputs (except Escape)
      if (isInput) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        config.onArrowUp?.(e.shiftKey, e.ctrlKey || e.metaKey);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        config.onArrowDown?.(e.shiftKey, e.ctrlKey || e.metaKey);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        config.onArrowLeft?.(e.shiftKey, e.ctrlKey || e.metaKey);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        config.onArrowRight?.(e.shiftKey, e.ctrlKey || e.metaKey);
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        config.onSpace?.();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        config.onDelete?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        config.onSelectAll?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        config.onNewFolder?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault();
        config.onCut?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        config.onCopy?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        config.onPaste?.();
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        config.onFocusSearch?.();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [config]);
}
