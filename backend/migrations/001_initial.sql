-- Archiva.ai — Initial Schema
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB NOT NULL DEFAULT '{
        "ingestion": {
            "auto_ingest": true,
            "summary_generation": true,
            "structure_extraction": true,
            "table_extraction": true,
            "transcription": false,
            "image_description": false,
            "video_description": false,
            "processing_llm": {"provider": "ollama", "model": "qwen2.5:14b"},
            "language": "en",
            "reprocess_on_update": true
        },
        "agent": {
            "llm_provider": "ollama",
            "llm_model": "qwen2.5:14b",
            "custom_instructions": "",
            "language": "en"
        }
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_org ON workspaces(org_id);

-- ============================================================
-- FOLDERS (self-referential tree with materialized paths)
-- ============================================================
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, parent_id, name)
);

CREATE INDEX idx_folders_workspace ON folders(workspace_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_path ON folders(path text_pattern_ops);

-- ============================================================
-- FILES
-- ============================================================
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_key TEXT NOT NULL,
    storage_backend TEXT NOT NULL DEFAULT 'r2',
    status TEXT NOT NULL DEFAULT 'uploaded',
    content_hash TEXT,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_workspace ON files(workspace_id);
CREATE INDEX idx_files_folder ON files(folder_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_content_hash ON files(content_hash);

-- ============================================================
-- FILE CONTENTS (extracted text, summary, structure)
-- ============================================================
CREATE TABLE file_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE UNIQUE,
    raw_text TEXT,
    summary TEXT,
    structure JSONB,
    page_count INT,
    word_count INT,
    language TEXT,
    tsv TSVECTOR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_contents_tsv ON file_contents USING GIN(tsv);
CREATE INDEX idx_file_contents_trgm ON file_contents USING GIN(raw_text gin_trgm_ops);

-- ============================================================
-- FILE TABLES (extracted tables from docs/spreadsheets)
-- ============================================================
CREATE TABLE file_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    table_index INT NOT NULL,
    headers JSONB,
    rows JSONB,
    page_number INT,
    sheet_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_tables_file ON file_tables(file_id);

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    UNIQUE(workspace_id, name)
);

CREATE INDEX idx_tags_workspace ON tags(workspace_id);

-- ============================================================
-- FILE TAGS (many-to-many)
-- ============================================================
CREATE TABLE file_tags (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

CREATE INDEX idx_file_tags_tag ON file_tags(tag_id);

-- ============================================================
-- PROCESSING JOBS
-- ============================================================
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE UNIQUE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    steps JSONB NOT NULL DEFAULT '[]',
    progress INT NOT NULL DEFAULT 0,
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_workspace ON processing_jobs(workspace_id);

-- ============================================================
-- AGENT SESSIONS
-- ============================================================
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT,
    context_location JSONB,
    is_compressed BOOLEAN NOT NULL DEFAULT false,
    compressed_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_sessions_workspace ON agent_sessions(workspace_id, user_id);

-- ============================================================
-- AGENT MESSAGES
-- ============================================================
CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    tool_args JSONB,
    tool_result JSONB,
    token_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_messages_session ON agent_messages(session_id, created_at);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_file_contents_updated_at BEFORE UPDATE ON file_contents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agent_sessions_updated_at BEFORE UPDATE ON agent_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
