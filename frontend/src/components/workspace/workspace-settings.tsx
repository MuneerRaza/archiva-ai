"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Cog,
  Cpu,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  ImageIcon,
  Info,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sun,
  Trash2,
  User,
  Wifi,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AIModelDialog } from "@/components/workspace/ai-model-dialog";
import { MultiSelectChips } from "@/components/workspace/multi-select-chips";
import { TEXT_ENTITY_OPTIONS, YOLO_CLASS_OPTIONS } from "@/lib/pii-catalog";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { cn } from "@/lib/utils";
import { useProfile, useUpdateProfile } from "@/lib/queries/auth";
import { useAIModels, useDeleteAIModel, useRefreshCapabilities } from "@/lib/queries/ai-models";
import {
  useWorkspace,
  useWorkspaces,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from "@/lib/queries/workspaces";
import { createClient } from "@/lib/supabase/client";
import { useFileBrowserStore } from "@/stores/file-browser-store";
import { useUIStore, type AccentColor } from "@/stores/ui-store";
import type {
  AIModel,
  IngestionSettings,
  Workspace,
  WorkspaceSettings as WorkspaceSettingsType,
} from "@/types/models";

interface WorkspaceSettingsProps {
  workspaceId: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama",
  vllm: "vLLM",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  groq: "Groq",
};

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
];

const DEFAULT_SETTINGS: WorkspaceSettingsType = {
  ingestion: {
    auto_ingest: true,
    reprocess_on_update: true,
    summary_model_id: null,
    overview_model_id: null,
    vision_model_id: null,
    transcription_model_id: null,
    language: "auto",
    summary_length: "medium",
    summary_instructions: "",
    generate_overview: true,
    document: { summary: true, structure: true, tables: true },
    text: { summary: true },
    spreadsheet: { summary: false },
    image: { description: false },
    audio: { transcription: false, summary: false },
    video: { transcription: false, description: false, summary: false },
    pii: {
      enabled: false,
      text_entities: [
        "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD",
        "US_SSN", "IBAN_CODE", "IP_ADDRESS", "LOCATION",
      ],
      audio_entities: ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION"],
      image_classes: ["person"],
      video_classes: ["person"],
      custom_regex: [],
    },
  },
  agent: {
    model_id: null,
    custom_instructions: "",
    language: "auto",
    thinking_enabled: false,
    thinking_budget: "medium",
  },
};

function mergeSettings(partial: Record<string, unknown>): WorkspaceSettingsType {
  const ing = (partial.ingestion ?? {}) as Record<string, unknown>;
  const agt = (partial.agent ?? {}) as Record<string, unknown>;

  // Strip legacy fields
  const { processing_llm: _p, ...ingClean } = ing as Record<string, unknown> & { processing_llm?: unknown };
  const { llm_provider: _lp, llm_model: _lm, llm_base_url: _lb, api_key: _ak, ...agtClean } = agt as Record<string, unknown> & { llm_provider?: unknown; llm_model?: unknown; llm_base_url?: unknown; api_key?: unknown };

  return {
    ingestion: {
      ...DEFAULT_SETTINGS.ingestion,
      ...ingClean,
      document: { ...DEFAULT_SETTINGS.ingestion.document, ...(ingClean.document as Record<string, unknown> ?? {}) },
      text: { ...DEFAULT_SETTINGS.ingestion.text, ...(ingClean.text as Record<string, unknown> ?? {}) },
      spreadsheet: { ...DEFAULT_SETTINGS.ingestion.spreadsheet, ...(ingClean.spreadsheet as Record<string, unknown> ?? {}) },
      image: { ...DEFAULT_SETTINGS.ingestion.image, ...(ingClean.image as Record<string, unknown> ?? {}) },
      audio: { ...DEFAULT_SETTINGS.ingestion.audio, ...(ingClean.audio as Record<string, unknown> ?? {}) },
      video: { ...DEFAULT_SETTINGS.ingestion.video, ...(ingClean.video as Record<string, unknown> ?? {}) },
      pii: { ...DEFAULT_SETTINGS.ingestion.pii, ...(ingClean.pii as Record<string, unknown> ?? {}) },
    },
    agent: { ...DEFAULT_SETTINGS.agent, ...agtClean },
  } as WorkspaceSettingsType;
}

type Section = "general" | "ai-models" | "ingestion" | "workspaces" | "account";

const NAV_ITEMS: { id: Section; label: string; icon: typeof Cog }[] = [
  { id: "general", label: "General", icon: Cog },
  { id: "ai-models", label: "AI Models", icon: Cpu },
  { id: "ingestion", label: "Ingestion", icon: Settings2 },
  { id: "workspaces", label: "Workspaces", icon: FolderOpen },
  { id: "account", label: "Account", icon: User },
];

