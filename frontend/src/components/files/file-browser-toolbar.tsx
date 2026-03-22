"use client";

import { useState } from "react";
import {
  ArrowDown01,
  ArrowDownAZ,
  ArrowLeft,
  ArrowUp01,
  ArrowUpZA,
  Calendar,
  Check,
  ChevronDown,
  FolderPlus,
  FolderUp,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Breadcrumbs } from "@/components/files/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFileBrowserStore } from "@/stores/file-browser-store";

interface BreadcrumbEntry {
  id: string;
  name: string;
}

interface FileBrowserToolbarProps {
  breadcrumbs: BreadcrumbEntry[];
  onNavigate: (folderId: string | null) => void;
  onGoBack: () => void;
  canGoBack: boolean;
  onCreateFolder: () => void;
  onUploadClick: () => void;
  onUploadFolderClick: () => void;
  onBulkDelete: () => void;
  onBulkReprocess: () => void;
  selectionHasOnlyFiles: boolean;
  selectionHasReprocessable: boolean;
  onDropItems?: (itemIds: string[], targetFolderId: string | null) => void;
}

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "size_bytes", label: "Size" },
  { value: "updated_at", label: "Date" },
] as const;

function SortDirectionIcon({ sortBy, sortDir }: { sortBy: string; sortDir: "asc" | "desc" }) {
  const isAsc = sortDir === "asc";
  if (sortBy === "name") {
    return isAsc ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpZA className="h-3.5 w-3.5" />;
  }
  if (sortBy === "size_bytes") {
    return isAsc ? <ArrowDown01 className="h-3.5 w-3.5" /> : <ArrowUp01 className="h-3.5 w-3.5" />;
  }
  return isAsc ? <Calendar className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />;
}

export function FileBrowserToolbar({
  breadcrumbs,
  onNavigate,
  onGoBack,
  canGoBack,
  onCreateFolder,
  onUploadClick,
  onUploadFolderClick,
  onBulkDelete,
  onBulkReprocess,
  selectionHasOnlyFiles,
  selectionHasReprocessable,
  onDropItems,
}: FileBrowserToolbarProps) {
  const {
    selectedIds,
    clearSelection,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    sortBy,
    setSortBy,
    sortDir,
    toggleSortDir,
  } = useFileBrowserStore();
  const hasSelection = selectedIds.size > 0;
  const [sortOpen, setSortOpen] = useState(false);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Name";

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--overlay-6)] px-5">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0", !canGoBack && "invisible")}
          onClick={onGoBack}
          aria-label="Go back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Breadcrumbs breadcrumbs={breadcrumbs} onNavigate={onNavigate} onDropItems={onDropItems} />
      </div>

      <div className="flex items-center gap-1.5">
        {hasSelection ? (
          <>
            <span className="mr-2 text-[12px] text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-7 text-[12px]"
            >
              Clear
            </Button>
            {selectionHasOnlyFiles && selectionHasReprocessable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkReprocess}
                className="h-7 text-[12px]"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Reprocess
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBulkDelete}
              className="h-7 text-[12px] text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        ) : (
          <>
            {searchOpen ? (
              <div className="flex items-center gap-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="h-7 w-48 text-[12px]"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            )}
            {/* Sort dropdown */}
            <div className="flex items-center">
              <Popover open={sortOpen} onOpenChange={setSortOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="flex h-7 items-center gap-1 rounded-md border border-[var(--overlay-8)] px-2 text-[12px] text-foreground transition-colors hover:bg-[var(--overlay-4)]"
                    aria-label="Sort by"
                  >
                    {currentSortLabel}
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[140px] p-1" align="end">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setSortOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-[12px] transition-colors hover:bg-accent",
                        sortBy === opt.value
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {opt.label}
                      {sortBy === opt.value && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <button
                onClick={toggleSortDir}
                className="ml-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--overlay-4)] hover:text-foreground"
                aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
              >
                <SortDirectionIcon sortBy={sortBy} sortDir={sortDir} />
              </button>
            </div>
            {/* View mode toggle */}
            <div className="mr-1 flex items-center rounded-md border border-[var(--overlay-8)]">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "rounded-l-md p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-r-md p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCreateFolder}
              className="h-7 text-[12px]"
            >
              <FolderPlus className="mr-1 h-3.5 w-3.5" />
              New folder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUploadClick}
              className="h-7 text-[12px]"
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUploadFolderClick}
              className="h-7 text-[12px]"
            >
              <FolderUp className="mr-1 h-3.5 w-3.5" />
              Upload folder
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
