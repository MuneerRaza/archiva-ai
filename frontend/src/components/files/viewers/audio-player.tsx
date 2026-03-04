"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  url: string;
  mimeType: string;
  fileName?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({ url, mimeType, fileName }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceCreatedRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      initVisualizer();
    } else {
      a.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  const cycleSpeed = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const idx = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    a.playbackRate = next;
    setSpeed(next);
  }, [speed]);

  const skipBack = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, a.currentTime - 10);
  }, []);

  const skipForward = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.min(a.duration, a.currentTime + 10);
  }, []);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * a.duration;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const val = parseFloat(e.target.value);
    a.volume = val;
    setVolume(val);
    if (val === 0) {
      a.muted = true;
      setMuted(true);
    } else if (a.muted) {
      a.muted = false;
      setMuted(false);
    }
  }

  // Audio visualizer
  function initVisualizer() {
    if (sourceCreatedRef.current || !audioRef.current || !canvasRef.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      sourceCreatedRef.current = true;
      drawVisualizer();
    } catch {
      // AudioContext not available — skip visualization
    }
  }

  function drawVisualizer() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      animFrameRef.current = requestAnimationFrame(draw);
      if (!ctx || !canvas || !analyser) return;

      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barWidth = (w / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * h * 0.8;
        const hue = 220 + (i / bufferLength) * 40;
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
        ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    }

    draw();
  }

  // Resize canvas to match container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(a.currentTime);
    const onDurationChange = () => setDuration(a.duration);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("durationchange", onDurationChange);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("durationchange", onDurationChange);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          skipForward();
          break;
        case "m":
          toggleMute();
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay, toggleMute, skipBack, skipForward]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <audio ref={audioRef} crossOrigin="anonymous">
        <source src={url} type={mimeType} />
      </audio>

      {/* Visualization area — fills available space */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-[var(--overlay-2)]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
        />
        {!playing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Music className="h-12 w-12 text-muted-foreground/20" />
            {fileName && (
              <p className="max-w-[400px] truncate text-sm text-muted-foreground/40">
                {fileName}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Controls area — fixed at bottom */}
      <div className="shrink-0 border-t border-[var(--overlay-6)] bg-background px-6 pb-5 pt-4">
        {/* Progress bar */}
        <div
          className="group h-1.5 cursor-pointer rounded-full bg-white/10"
          onClick={seek}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground/50">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {/* Speed */}
          <button
            onClick={cycleSpeed}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
          >
            {speed}x
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={skipBack}
            title="Back 10s"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={togglePlay}
          >
            {playing ? (
              <Pause className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={skipForward}
            title="Forward 10s"
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleMute}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-1 w-20 cursor-pointer accent-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
