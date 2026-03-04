"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Lightbulb, Square } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ThinkingCapabilities } from "@/types/models";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  thinkingCapabilities?: ThinkingCapabilities;
  thinkingBudget?: string;
  onSetThinkingBudget?: (level: string) => void;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder,
  thinkingEnabled,
  onToggleThinking,
  thinkingCapabilities,
  thinkingBudget,
  onSetThinkingBudget,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mode = thinkingCapabilities?.mode ?? "none";
  const budgetLevels = thinkingCapabilities?.budget_levels ?? [];
  const showThinking = mode !== "none";
  const isAlwaysBudget = mode === "always_budget";

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    setIsMultiline(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) return;
        handleSend();
      }
    },
    [handleSend, isStreaming],
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${newHeight}px`;
    // Single line height is ~38px (text-sm + py-3). Multiline if scrollHeight > 48
    setIsMultiline(el.scrollHeight > 48);
  }, []);

  // Sync multiline state when value is cleared externally
  useEffect(() => {
    if (!value) setIsMultiline(false);
  }, [value]);

  const handleBulbClick = useCallback(() => {
    if (isAlwaysBudget) return;
    onToggleThinking?.();
  }, [isAlwaysBudget, onToggleThinking]);

  const isLit = isAlwaysBudget || thinkingEnabled;
  const hasBudgetDropdown = (mode === "budget" || mode === "always_budget") && budgetLevels.length > 0;
  const showDropdown = hasBudgetDropdown && (isAlwaysBudget || thinkingEnabled);

  // Not configured state
  if (disabled && placeholder) {
    return (
      <div className="border-t border-[var(--overlay-6)] bg-background px-4 py-3">
        <p className="text-center text-xs text-muted-foreground/60">{placeholder}</p>
      </div>
    );
  }

  const thinkingControl = showThinking ? (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleBulbClick}
        className={cn(
          "flex h-7 items-center justify-center rounded-full border transition-colors",
          showDropdown ? "w-7 rounded-r-none border-r-0" : "w-7",
          isLit
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-[var(--overlay-8)] bg-[var(--overlay-6)] text-muted-foreground hover:border-foreground/20 hover:text-foreground",
          isAlwaysBudget && "cursor-default",
        )}
        title={
          isAlwaysBudget
            ? `Thinking: always on (${thinkingBudget ?? "medium"})`
            : `Thinking: ${isLit ? "ON" : "OFF"}`
        }
        aria-label={`Thinking: ${isLit ? "ON" : "OFF"}`}
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </button>

      {showDropdown && (
        <Popover open={budgetOpen} onOpenChange={setBudgetOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex h-7 w-5 items-center justify-center rounded-r-full border transition-colors",
                isLit
                  ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
                  : "border-[var(--overlay-8)] bg-[var(--overlay-6)] text-muted-foreground",
              )}
              aria-label="Select thinking budget"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            className="w-32 p-1"
            sideOffset={8}
          >
            {budgetLevels.map((level) => (
              <button
                key={level}
                onClick={() => {
                  onSetThinkingBudget?.(level);
                  setBudgetOpen(false);
                }}
                className={cn(
                  "flex w-full items-center rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  thinkingBudget === level
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
                )}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  ) : null;

  const sendButton = (
    <div>
      {isStreaming ? (
        <button
          onClick={onStop}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/80"
          aria-label="Stop generating"
        >
          <Square className="h-3 w-3" fill="currentColor" />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            value.trim() && !disabled
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-[var(--overlay-6)] text-muted-foreground",
          )}
          aria-label="Send message"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="border-t border-[var(--overlay-6)] bg-background px-4 pb-3 pt-2">
      <div className="overflow-hidden rounded-xl border border-[var(--overlay-8)] bg-[var(--overlay-4)] transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
        {/* Textarea area */}
        <div className="relative flex items-end">
          {/* Inline thinking control — single line only */}
          {!isMultiline && thinkingControl && (
            <div className="shrink-0 pb-2.5 pl-3">
              {thinkingControl}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Ask about your documents..."}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent py-3 pr-3 text-sm",
              !isMultiline && thinkingControl ? "pl-2" : "pl-4",
              "placeholder:text-muted-foreground focus:outline-none",
              "disabled:opacity-50",
              "scrollbar-thin",
            )}
          />
          {/* Inline send button — single line only */}
          {!isMultiline && (
            <div className="shrink-0 pb-2.5 pr-3">
              {sendButton}
            </div>
          )}
        </div>

        {/* Bottom bar — multiline only: controls drop below */}
        {isMultiline && (
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div>{thinkingControl}</div>
            {sendButton}
          </div>
        )}
      </div>
    </div>
  );
}
