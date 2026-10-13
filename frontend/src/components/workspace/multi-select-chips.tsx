"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CatalogOption } from "@/lib/pii-catalog";

interface MultiSelectChipsProps {
  label: string;
  options: CatalogOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/** Chips for the current selection + a searchable checkbox dropdown to add/remove.
 *  Selection is constrained to `options` — no free text. */
export function MultiSelectChips({
  label,
  options,
  selected,
  onChange,
}: MultiSelectChipsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const labelFor = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return (v: string) => map.get(v) ?? v;
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  return (
    <div className="space-y-2">
      <Label className="text-[12px]">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--overlay-4)] px-2 py-0.5 text-[11px]"
          >
            {labelFor(v)}
            <button
              onClick={() => toggle(v)}
              className="text-muted-foreground/60 hover:text-destructive"
              aria-label={`Remove ${labelFor(v)}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-[11px] text-muted-foreground/50">None</span>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]">
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="border-b border-[var(--overlay-6)] p-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="h-7 text-[12px]"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-[12px] text-muted-foreground/60">
                  No matches
                </p>
              )}
              {filtered.map((o) => {
                const checked = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] hover:bg-[var(--overlay-3)]"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="flex-1">{o.label}</span>
                    {checked && <Check className="h-3 w-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Local Label to avoid an extra import cycle; matches the shadcn Label styling.
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("font-medium text-foreground", className)}>{children}</p>;
}
