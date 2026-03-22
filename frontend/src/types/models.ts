export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface DataResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
}

export interface Workspace {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  settings: WorkspaceSettings;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  ingestion: IngestionSettings;
  agent: AgentSettings;
}

export type FileCategory =
  | "document"
  | "text"
  | "spreadsheet"
  | "image"
  | "audio"
  | "video";

export type SummaryLength = "short" | "medium" | "long";

export interface DocumentSettings {
  summary: boolean;
  structure: boolean;
  tables: boolean;
}

export interface TextSettings {
  summary: boolean;
}

export interface SpreadsheetSettings {
  summary: boolean;
}

export interface ImageSettings {
  description: boolean;
}

export interface AudioSettings {
  transcription: boolean;
  summary: boolean;
}

export interface VideoSettings {
  transcription: boolean;
  description: boolean;
  summary: boolean;
}

export interface IngestionSettings {
  auto_ingest: boolean;
  reprocess_on_update: boolean;
  summary_model_id: string | null;
  overview_model_id: string | null;
  vision_model_id: string | null;
  transcription_model_id: string | null;
  language: string;
  summary_length: SummaryLength;
  summary_instructions: string;
  generate_overview: boolean;

  document: DocumentSettings;
  text: TextSettings;
  spreadsheet: SpreadsheetSettings;
  image: ImageSettings;
  audio: AudioSettings;
  video: VideoSettings;
}

export type LLMProvider = "ollama" | "vllm" | "openai" | "anthropic" | "gemini" | "groq";

export type ThinkingMode = "none" | "toggle" | "budget" | "always_budget";

export interface ThinkingCapabilities {
  mode: ThinkingMode;
  budget_levels: string[] | null;
}

const BUDGET_LEVELS = ["low", "medium", "high"];

/**
 * Derive thinking capabilities from a model's stored capabilities.
 * Pure logic — no network calls.
 *
 * Stored capabilities:
 *   "thinking"           → model supports thinking (toggle on/off)
 *   "thinking_budget"    → model supports budget levels (low/medium/high)
 *   "thinking_always_on" → model cannot disable thinking (e.g. gptoss)
 *   "vision"             → model supports image input
 *
 * UI modes:
 *   "none"          → no thinking UI
 *   "toggle"        → bulb on/off only
 *   "budget"        → bulb on/off + budget dropdown
 *   "always_budget" → bulb always lit (can't toggle off) + budget dropdown
 */
export function deriveThinkingCapabilities(
  capabilities: string[],
): ThinkingCapabilities {
  if (!capabilities.includes("thinking")) {
    return { mode: "none", budget_levels: null };
  }

  const hasBudget = capabilities.includes("thinking_budget");
  const alwaysOn = capabilities.includes("thinking_always_on");

  if (alwaysOn && hasBudget) {
    return { mode: "always_budget", budget_levels: BUDGET_LEVELS };
  }

  if (hasBudget) {
    return { mode: "budget", budget_levels: BUDGET_LEVELS };
  }

  return { mode: "toggle", budget_levels: null };
}

export interface AgentSettings {
  model_id: string | null;
  custom_instructions: string;
  language: string;
  thinking_enabled: boolean;
  thinking_budget: string;
}

// ---------------------------------------------------------------------------
// AI Models
// ---------------------------------------------------------------------------

export type AIModelType = "llm" | "transcription";

export interface AIModel {
  id: string;
  org_id: string;
  label: string;
  model_type: AIModelType;
  provider: LLMProvider;
  model: string;
  base_url: string;
  has_api_key: boolean;
  capabilities: string[];
  context_length: number | null;
  created_at: string;
  updated_at: string;
}

export interface AIModelCreate {
  label: string;
  model_type?: AIModelType;
  provider: LLMProvider;
  model: string;
  base_url?: string;
  api_key?: string;
  capabilities?: string[];
  context_length?: number | null;
}

export interface AIModelUpdate {
  label?: string;
  model_type?: AIModelType;
  provider?: LLMProvider;
  model?: string;
  base_url?: string;
  api_key?: string;
  capabilities?: string[];
  context_length?: number | null;
}

export interface AIModelTestRequest {
  model_type?: AIModelType;
  provider: LLMProvider;
  model: string;
  base_url?: string;
  api_key?: string;
}

export interface AIModelTestResult {
  success: boolean;
  error: string | null;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export type FileStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "partial"
  | "failed";

export interface FileItem {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: FileStatus;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface FileContent {
  id: string;
  file_id: string;
  raw_text: string | null;
  summary: string | null;
  overview: string | null;
  structure: Record<string, unknown> | null;
  page_count: number | null;
  word_count: number | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileDetail {
  file: FileItem;
  storage_key: string;
  content: FileContent | null;
  tags: Tag[];
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "tool_call" | "tool_result" | "system";

export interface AgentMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string | null;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
  created_at: string;
  /** UI-only — never sent to LLM. Stores the model's thinking for this response. */
  thinking?: string | null;
}

export interface ContextLocation {
  type: "workspace" | "folder" | "file";
  id: string | null;
}

export type SessionStatus = "idle" | "streaming";

export interface AgentSession {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string | null;
  context_location: ContextLocation | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface AgentSessionDetail extends AgentSession {
  messages: AgentMessage[];
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

export type ProcessingJobStatus = "queued" | "running" | "completed" | "failed";

export interface ProcessingJob {
  id: string;
  file_id: string;
  workspace_id: string;
  status: ProcessingJobStatus;
  steps: Record<string, string> | null;
  progress: number;
  retry_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  file_name: string | null;
  file_mime_type: string | null;
}
