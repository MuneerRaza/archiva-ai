"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DragSelectRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseDragSelectOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onSelectionChange: (selectedIds: string[]) => void;
  enabled?: boolean;
}

function rectsOverlap(a: DOMRect, b: DragSelectRect): boolean {
  return !(
    a.right < b.x ||
    a.left > b.x + b.width ||
    a.bottom < b.y ||
    a.top > b.y + b.height
  );
}

interface DragSelectResult {
  rect: DragSelectRect | null;
  justDraggedRef: React.RefObject<boolean>;
}

export function useDragSelect({ containerRef, onSelectionChange, enabled = true }: UseDragSelectOptions): DragSelectResult {
  const [rect, setRect] = useState<DragSelectRect | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const justDraggedRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      justDraggedRef.current = false;
      // Only start drag on left mouse button
      if (e.button !== 0) return;
      // Don't start drag on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest("[data-id]") || target.closest("button") || target.closest("input") || target.closest("a")) {
        return;
      }
      startPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = false;
    },
    [enabled],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!startPos.current) return;

      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      // Require minimum drag distance to start
      if (!isDragging.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isDragging.current = true;

      const x = Math.min(e.clientX, startPos.current.x);
      const y = Math.min(e.clientY, startPos.current.y);
      const width = Math.abs(dx);
      const height = Math.abs(dy);

      setRect({ x, y, width, height });

      // Find overlapping items
      if (!containerRef.current) return;
      const items = containerRef.current.querySelectorAll("[data-id]");
      const selected: string[] = [];
      const dragRect = { x, y, width, height };

      items.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        if (rectsOverlap(itemRect, dragRect)) {
          const id = item.getAttribute("data-id");
          if (id) selected.push(id);
        }
      });

      onSelectionChange(selected);
    },
    [containerRef, onSelectionChange],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      justDraggedRef.current = true;
    }
    startPos.current = null;
    isDragging.current = false;
    setRect(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, enabled, handleMouseDown, handleMouseMove, handleMouseUp]);

  return { rect, justDraggedRef };
}
