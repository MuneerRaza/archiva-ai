"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ImageViewerProps {
  url: string;
  alt: string;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 0.25;
const SCROLL_ZOOM_FACTOR = 0.001;

export function ImageViewer({ url, alt }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const clampScale = useCallback((s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)), []);

  const zoomIn = useCallback(() => setScale((s) => clampScale(s + ZOOM_STEP)), [clampScale]);
  const zoomOut = useCallback(() => setScale((s) => clampScale(s - ZOOM_STEP)), [clampScale]);
  const rotateCW = useCallback(() => setRotation((r) => (r + 90) % 360), []);
  const rotateCCW = useCallback(() => setRotation((r) => (r - 90 + 360) % 360), []);

  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Ctrl+scroll zoom toward cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const rect = container!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;

      setScale((prevScale) => {
        const delta = -e.deltaY * SCROLL_ZOOM_FACTOR;
        const newScale = clampScale(prevScale * (1 + delta));
        const scaleFactor = newScale / prevScale;

        setPosition((prev) => ({
          x: cursorX - scaleFactor * (cursorX - prev.x),
          y: cursorY - scaleFactor * (cursorY - prev.y),
        }));

        return newScale;
      });
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [clampScale]);

  // Click-drag pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Don't pan when clicking toolbar buttons
      if ((e.target as HTMLElement).closest("button")) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      posStart.current = { ...position };
    },
    [position],
  );

  useEffect(() => {
    if (!isPanning) return;

    function handleMouseMove(e: MouseEvent) {
      setPosition({
        x: posStart.current.x + (e.clientX - panStart.current.x),
        y: posStart.current.y + (e.clientY - panStart.current.y),
      });
    }

    function handleMouseUp() {
      setIsPanning(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  // Keyboard zoom: Ctrl+Plus, Ctrl+Minus, Ctrl+0
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setScale((s) => clampScale(s + ZOOM_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((s) => clampScale(s - ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        resetView();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clampScale, resetView]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-[var(--overlay-6)] px-4 py-2">
        <Button variant="ghost" size="sm" onClick={zoomOut} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-[13px] text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="sm" onClick={zoomIn} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-[var(--overlay-8)]" />
        <Button variant="ghost" size="sm" onClick={rotateCCW} aria-label="Rotate counter-clockwise">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={rotateCW} aria-label="Rotate clockwise">
          <RotateCw className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-[var(--overlay-8)]" />
        <Button variant="ghost" size="sm" onClick={resetView} aria-label="Reset view">
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex h-full w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            draggable={false}
            className="max-w-none select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
