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
  full_name: string;
  avatar_url: string | null;
  created_at: string;
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

export interface IngestionSettings {
  auto_ingest: boolean;
  summary_generation: boolean;
  structure_extraction: boolean;
  table_extraction: boolean;
  transcription: boolean;
  image_description: boolean;
  video_description: boolean;
  processing_llm: LLMConfig;
  language: string;
  reprocess_on_update: boolean;
}

export interface AgentSettings {
  llm_provider: string;
  llm_model: string;
  custom_instructions: string;
  language: string;
}

export interface LLMConfig {
  provider: string;
  model: string;
}

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