const VALID_SECTIONS = new Set<string>(NAV_ITEMS.map((i) => i.id));

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const updateWorkspace = useUpdateWorkspace(workspaceId, { silent: true });
  const deleteWorkspace = useDeleteWorkspace(workspaceId);

  const tabParam = searchParams.get("tab") ?? "";
  const initialSection: Section = VALID_SECTIONS.has(tabParam) ? (tabParam as Section) : "general";
  const [section, setSection] = useState<Section>(initialSection);

  function changeSection(s: Section) {
    setSection(s);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", s);
    window.history.replaceState(null, "", url.toString());
  }
  const [settings, setSettings] = useState<WorkspaceSettingsType | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<WorkspaceSettingsType | null>(null);
  const settingsDirtyRef = useRef(false);
  const initializedRef = useRef(false);
  const updateRef = useRef(updateWorkspace);

  useEffect(() => {
    updateRef.current = updateWorkspace;
  }, [updateWorkspace]);

  useEffect(() => {
    if (workspace && !initializedRef.current) {
      initializedRef.current = true;
      const merged = mergeSettings(workspace.settings as unknown as Record<string, unknown>);
      setSettings(merged);
      settingsRef.current = merged;
    }
  }, [workspace]);

  const doAutoSave = useCallback(() => {
    setSaveStatus("saving");
    if (!settingsDirtyRef.current || !settingsRef.current) {
      setSaveStatus("idle");
      return;
    }

    updateRef.current.mutate({ settings: settingsRef.current } as Record<string, unknown>, {
      onSuccess: () => {
        settingsDirtyRef.current = false;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      },
      onError: () => {
        setSaveStatus("idle");
      },
    });
  }, []);

  function scheduleAutoSave() {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(doAutoSave, 1000);
  }

  function updateIngestion(patch: Partial<IngestionSettings>) {
    const current = settingsRef.current ?? settings;
    if (!current) return;
    const updated = {
      ...current,
      ingestion: { ...current.ingestion, ...patch },
    };
    setSettings(updated);
    settingsRef.current = updated;
    settingsDirtyRef.current = true;
    scheduleAutoSave();
  }

  function updateAgent<K extends keyof WorkspaceSettingsType["agent"]>(
    key: K,
    value: WorkspaceSettingsType["agent"][K],
  ) {
    const current = settingsRef.current ?? settings;
    if (!current) return;
    const updated = {
      ...current,
      agent: { ...current.agent, [key]: value },
    };
    setSettings(updated);
    settingsRef.current = updated;
    settingsDirtyRef.current = true;
    scheduleAutoSave();
  }

  if (isLoading || !settings) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--overlay-6)] px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Configure workspace processing and agent behavior.
          </p>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Body: side nav + content */}
      <div className="flex min-h-0 flex-1">
        {/* Side nav */}
        <nav className="w-[200px] shrink-0 overflow-y-auto border-r border-[var(--overlay-6)] py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => changeSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-[var(--overlay-3)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[var(--overlay-2)]">
          <div className="px-8 py-6">
            {section === "general" && <GeneralSection />}
            {section === "ai-models" && (
              <AIModelsSection
                settings={settings}
                updateIngestion={updateIngestion}
                updateAgent={updateAgent}
              />
            )}
            {section === "ingestion" && (
              <IngestionSection
                ingestion={settings.ingestion}
                updateIngestion={updateIngestion}
              />
            )}
            {section === "workspaces" && (
              <WorkspacesSection
                currentWorkspaceId={workspaceId}
                onDeleteCurrent={() => router.push("/app")}
              />
            )}
            {section === "account" && <AccountSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      {status === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-green-400" />
          Saved
        </>
      )}
    </span>
  );
}

function GeneralSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[15px] font-semibold">General</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          App preferences and display settings.
        </p>
      </div>

      <ThemeSetting />
      <AccentColorSetting />
      <SelectionModeSetting />
    </div>
  );
}

interface ThemeOption {
  value: string;
  label: string;
  group: "light" | "dark";
  bg: string;
  sidebar: string;
  border: string;
  fg: string;
  primary: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    group: "light",
    bg: "#f8f8fa",
    sidebar: "#f0f0f5",
    border: "#dddde5",
    fg: "#333",
    primary: "#5b5bf7",
  },
  {
    value: "solarized-light",
    label: "Solarized Light",
    group: "light",
    bg: "#fdf6e3",
    sidebar: "#f5efd7",
    border: "#ddd0a8",
    fg: "#555",
    primary: "#268bd2",
  },
  {
    value: "dark",
    label: "Dark",
    group: "dark",
    bg: "#1a1a1a",
    sidebar: "#242424",
    border: "#333",
    fg: "#aaa",
    primary: "#818cf8",
  },
  {
    value: "dim",
    label: "Dim",
    group: "dark",
    bg: "#282830",
    sidebar: "#2f2f38",
    border: "#3a3a44",
    fg: "#999",
    primary: "#6d9fff",
  },
  {
    value: "midnight",
    label: "Midnight",
    group: "dark",
    bg: "#1a1d2e",
    sidebar: "#222540",
    border: "#2d3050",
    fg: "#8888aa",
    primary: "#7c8df8",
  },
  {
    value: "monokai",
    label: "Monokai",
    group: "dark",
    bg: "#272718",
    sidebar: "#2d2d1e",
    border: "#3d3d28",
    fg: "#999880",
    primary: "#a6e22e",
  },
  {
    value: "nord",
    label: "Nord",
    group: "dark",
    bg: "#2e3440",
    sidebar: "#343b4a",
    border: "#3e4555",
    fg: "#7b88a0",
    primary: "#88c0d0",
  },
];

