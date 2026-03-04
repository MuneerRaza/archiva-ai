"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Calendar,
  Download,
  FileText,
  Globe,
  HardDrive,
  Hash,
  Info,
  Layers,
  List,
  Mic,
  Tag,
  Trash2,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileStatusBadge } from "@/components/files/file-status-badge";
import { TagManager } from "@/components/files/tag-manager";
import { useClearArtifacts } from "@/lib/queries/file-detail";
import type { FileDetail } from "@/types/models";
import type { NavigateTarget } from "@/components/files/file-detail-view";

interface FileDetailSidebarProps {
  detail: FileDetail;
  downloadUrl: string;
  onNavigate?: (target: NavigateTarget) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FileDetailSidebar({ detail, downloadUrl, onNavigate }: FileDetailSidebarProps) {
  const { file, content, tags } = detail;
  const [activeTab, setActiveTab] = useState("info");
  const clearArtifacts = useClearArtifacts(file.workspace_id, file.id);

  const hasSummary = !!content?.summary;
  const hasStructure = !!content?.structure;
  const hasOverview = !!content?.overview;
  const isAudioVideo = file.mime_type.startsWith("audio/") || file.mime_type.startsWith("video/");
  const hasTranscript = isAudioVideo && !!content?.raw_text;

  // Build tab list dynamically — only show tabs with data
  const tabs: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: "info", label: "Info", icon: <Info className="h-3 w-3" /> },
  ];
  if (hasTranscript) {
    tabs.push({ value: "transcript", label: "Transcript", icon: <Mic className="h-3 w-3" /> });
  }
  if (hasSummary) {
    tabs.push({ value: "summary", label: "Summary", icon: <FileText className="h-3 w-3" /> });
  }
  if (hasStructure) {
    tabs.push({ value: "structure", label: "Structure", icon: <List className="h-3 w-3" /> });
  }

  // Fall back to "info" if active tab's data was cleared
  const resolvedTab = tabs.some((t) => t.value === activeTab) ? activeTab : "info";

  return (
    <aside className="flex h-full w-full flex-col bg-[var(--overlay-2)]">

      {/* Tabs */}
      <Tabs value={resolvedTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        {tabs.length > 1 && (
          <TabsList variant="line" className="w-full shrink-0 border-b border-[var(--overlay-6)] px-2">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {/* Info tab */}
        <TabsContent value="info" className="min-h-0 overflow-y-auto">
          {/* Status + Actions */}
          <div className="border-b border-[var(--overlay-6)] p-4">
            <div className="flex items-center justify-between">
              <FileStatusBadge status={file.status} />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.open(downloadUrl, "_blank")}
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* File info */}
          <div className="border-b border-[var(--overlay-6)] p-4 space-y-3">
            <SectionLabel>File Info</SectionLabel>
            <div className="space-y-2.5">
              <MetaRow icon={<Type className="h-3.5 w-3.5" />} label="Type" value={friendlyMimeType(file.mime_type)} />
              <MetaRow icon={<HardDrive className="h-3.5 w-3.5" />} label="Size" value={formatBytes(file.size_bytes)} />
              <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Uploaded" value={formatDate(file.created_at)} />
            </div>
          </div>

          {/* Content insights */}
          {content && (content.page_count != null || content.word_count != null || content.language) && (
            <div className="border-b border-[var(--overlay-6)] p-4 space-y-3">
              <SectionLabel>Content</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {content.page_count != null && (
                  <StatCard label="Pages" value={String(content.page_count)} icon={<Layers className="h-3.5 w-3.5" />} />
                )}
                {content.word_count != null && (
                  <StatCard label="Words" value={content.word_count.toLocaleString()} icon={<Hash className="h-3.5 w-3.5" />} />
                )}
                {content.language && (
                  <StatCard label="Language" value={content.language} icon={<Globe className="h-3.5 w-3.5" />} />
                )}
              </div>
            </div>
          )}

          {/* Overview */}
          {hasOverview && (
            <div className="border-b border-[var(--overlay-6)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Overview</SectionLabel>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                  onClick={() => clearArtifacts.mutate(["overview"])}
                  disabled={clearArtifacts.isPending}
                  title="Delete overview"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground/70">
                {content!.overview}
              </p>
            </div>
          )}

          {/* Tags */}
          <div className="p-4 space-y-3">
            <SectionLabel icon={<Tag className="h-3 w-3" />}>Tags</SectionLabel>
            <TagManager
              workspaceId={file.workspace_id}
              fileId={file.id}
              currentTags={tags}
            />
          </div>
        </TabsContent>

        {/* Transcript tab — plain text for audio/video */}
        {hasTranscript && (
          <TabsContent value="transcript" className="min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                onClick={() => clearArtifacts.mutate(["raw_text"])}
                disabled={clearArtifacts.isPending}
                title="Delete transcript"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-4 pt-2">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/70">
                {content!.raw_text}
              </p>
            </div>
          </TabsContent>
        )}

        {/* Summary tab — rendered as markdown */}
        {hasSummary && (
          <TabsContent value="summary" className="min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                onClick={() => clearArtifacts.mutate(["summary"])}
                disabled={clearArtifacts.isPending}
                title="Delete summary"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-4 pt-2 prose prose-invert prose-sm max-w-none prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-foreground/70 prose-headings:text-foreground/90 prose-strong:text-foreground/80 prose-li:text-[13px] prose-li:text-foreground/70">
              <Markdown remarkPlugins={[remarkGfm]}>{stripThinkingTags(content!.summary!)}</Markdown>
            </div>
          </TabsContent>
        )}

        {/* Structure tab — clickable navigation */}
        {hasStructure && (
          <TabsContent value="structure" className="min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Structure</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                onClick={() => clearArtifacts.mutate(["structure"])}
                disabled={clearArtifacts.isPending}
                title="Delete structure"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-4 pt-2">
              <StructureTree data={content!.structure!} onNavigate={onNavigate} />
            </div>
          </TabsContent>
        )}
      </Tabs>

    </aside>
  );
}

function stripThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, "")
    .trim();
}

/* ---------- Sub-components ---------- */

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-muted-foreground/60">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto truncate text-right text-foreground/90">{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--overlay-6)] bg-[var(--overlay-2)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-0.5 text-[15px] font-semibold text-foreground/90">{value}</p>
    </div>
  );
}

function friendlyMimeType(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "text/plain": "Plain Text",
    "text/markdown": "Markdown",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/msword": "DOC",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "image/svg+xml": "SVG",
    "audio/mpeg": "MP3",
    "video/mp4": "MP4",
  };
  return map[mime] ?? mime.split("/").pop()?.toUpperCase() ?? mime;
}

/* ---------- Structure tree ---------- */

interface StructureSection {
  title?: string;
  heading?: string;
  summary?: string;
  page?: number;
  anchor?: string;
  level?: number;
  children?: StructureSection[];
}

function StructureTree({ data, onNavigate }: { data: Record<string, unknown>; onNavigate?: (target: NavigateTarget) => void }) {
  if (Array.isArray((data as { sections?: unknown }).sections)) {
    const sections = (data as { sections: StructureSection[] }).sections;
    return (
      <ul className="space-y-0.5">
        {sections.map((section, i) => (
          <StructureNode key={i} section={section} depth={0} onNavigate={onNavigate} />
        ))}
      </ul>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/60">Empty structure</p>
    );
  }

  return (
    <pre className="text-xs text-foreground/60 whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StructureNode({ section, depth, onNavigate }: { section: StructureSection; depth: number; onNavigate?: (target: NavigateTarget) => void }) {
  const indent = depth * 16;
  const level = section.level ?? depth;
  const fontSize = level === 0 ? "text-[13px] font-medium" : "text-[12px]";
  const hasTarget = section.page != null || section.anchor != null;

  function handleClick() {
    if (!onNavigate || !hasTarget) return;
    const target: NavigateTarget = { _seq: Date.now() };
    if (section.page != null) target.page = section.page;
    if (section.anchor != null) target.anchor = section.anchor;
    onNavigate(target);
  }

  return (
    <li>
      <button
        type="button"
        className={`w-full text-left rounded px-2 py-1 transition-colors ${fontSize} ${
          hasTarget
            ? "hover:bg-[var(--overlay-4)] cursor-pointer text-foreground/80"
            : "cursor-default text-foreground/60"
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={handleClick}
      >
        {section.title ?? section.heading ?? "Untitled"}
        {section.page != null && (
          <span className="ml-2 text-[11px] text-muted-foreground/50">p.{section.page}</span>
        )}
      </button>
      {section.children && section.children.length > 0 && (
        <ul className="space-y-0.5">
          {section.children.map((child, i) => (
            <StructureNode key={i} section={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}
