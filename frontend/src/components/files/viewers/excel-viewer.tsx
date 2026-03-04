"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ExcelViewerProps {
  url: string;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export function ExcelViewer({ url }: ExcelViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const buffer = await res.arrayBuffer();

        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });

        const parsed: SheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const json = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: "",
          });

          if (json.length === 0) {
            return { name, headers: [], rows: [] };
          }

          const headers = json[0].map((h) => String(h));
          const rows = json.slice(1, 1000).map((row) =>
            row.map((cell) => String(cell ?? "")),
          );

          return { name, headers, rows };
        });

        if (!cancelled) {
          setSheets(parsed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load spreadsheet");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Empty workbook
      </div>
    );
  }

  const current = sheets[activeSheet];

  return (
    <div className="flex h-full flex-col">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--overlay-6)] bg-background px-2 py-1 overflow-x-auto">
          {sheets.map((sheet, i) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(i)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap",
                i === activeSheet
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {current.headers.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Empty sheet
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--overlay-6)]">
                  <TableHead className="w-12 text-center text-[11px] text-muted-foreground/40 font-normal">
                    #
                  </TableHead>
                  {current.headers.map((h, i) => (
                    <TableHead
                      key={i}
                      className="text-[12px] font-semibold whitespace-nowrap"
                    >
                      {h || `Col ${i + 1}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.rows.map((row, ri) => (
                  <TableRow key={ri} className="border-[var(--overlay-4)]">
                    <TableCell className="text-center text-[11px] text-muted-foreground/30 tabular-nums">
                      {ri + 1}
                    </TableCell>
                    {row.map((cell, ci) => (
                      <TableCell
                        key={ci}
                        className="text-[12px] whitespace-nowrap max-w-[300px] truncate"
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      )}

      {/* Footer stats */}
      <div className="flex shrink-0 items-center gap-3 border-t border-[var(--overlay-6)] px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground/50">
          {current.rows.length} row{current.rows.length !== 1 ? "s" : ""} · {current.headers.length} column{current.headers.length !== 1 ? "s" : ""}
        </span>
        {sheets.length > 1 && (
          <span className="text-[11px] text-muted-foreground/40">
            Sheet {activeSheet + 1} of {sheets.length}
          </span>
        )}
      </div>
    </div>
  );
}