function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  const { accentColor } = useUIStore();
  const lightThemes = THEME_OPTIONS.filter((t) => t.group === "light");
  const darkThemes = THEME_OPTIONS.filter((t) => t.group === "dark");

  const accentSwatch = accentColor !== "default"
    ? ACCENT_COLORS.find((c) => c.value === accentColor)?.swatch
    : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-medium">Theme</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Choose the appearance for the interface.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Light</p>
        <div className="grid grid-cols-4 gap-2.5">
          {lightThemes.map((opt) => (
            <ThemeCard key={opt.value} opt={opt} active={theme === opt.value} onSelect={setTheme} accentOverride={accentSwatch} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Dark</p>
        <div className="grid grid-cols-4 gap-2.5">
          {darkThemes.map((opt) => (
            <ThemeCard key={opt.value} opt={opt} active={theme === opt.value} onSelect={setTheme} accentOverride={accentSwatch} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ opt, active, onSelect, accentOverride }: { opt: ThemeOption; active: boolean; onSelect: (v: string) => void; accentOverride?: string }) {
  const primary = accentOverride ?? opt.primary;
  return (
    <button
      onClick={() => onSelect(opt.value)}
      className={cn(
        "group rounded-lg border p-1.5 text-left transition-all",
        active
          ? "border-primary ring-1 ring-primary/30"
          : "border-[var(--overlay-8)] hover:border-[var(--overlay-15)]",
      )}
    >
      <div
        className="mb-1.5 flex h-[52px] overflow-hidden rounded-md"
        style={{ backgroundColor: opt.bg, boxShadow: `inset 0 0 0 1px ${opt.border}` }}
      >
        <div
          className="w-[28%]"
          style={{ backgroundColor: opt.sidebar, borderRight: `1px solid ${opt.border}` }}
        >
          <div className="flex flex-col gap-[3px] p-1.5 pt-2">
            <div className="h-[3px] w-full rounded-full" style={{ backgroundColor: primary, opacity: 0.9 }} />
            <div className="h-[3px] w-3/4 rounded-full" style={{ backgroundColor: opt.fg, opacity: 0.3 }} />
            <div className="h-[3px] w-4/5 rounded-full" style={{ backgroundColor: opt.fg, opacity: 0.3 }} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2 pt-2.5">
          <div className="h-[3px] w-3/4 rounded-full" style={{ backgroundColor: opt.fg, opacity: 0.5 }} />
          <div className="h-[3px] w-1/2 rounded-full" style={{ backgroundColor: opt.fg, opacity: 0.25 }} />
          <div className="mt-auto flex gap-1">
            <div className="h-[6px] w-[18px] rounded-sm" style={{ backgroundColor: primary }} />
            <div className="h-[6px] w-[14px] rounded-sm" style={{ backgroundColor: opt.fg, opacity: 0.15 }} />
          </div>
        </div>
      </div>
      <p className="px-0.5 text-[11px] font-medium">{opt.label}</p>
    </button>
  );
}

const ACCENT_COLORS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "default", label: "Theme default", swatch: "" },
  { value: "blue",    label: "Blue",          swatch: "oklch(0.60 0.20 265)" },
  { value: "purple",  label: "Purple",        swatch: "oklch(0.58 0.22 300)" },
  { value: "teal",    label: "Teal",          swatch: "oklch(0.58 0.14 195)" },
  { value: "green",   label: "Green",         swatch: "oklch(0.58 0.17 155)" },
  { value: "orange",  label: "Orange",        swatch: "oklch(0.65 0.18 55)" },
  { value: "rose",    label: "Rose",          swatch: "oklch(0.60 0.20 350)" },
  { value: "red",     label: "Red",           swatch: "oklch(0.58 0.22 25)" },
  { value: "yellow",  label: "Yellow",        swatch: "oklch(0.72 0.16 85)" },
];

function AccentColorSetting() {
  const { accentColor, setAccentColor } = useUIStore();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[14px] font-medium">Accent color</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Pick the primary color used for buttons, links, and highlights.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACCENT_COLORS.map((color) => {
          const active = accentColor === color.value;
          const isDefault = color.value === "default";
          return (
            <button
              key={color.value}
              onClick={() => setAccentColor(color.value)}
              title={color.label}
              className={cn(
                "group relative flex h-8 items-center gap-2 rounded-full border px-1 transition-all",
                active
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-[var(--overlay-8)] hover:border-[var(--overlay-15)]",
                isDefault ? "pr-3" : "w-8 justify-center",
              )}
            >
              {isDefault ? (
                <>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--overlay-6)]">
                    <div className="h-3 w-3 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-rose-400" />
                  </div>
                  <span className="text-[11px] font-medium">Auto</span>
                </>
              ) : (
                <div
                  className="h-5 w-5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: color.swatch }}
                />
              )}
              {active && !isDefault && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Models Section
// ---------------------------------------------------------------------------

function AIModelsSection({
  settings,
  updateIngestion,
  updateAgent,
}: {
  settings: WorkspaceSettingsType;
  updateIngestion: (patch: Partial<IngestionSettings>) => void;
  updateAgent: <K extends keyof WorkspaceSettingsType["agent"]>(
    key: K,
    value: WorkspaceSettingsType["agent"][K],
  ) => void;
}) {
  const { data: models, isLoading } = useAIModels();
  const deleteModel = useDeleteAIModel();
  const refreshCaps = useRefreshCapabilities();
  const [refreshingModelId, setRefreshingModelId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editModel, setEditModel] = useState<AIModel | undefined>();

  const llmModels = (models ?? []).filter((m) => m.model_type === "llm");
  const visionModels = llmModels.filter((m) => m.capabilities.includes("vision"));
  const transcriptionModels = (models ?? []).filter((m) => m.model_type === "transcription");

  function openAddDialog() {
    setEditModel(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(m: AIModel) {
    setEditModel(m);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    deleteModel.mutate(id);
    // Clear references in settings
    if (settings.ingestion.summary_model_id === id) {
      updateIngestion({ summary_model_id: null });
    }
    if (settings.ingestion.overview_model_id === id) {
      updateIngestion({ overview_model_id: null });
    }
    if (settings.ingestion.vision_model_id === id) {
      updateIngestion({ vision_model_id: null });
    }
    if (settings.ingestion.transcription_model_id === id) {
      updateIngestion({ transcription_model_id: null });
    }
    if (settings.agent.model_id === id) {
      updateAgent("model_id", null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[15px] font-semibold">AI Models</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Register AI models and assign them to different tasks.
        </p>
      </div>

      {/* Model Registry */}
      <div className="rounded-lg border border-[var(--overlay-8)] bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--overlay-6)]">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] font-medium">Model Registry</span>
          </div>
          <Button size="sm" variant="outline" onClick={openAddDialog}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Model
          </Button>
        </div>
        <div className="divide-y divide-[var(--overlay-6)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (models ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">
                No models registered yet. Add a model to get started.
              </p>
            </div>
          ) : (
            (models ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{m.label}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {PROVIDER_LABELS[m.provider] ?? m.provider}
                    </Badge>
                    {m.is_system && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        Default
                      </Badge>
                    )}
                    {m.capabilities
                      .filter((cap) => cap === "thinking" || cap === "vision")
                      .map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{m.model}</p>
                </div>
                <div className="flex items-center gap-1">
                  {m.is_system ? (
                    <span className="text-[11px] text-muted-foreground pr-1">
                      Built-in
                    </span>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setRefreshingModelId(m.id);
                          refreshCaps.mutate(m.id, {
                            onSettled: () => setRefreshingModelId(null),
                          });
                        }}
                        disabled={refreshingModelId === m.id}
                        title="Refresh capabilities"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", refreshingModelId === m.id && "animate-spin")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEditDialog(m)}
                        title="Edit model"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(m.id)}
                        title="Remove model"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary LLM */}
      <ModelAssignment
        title="Summary LLM"
        description="Used for generating file summaries and overviews during ingestion."
        icon={FileText}
        models={llmModels}
        selectedId={settings.ingestion.summary_model_id}
        onSelect={(id) => updateIngestion({ summary_model_id: id })}
        emptyMessage="Add an LLM model above to enable summary generation."
      />

      {/* Overview LLM */}
      <ModelAssignment
        title="Overview LLM"
        description="Used for generating concise file overviews during ingestion."
        icon={BookOpen}
        models={llmModels}
        selectedId={settings.ingestion.overview_model_id}
        onSelect={(id) => updateIngestion({ overview_model_id: id })}
        emptyMessage="Add an LLM model above to enable overview generation."
      />

      {/* Vision LLM */}
      <ModelAssignment
        title="Vision LLM"
        description="Used for describing images and visual content in documents."
        icon={ImageIcon}
        models={visionModels}
        selectedId={settings.ingestion.vision_model_id}
        onSelect={(id) => updateIngestion({ vision_model_id: id })}
        emptyMessage="No vision-capable models. Add a model with vision capability above."
      />

      {/* Transcription */}
      <ModelAssignment
        title="Transcription"
        description="Used for transcribing audio and video files."
        icon={FileAudio}
        models={transcriptionModels}
        selectedId={settings.ingestion.transcription_model_id}
        onSelect={(id) => updateIngestion({ transcription_model_id: id })}
        emptyMessage="No transcription models. Add a transcription model above."
      />

      {/* Agent LLM */}
      <div className="rounded-lg border border-[var(--overlay-8)] bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--overlay-6)]">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-medium">Agent LLM</span>
        </div>
        <div className="space-y-4 px-4 py-4">
          {llmModels.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md bg-[var(--overlay-4)] px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                Add an LLM model above to enable the agent.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-[13px]">Model</Label>
              <Select
                value={settings.agent.model_id ?? "none"}
                onValueChange={(v) => updateAgent("model_id", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not configured</SelectItem>
                  {llmModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} ({m.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px]">Response language</Label>
              <Select
                value={settings.agent.language}
                onValueChange={(v) => updateAgent("language", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Custom instructions</Label>
            <Textarea
              value={settings.agent.custom_instructions}
              onChange={(e) => updateAgent("custom_instructions", e.target.value)}
              placeholder="Give the agent specific instructions for how to handle your documents..."
              rows={4}
              className="text-[13px]"
            />
            <p className="text-[12px] text-muted-foreground">
              These instructions will be included in every agent interaction.
            </p>
          </div>
        </div>
      </div>

      <AIModelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editModel={editModel}
      />
    </div>
  );
}

function ModelAssignment({
  title,
  description,
  icon: Icon,
  models,
  selectedId,
  onSelect,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  models: AIModel[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  emptyMessage: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--overlay-8)] bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--overlay-6)]">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="text-[12px] text-muted-foreground">{description}</p>
        {models.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md bg-[var(--overlay-4)] px-3 py-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Select
              value={selectedId ?? "none"}
              onValueChange={(v) => onSelect(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not configured</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label} ({m.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingestion Section (file type settings only — LLM config moved to AI Models)
// ---------------------------------------------------------------------------

function IngestionSection({
  ingestion,
  updateIngestion,
}: {
  ingestion: IngestionSettings;
  updateIngestion: (patch: Partial<IngestionSettings>) => void;
}) {
  const [openCards, setOpenCards] = useState<Set<string>>(new Set(["document"]));

  const hasSummaryModel = !!ingestion.summary_model_id;
  const hasVisionModel = !!ingestion.vision_model_id;
  const hasTranscriptionModel = !!ingestion.transcription_model_id;

  function toggleCard(id: string) {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[15px] font-semibold">Ingestion</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Configure how uploaded files are automatically processed.
        </p>
      </div>

      {/* Global toggles */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between rounded-lg border border-[var(--overlay-8)] bg-card p-4">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium">Auto-ingest</p>
            <p className="text-[12px] text-muted-foreground">
              Process files when uploaded
            </p>
          </div>
          <Switch
            checked={ingestion.auto_ingest}
            onCheckedChange={(v) => updateIngestion({ auto_ingest: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[var(--overlay-8)] bg-card p-4">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium">Reprocess on update</p>
            <p className="text-[12px] text-muted-foreground">
              Re-run when a file is replaced
            </p>
          </div>
          <Switch
            checked={ingestion.reprocess_on_update}
            onCheckedChange={(v) => updateIngestion({ reprocess_on_update: v })}
          />
        </div>
      </div>

      {/* Language */}
      <div className="rounded-lg border border-[var(--overlay-8)] bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium">Processing language</p>
            <p className="text-[12px] text-muted-foreground">
              Language hint for extraction and summarization.
            </p>
          </div>
          <Select
            value={ingestion.language}
            onValueChange={(v) => updateIngestion({ language: v })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Settings */}
      <div className="rounded-lg border border-[var(--overlay-8)] bg-card p-4 space-y-4">
        <div className="space-y-0.5">
          <p className="text-[14px] font-medium">Summary Settings</p>
          <p className="text-[12px] text-muted-foreground">
            Configure summary length and custom instructions.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-[13px]">Summary length</Label>
          <div className="flex gap-2">
            {([
              { value: "short", label: "Short", desc: "2-3 sentences" },
              { value: "medium", label: "Medium", desc: "1-2 paragraphs" },
              { value: "long", label: "Long", desc: "Detailed" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateIngestion({ summary_length: opt.value })}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left transition-colors",
                  ingestion.summary_length === opt.value
                    ? "border-primary/50 bg-primary/5"
                    : "border-[var(--overlay-8)] hover:border-[var(--overlay-15)]",
                )}
              >
                <p className="text-[12px] font-medium">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[13px]">Custom instructions</Label>
          <Textarea
            value={ingestion.summary_instructions}
            onChange={(e) => updateIngestion({ summary_instructions: e.target.value })}
            placeholder="Additional guidance for summary generation..."
            rows={3}
            className="text-[13px]"
          />
        </div>
      </div>

      {/* Overview Generation */}
      <div className="rounded-lg border border-[var(--overlay-8)] bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium">Overview Generation</p>
            <p className="text-[12px] text-muted-foreground">
              Generates a 1-2 sentence overview for each file. Improves agent search accuracy. Works independently of summary settings.
            </p>
          </div>
          <Switch
            checked={ingestion.generate_overview}
            onCheckedChange={(v) => updateIngestion({ generate_overview: v })}
          />
        </div>
      </div>

      {/* File Type Settings */}
      <div className={cn("space-y-3", !ingestion.auto_ingest && "pointer-events-none opacity-40")}>
        <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
          File Type Settings
        </h3>

        {/* Documents */}
        <CategoryCard
          id="document"
          label="Documents"
          types="PDF, DOCX"
          icon={FileText}
          open={openCards.has("document")}
          onToggle={() => toggleCard("document")}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <SettingSwitch
              label="Summary generation"
              description="Generate AI summaries"
              checked={ingestion.document.summary}
              onCheckedChange={(v) =>
                updateIngestion({ document: { ...ingestion.document, summary: v } })
              }
              disabled={!hasSummaryModel}
              disabledHint="Configure summary model in AI Models tab"
            />
            <SettingSwitch
              label="Structure extraction"
              description="Extract headings, sections"
              checked={ingestion.document.structure}
              onCheckedChange={(v) =>
                updateIngestion({ document: { ...ingestion.document, structure: v } })
              }
            />
            <SettingSwitch
              label="Table extraction"
              description="Extract tables from documents"
              checked={ingestion.document.tables}
              onCheckedChange={(v) =>
                updateIngestion({ document: { ...ingestion.document, tables: v } })
              }
            />
          </div>
        </CategoryCard>

        {/* Text & Code */}
        <CategoryCard
          id="text"
          label="Text & Code"
          types="txt, md, json, code"
          icon={FileText}
          open={openCards.has("text")}
          onToggle={() => toggleCard("text")}
        >
          <SettingSwitch
            label="Summary generation"
            description="Generate AI summaries"
            checked={ingestion.text.summary}
            onCheckedChange={(v) =>
              updateIngestion({ text: { ...ingestion.text, summary: v } })
            }
            disabled={!hasSummaryModel}
            disabledHint="Configure summary model in AI Models tab"
          />
        </CategoryCard>

        {/* Spreadsheets */}
        <CategoryCard
          id="spreadsheet"
          label="Spreadsheets"
          types="xlsx, csv"
          icon={FileSpreadsheet}
          open={openCards.has("spreadsheet")}
          onToggle={() => toggleCard("spreadsheet")}
        >
          <SettingSwitch
            label="Summary generation"
            description="Generate AI summaries of tabular data"
            checked={ingestion.spreadsheet.summary}
            onCheckedChange={(v) =>
              updateIngestion({ spreadsheet: { ...ingestion.spreadsheet, summary: v } })
            }
            disabled={!hasSummaryModel}
            disabledHint="Configure summary model in AI Models tab"
          />
          <CategoryHint>Table extraction is always enabled for spreadsheets.</CategoryHint>
        </CategoryCard>

        {/* Images */}
        <CategoryCard
          id="image"
          label="Images"
          types="png, jpg, gif, webp"
          icon={ImageIcon}
          open={openCards.has("image")}
          onToggle={() => toggleCard("image")}
        >
          <SettingSwitch
            label="Description"
            description="Generate descriptions using vision model"
            checked={ingestion.image.description}
            onCheckedChange={(v) =>
              updateIngestion({ image: { ...ingestion.image, description: v } })
            }
            disabled={!hasVisionModel}
            disabledHint="Configure a vision model in AI Models tab"
          />
        </CategoryCard>

        {/* Audio */}
        <CategoryCard
          id="audio"
          label="Audio"
          types="mp3, wav, ogg"
          icon={FileAudio}
          open={openCards.has("audio")}
          onToggle={() => toggleCard("audio")}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <SettingSwitch
              label="Transcription"
              description="Transcribe audio files"
              checked={ingestion.audio.transcription}
              onCheckedChange={(v) =>
                updateIngestion({ audio: { ...ingestion.audio, transcription: v } })
              }
              disabled={!hasTranscriptionModel}
              disabledHint="Configure transcription model in AI Models tab"
            />
            <SettingSwitch
              label="Summary"
              description="Summarize the transcript"
              checked={ingestion.audio.summary}
              onCheckedChange={(v) =>
                updateIngestion({ audio: { ...ingestion.audio, summary: v } })
              }
              disabled={!hasSummaryModel}
              disabledHint="Configure summary model in AI Models tab"
            />
          </div>
        </CategoryCard>

        {/* Video */}
        <CategoryCard
          id="video"
          label="Video"
          types="mp4, webm, mov"
          icon={FileVideo}
          open={openCards.has("video")}
          onToggle={() => toggleCard("video")}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <SettingSwitch
              label="Transcription"
              description="Transcribe video audio track"
              checked={ingestion.video.transcription}
              onCheckedChange={(v) =>
                updateIngestion({ video: { ...ingestion.video, transcription: v } })
              }
              disabled={!hasTranscriptionModel}
              disabledHint="Configure transcription model in AI Models tab"
            />
            <SettingSwitch
              label="Visual description"
              description="Describe using vision model"
              checked={ingestion.video.description}
              onCheckedChange={(v) =>
                updateIngestion({ video: { ...ingestion.video, description: v } })
              }
              disabled={!hasVisionModel}
              disabledHint="Configure a vision model in AI Models tab"
            />
          </div>
          <SettingSwitch
            label="Summary"
            description="Summarize the transcript"
            checked={ingestion.video.summary}
            onCheckedChange={(v) =>
              updateIngestion({ video: { ...ingestion.video, summary: v } })
            }
            disabled={!hasSummaryModel}
            disabledHint="Configure summary model in AI Models tab"
          />
        </CategoryCard>
      </div>

      {/* PII detection */}
      <PIISettingsCard ingestion={ingestion} updateIngestion={updateIngestion} />
    </div>
  );
}

function PIISettingsCard({
  ingestion,
  updateIngestion,
}: {
  ingestion: IngestionSettings;
  updateIngestion: (patch: Partial<IngestionSettings>) => void;
}) {
  const pii = ingestion.pii;

  function patchPII(patch: Partial<typeof pii>) {
    updateIngestion({ pii: { ...pii, ...patch } });
  }

  return (
    <div className="rounded-lg border border-[var(--overlay-8)] bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--overlay-6)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-medium">PII Detection &amp; Redaction</span>
        </div>
        <Switch
          checked={pii.enabled}
          onCheckedChange={(v) => patchPII({ enabled: v })}
        />
      </div>
      {pii.enabled && (
        <div className="space-y-4 px-4 py-4">
          <p className="text-[12px] text-muted-foreground">
            When enabled, a <strong>Detect PII</strong> action appears on each file. These are
            the default classes pre-selected in the detect dialog — you can change them per run.
          </p>
          <MultiSelectChips
            label="In documents & text"
            options={TEXT_ENTITY_OPTIONS}
            selected={pii.text_entities}
            onChange={(v) => patchPII({ text_entities: v })}
          />
          <MultiSelectChips
            label="In audio & video speech"
            options={TEXT_ENTITY_OPTIONS}
            selected={pii.audio_entities}
            onChange={(v) => patchPII({ audio_entities: v })}
          />
          <MultiSelectChips
            label="In images"
            options={YOLO_CLASS_OPTIONS}
            selected={pii.image_classes}
            onChange={(v) => patchPII({ image_classes: v })}
          />
          <MultiSelectChips
            label="In videos"
            options={YOLO_CLASS_OPTIONS}
            selected={pii.video_classes}
            onChange={(v) => patchPII({ video_classes: v })}
          />
          <ChipListEditor
            label="Custom regex patterns"
            values={pii.custom_regex}
            onChange={(v) => patchPII({ custom_regex: v })}
            placeholder="e.g. \\bEMP-\\d{6}\\b"
            mono
          />
        </div>
      )}
    </div>
  );
}

function ChipListEditor({
  label,
  values,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label className="text-[12px]">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-[var(--overlay-4)] px-2 py-0.5 text-[11px]",
              mono && "font-mono",
            )}
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted-foreground/60 hover:text-destructive"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-[11px] text-muted-foreground/50">None</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={cn("h-8 text-[12px]", mono && "font-mono")}
        />
        <Button size="sm" variant="outline" className="h-8" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

function CategoryCard({
  id,
  label,
  types,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  types: string;
  icon: typeof FileText;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--overlay-8)] bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--overlay-2)]"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground/60">{types}</span>
        <div className="flex-1" />
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground/40 transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--overlay-6)] px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

function CategoryHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 rounded-md bg-[var(--overlay-2)] px-2.5 py-2">
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
      <p className="text-[11px] text-muted-foreground/60">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspaces Section
// ---------------------------------------------------------------------------

function WorkspacesSection({
  currentWorkspaceId,
  onDeleteCurrent,
}: {
  currentWorkspaceId: string;
  onDeleteCurrent: () => void;
}) {
  const router = useRouter();
  const { data, isLoading } = useWorkspaces();
  const deleteWorkspace = useDeleteWorkspace(currentWorkspaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const workspaces = data?.data ?? [];
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  function handleSwitch(workspaceId: string) {
    if (workspaceId !== currentWorkspaceId) {
      router.push(`/app/${workspaceId}/settings?tab=workspaces`);
    }
  }

  function handleCreated(workspaceId: string) {
    router.push(`/app/${workspaceId}/settings?tab=workspaces`);
  }

  function handleDeleteCurrent() {
    deleteWorkspace.mutate(undefined, {
      onSuccess: onDeleteCurrent,
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Workspaces</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Manage your workspaces. Right-click to edit name or description.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create workspace
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <WorkspaceRow
              key={ws.id}
              workspace={ws}
              isCurrent={ws.id === currentWorkspaceId}
              onSwitch={() => handleSwitch(ws.id)}
            />
          ))}
        </div>
      )}

      <Separator className="bg-[var(--overlay-6)]" />

      <div className="rounded-lg border border-destructive/30 p-4">
        <h3 className="text-[14px] font-medium text-destructive">
          Danger Zone
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Deleting this workspace will permanently remove all files, folders,
          and processed content.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="delete-confirm" className="text-[13px]">
            Type &quot;{currentWorkspace?.name ?? ""}&quot; to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={currentWorkspace?.name ?? ""}
          />
          <Button
            variant="destructive"
            disabled={deleteConfirm !== (currentWorkspace?.name ?? "") || deleteWorkspace.isPending}
            onClick={handleDeleteCurrent}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete workspace
          </Button>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

function WorkspaceRow({
  workspace,
  isCurrent,
  onSwitch,
}: {
  workspace: Workspace;
  isCurrent: boolean;
  onSwitch: () => void;
}) {
  const [editing, setEditing] = useState<"name" | "description" | null>(null);
  const [editName, setEditName] = useState(workspace.name);
  const [editDesc, setEditDesc] = useState(workspace.description ?? "");
  const updateWorkspace = useUpdateWorkspace(workspace.id, { silent: true });
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  function startEdit(field: "name" | "description") {
    setEditName(workspace.name);
    setEditDesc(workspace.description ?? "");
    setEditing(field);
    setContextMenu(null);
    setTimeout(() => {
      if (field === "name") nameRef.current?.focus();
      else descRef.current?.focus();
    }, 0);
  }

  function commitEdit() {
    if (!editing) return;
    const trimmedName = editName.trim();
    const trimmedDesc = editDesc.trim();
    const payload: Record<string, unknown> = {};
    if (trimmedName && trimmedName !== workspace.name) payload.name = trimmedName;
    if (trimmedDesc !== (workspace.description ?? "")) payload.description = trimmedDesc || undefined;
    if (Object.keys(payload).length > 0) {
      updateWorkspace.mutate(payload);
    }
    setEditing(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-between rounded-lg border px-4 py-3",
        isCurrent
          ? "border-primary/30 bg-primary/5"
          : "border-[var(--overlay-8)] hover:border-[var(--overlay-15)]",
      )}
      onContextMenu={handleContextMenu}
    >
      <div className="min-w-0 flex-1">
        {editing === "name" ? (
          <Input
            ref={nameRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="h-7 text-[13px] font-medium"
          />
        ) : editing === "description" ? (
          <>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium">{workspace.name}</p>
              {isCurrent && (
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Current
                </span>
              )}
            </div>
            <Input
              ref={descRef}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="mt-1 h-7 text-[12px]"
              placeholder="Add a description..."
            />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium">{workspace.name}</p>
              {isCurrent && (
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Current
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">
              {workspace.description || `Created ${new Date(workspace.created_at).toLocaleDateString()}`}
            </p>
          </>
        )}
      </div>
      {!isCurrent && !editing && (
        <Button variant="outline" size="sm" className="ml-3 shrink-0" onClick={onSwitch}>
          Switch
        </Button>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-[var(--overlay-8)] bg-popover py-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex w-full items-center px-3 py-1.5 text-[13px] transition-colors hover:bg-accent"
            onClick={() => startEdit("name")}
          >
            Edit name
          </button>
          <button
            className="flex w-full items-center px-3 py-1.5 text-[13px] transition-colors hover:bg-accent"
            onClick={() => startEdit("description")}
          >
            Edit description
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Section
// ---------------------------------------------------------------------------

function AccountSection() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [editingName, setEditingName] = useState(false);
  const [editValue, setEditValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditValue(profile?.full_name ?? "");
    setEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }

  function commitName() {
    setEditingName(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== (profile?.full_name ?? "")) {
      updateProfile.mutate({ full_name: trimmed });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitName(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditingName(false); }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[15px] font-semibold">Account</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Manage your account and session.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Email</Label>
            <p className="text-[14px]">{profile?.email ?? ""}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Display name</Label>
            {editingName ? (
              <Input
                ref={nameInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={handleKeyDown}
                className="h-8 max-w-xs text-[14px]"
              />
            ) : (
              <p
                className="inline-block cursor-pointer rounded px-1 -mx-1 text-[14px] transition-colors hover:bg-[var(--overlay-4)]"
                onClick={startEditing}
                title="Click to edit"
              >
                {profile?.full_name || <span className="text-muted-foreground italic">Click to set name</span>}
              </p>
            )}
          </div>
        </div>
      )}

      <Separator className="bg-[var(--overlay-6)]" />

      <Button variant="outline" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

function SelectionModeSetting() {
  const { selectionMode, setSelectionMode } = useFileBrowserStore();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[14px] font-medium">Selection Mode</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          How files and folders are selected in the file browser.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setSelectionMode("windows")}
          className={cn(
            "flex-1 rounded-lg border p-3 text-left transition-colors",
            selectionMode === "windows"
              ? "border-primary/50 bg-primary/5"
              : "border-[var(--overlay-8)] hover:border-[var(--overlay-15)]",
          )}
        >
          <p className="text-[13px] font-medium">Windows-style</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Click to select, double-click to open. Ctrl/Shift for multi-select.
          </p>
        </button>
        <button
          onClick={() => setSelectionMode("checkbox")}
          className={cn(
            "flex-1 rounded-lg border p-3 text-left transition-colors",
            selectionMode === "checkbox"
              ? "border-primary/50 bg-primary/5"
              : "border-[var(--overlay-8)] hover:border-[var(--overlay-15)]",
          )}
        >
          <p className="text-[13px] font-medium">Checkbox</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Click to open, use checkboxes to select items.
          </p>
        </button>
      </div>
    </div>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  disabledHint,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", disabled && "opacity-50")}>
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[12px] text-muted-foreground">{description}</p>
        {disabled && disabledHint && (
          <p className="text-[11px] text-amber-500/80">{disabledHint}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
