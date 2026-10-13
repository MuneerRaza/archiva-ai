# Archiva — Project Plan

> Name: **Archiva.ai**
> Last updated: 2026-02-26
> Status: Planning — all pillars finalized, ready for implementation

---

## 1. Vision

**"An AI agent that lives inside your organization's data — not a search tool, a reasoning system."**

Organizations upload everything: documents, spreadsheets, audio recordings, videos, reports.
The agent doesn't just search — it reads, cross-references, finds patterns, detects correlations,
and executes multi-step reasoning tasks across the entire corpus.

Target verticals: law firms, hospitals, research teams, financial firms, any knowledge-heavy organization.

---

## 2. Core Differentiators

| What exists | What Archiva is |
|---|---|
| "Chat with your PDF" (one file, one query) | Agent reasons across entire org corpus |
| RAG lookup (semantic similarity) | Tool-calling agent (reads, lists, cross-references, executes) |
| Black box response | Full transparency — every tool call visible in real time |
| English-only, Western-market focused | Urdu/multilingual capable from architecture |
| Cloud-only, data leaves your hands | Optional local/desktop mode — data never leaves device |

---

## 3. Full Feature Scope

### 3.1 Organization & Access Management
- Multi-tenant: Organization → Teams → Members
- Role-based access control: Owner / Admin / Member / Viewer
- Per-workspace permissions
- Invite by email, invite links
- SSO (future: SAML, Google Workspace)
- Audit log: every file access, every agent query, every permission change

### 3.2 File & Folder Management
- Hierarchical folder structure (unlimited depth)
- Drag and drop upload, bulk operations
- File versioning
- File metadata: tags, custom fields, descriptions
- Soft delete + trash + restore
- Duplicate detection (content hash)
- File preview (PDF, images, video, audio in-browser)
- Share files/folders with external links (time-limited, password-protected)

### 3.3 Supported File Types
| Category | Formats |
|---|---|
| Documents | PDF, DOCX, DOC, TXT, MD, RTF, ODT |
| Spreadsheets | XLSX, XLS, CSV, ODS |
| Presentations | PPTX, PPT, ODP |
| Audio | MP3, WAV, M4A, OGG, FLAC |
| Video | MP4, MOV, AVI, MKV, WEBM |
| Images | PNG, JPG, WEBP, TIFF, HEIC |
| Code | Any text-based code file |
| Archives | ZIP, RAR (extract and process contents) |

### 3.4 AI Agent
- Streaming responses with visible tool calls (like Claude Code)
- Multi-turn conversations with session memory
- Task decomposition for complex queries
- Cross-document reasoning: correlations, patterns, timelines
- Structured output extraction
- Agent sessions saved, searchable
- Agent scope: single file / folder / workspace / entire org
- Configurable LLM backend per workspace

### 3.5 Search
- Hybrid search: full-text search (PostgreSQL FTS) + vector similarity (pgvector)
- Filters: file type, date range, uploader, folder, tags
- Search within a single file (page-level)
- Saved searches, search history

### 3.6 Storage Backends (your infrastructure)
Abstracted — swap without changing business logic:
- Supabase Storage, AWS S3, Cloudflare R2, Google Cloud Storage, MinIO

### 3.7 Storage Connectors (user's existing data)
Abstracted — connect to where users already have data:
- Google Drive, OneDrive / SharePoint, Dropbox, Box, FTP/SFTP

### 3.8 Processing Pipeline
- Async, non-blocking with real-time status
- Retry logic, parallel processing
- Type-specific extractors (not generic)
- Semantic chunking (respects document structure)
- Incremental re-processing on file update

### 3.9 Desktop App
- Local directory mounting — files stay on disk
- 100% local mode option (Ollama + local pgvector, zero cloud)
- Filesystem watcher for auto re-processing
- Privacy mode, works offline

### 3.10 API & Integrations
- Full REST API
- API keys per workspace
- Webhooks (file processed, agent task complete)
- Zapier / Make / Slack (future)

### 3.11 Billing & Plans (future)
- Free / Team / Enterprise tiers

### 3.12 Monitoring & Observability
- Per-workspace usage metrics
- System health dashboard
- Cost tracking (LLM tokens per query, per user)
- Agent observability (every tool call logged with latency)

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────┐
│              Client Layer                            │
│   Next.js Web App        Tauri Desktop App           │
└────────────────┬─────────────────────────────────────┘
                 │ HTTPS / SSE
┌────────────────▼─────────────────────────────────────┐
│              API Layer                               │
│              FastAPI (Python, fully async)            │
│   Auth middleware | Rate limiting | Request logging   │
└────┬──────────────┬──────────────┬───────────────────┘
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼──────────────────┐
│ Supabase│  │    Redis    │  │  Background Workers  │
│ Postgres│  │   Cache     │  │  (Ingest Pipeline)   │
│ pgvector│  │  (later)    │  │                      │
│ Auth    │  │             │  │                      │
│         │  └─────────────┘  └───────────────────────┘
└─────────┘
     │
┌────▼──────────────────────────────────────────────────┐
│              AI Layer                                 │
│   Pydantic AI Agent    Ollama (dev) / vLLM (prod)    │
│   Tool Executor        Embedding Model (v2)           │
│   Session Manager      Streaming SSE                  │
└───────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────┐
│              Storage Layer (Abstracted)               │
│   StorageBackend: R2 / S3 / Supabase / GCS / MinIO   │
│   StorageConnector: GDrive / OneDrive / Dropbox       │
└───────────────────────────────────────────────────────┘
```

---

## 5. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 15 (App Router, TypeScript) | Industry standard, SSR |
| UI Components | shadcn/ui + Tailwind CSS | Accessible, composable |
| State Management | Zustand + TanStack Query | Lightweight, async-first |
| Backend | FastAPI (Python 3.12+) | Async-native, best AI ecosystem |
| Database | Supabase PostgreSQL + pgvector | Managed, RLS, Realtime |
| Cache | Redis (Upstash managed) — later | Hot data, sessions |
| Auth | Supabase Auth | Free, built-in, JWT |
| Raw File Storage | Cloudflare R2 (MVP) | 10GB free, zero egress |
| Agent Framework | Pydantic AI | Lightweight, typed tools, auto-retry |
| LLM (dev) | Ollama (Qwen2.5-14B) | Free local inference |
| LLM (prod) | vLLM (Qwen2.5-72B / Llama 3.3-70B) | High throughput |
| Embeddings | nomic-embed-text via Ollama (v2) | Free, local, high quality |
| Streaming | SSE (Server-Sent Events) | Simple, FastAPI native |
| Desktop | Tauri v2 (later) | Lightweight, reuses Next.js |
| Deployment | Docker Compose → Railway | Progressive complexity |
| Monitoring | Prometheus + Grafana + Sentry (later) | Metrics + errors |

---

## 6. Key Design Decisions

### Performance Principles
- Async all the way — no sync I/O anywhere
- Connection pooling (asyncpg)
- Materialized paths for folder tree queries
- Signed URLs — files served directly from R2, never proxied
- SSE streaming — first token in <500ms
- Background processing — upload returns immediately

### Security
- Row-Level Security (RLS) at DB level
- JWT auth on every request
- Signed URLs (time-limited) for file downloads
- Encrypted connector credentials (AES-256)
- Content-Type validation (actual content, not just extension)
- Workspace isolation — no cross-workspace queries
- Audit logging on all sensitive actions

### Deployment Phases
- **Phase 1 (MVP):** Docker Compose, single server, Railway
- **Phase 2 (Growth):** Separated services, managed Redis, vLLM on GPU
- **Phase 3 (Scale):** Kubernetes, CDN, read replicas, dedicated GPU cluster
- **Phase 4 (Enterprise):** Multi-region, on-premise option, SLAs

---

## 7. Agent Tools (Full Vision)

| Tool | Purpose |
|---|---|
| `browse` | Navigate files/folders in scope |
| `read` | Read full content of a file |
| `search` | Hybrid search (FTS + vector) |
| `get_info` | Get detailed file metadata, summary, structure |
| `summarize` | Summarize a file or set of files |
| `cross_reference` | Compare/correlate across multiple files |
| `extract_structured` | Extract structured data given a schema |
| `execute_data_query` | Run queries on CSV/Excel data |
| `find_patterns` | Pattern/anomaly detection across corpus |
| `generate_timeline` | Temporal analysis across documents |

### 7.1 V1 Tools (Locked)

4 tools, minimal params. Pydantic AI validates + auto-retries on wrong params.

| Tool | Signature | Purpose |
|---|---|---|
| `browse` | `(folder_id="", sort_by="name"\|"size"\|"recent", limit=30, offset=0)` | Navigate folder contents. ID-based. `""` = workspace root. |
| `get_info` | `(file_id=str, include="summary,structure,metadata,tags")` | File details: summaries, TOC/headings, metadata, tags. Comma-separated include filter. |
| `search` | `(query=str, limit=20, offset=0)` | Unified BM25 + auto-fuzzy. Backend handles matching strategy. |
| `read` | `(file_id=str, offset=0, match="")` | Read content (5000 chars/call). Use offset to paginate, or match to jump to a passage. |

### 7.2 V2 Tools (Future)

`publish_artifact`, `trigger_service`, `delegate_task`, `semantic_search`. Date filters in search.

---

## 8. MVP Definition

Everything above is the full vision. **MVP is the smallest slice that demonstrates the core value.**

### MVP Stack
Same as full vision stack — no throwaway choices. Just fewer features active.

### MVP Features
- [ ] Auth (signup, login)
- [ ] Multiple workspaces per user (no teams/orgs sharing)
- [ ] File upload: PDF, DOCX, TXT, MD, CSV, XLSX
- [ ] Folder create/rename/delete
- [ ] File processing pipeline (extract → summary → structure → index)
- [ ] Real-time processing status
- [ ] Agent with 4 core tools: `browse`, `get_info`, `search`, `read`
- [ ] Streaming agent chat UI (tool calls visible in real time)
- [ ] BM25 + fuzzy search
- [ ] File download
- [ ] File preview (PDF, text, images)
- [ ] Chat sessions (save, list, resume)
- [ ] Workspace settings (ingestion, agent config)
- [ ] Landing page (simple)

### NOT in MVP
- Teams / organizations / multi-user sharing
- Audio / video processing
- Storage connectors (Google Drive, OneDrive)
- Desktop app (Tauri)
- Billing, advanced permissions
- Artifacts, pattern analysis, timeline tools
- API keys / webhooks
- Monitoring dashboard
- File versioning, file sharing
- Audit log UI
- Semantic/vector search (pgvector)
- Subagents

### MVP Success Criteria
1. User can sign up and log in
2. Upload 10 PDFs into folders
3. Ask agent "find all mentions of X across my documents" → correct, reasoned answer
4. See exactly which tool calls the agent made
5. Response in under 10 seconds for simple queries

---

## 9. Agent Context & Orchestration

### 9.1 System Prompt
Dynamic injection per turn based on user's current location:
- **Identity:** Archiva AI assistant, rules, behavior guidelines.
- **Location context:** workspace name+id, current folder/file info, counts (no file listings). If on a file: summary + structure (≤20 headings full, >20 top-level only).
- **User preferences:** custom behavior text from settings, preferred language.
- **Rules:** cite sources, never hallucinate, clarify ambiguous queries, max 3 search retries, prefer search over browsing for large folders.

### 9.2 Context Offloading
Middleware runs before each LLM call, checks token count:
- **Keep:** system prompt (always), last 10 messages, key facts (file IDs, answers, preferences).
- **Compress:** older messages → single summary paragraph.
- **Drop:** raw tool results from old turns.

### 9.3 Tool Result Management
- All tools return **plain text strings** (not structured JSON). Pydantic AI wraps them as `{"output": "..."}` in SSE events.
- `read`: max 5000 chars/call. Paginate with offset. Text hints like "[More content available. Use offset=...]" guide the LLM.
- `search`: max 20 results with short snippets.
- `get_info`: summaries are 2-3 lines, naturally small. Include filter reduces output.
- `browse`: max 50 items (configurable via limit param).
- Pagination hints embedded in text output (not structured `has_more` flags).

### 9.4 Session Management
- **New session:** fresh system prompt + location context. No history.
- **Continue session:** load ALL messages from DB if they fit. Only use compressed summary if messages were previously compacted during that session. Never compress retroactively.
- All messages stored in DB: user + assistant + tool calls + tool results.
- Session list in UI: past sessions, resumable.

### 9.5 Subagents
Deferred. May add later as needed.

### 9.6 Artifacts (v2)
Agent-generated persistent content (summaries, reports, translations). Stored as special file type in workspace, linked to source files. Implemented via ACT tools (`publish_artifact`) and TRIGGER tools (`trigger_service`).

---

## 10. Ingest Pipeline

### 10.1 Overview

Files go through a multi-step processing pipeline after upload. Each step is independent — failure in one optional step doesn't block others. Text extraction is the only hard prerequisite; everything else builds on it.

```
Upload → Store raw file (R2) → Create processing job → Worker picks up
  → Text Extraction (required)
  → Summary Generation (optional, LLM)
  → Structure Extraction (optional, parsing)
  → Table Extraction (optional, parsing)
  → BM25 Indexing (required)
  → Fuzzy Indexing (required)
  → Done ✓
```

### 10.2 Ingestion Settings (per workspace)

Configured in workspace settings panel. Two categories:

**Always-on steps (shown as info note, NOT toggles):**
> "Every uploaded file is automatically: text extracted, full-text indexed (BM25), and fuzzy-search indexed. These are required for search to work."

**Optional steps (toggleable):**
| Step | Default | Description |
|---|---|---|
| Summary generation | ON | LLM generates 2-3 line summary per file |
| Structure extraction | ON | Extract headings/sections/TOC from document |
| Table extraction | ON | Extract tables as structured data |
| Image description | OFF | LLM describes image content (requires vision model) |
| Transcription | OFF | Speech-to-text for audio/video (requires Whisper) |
| Video frame description | OFF | LLM describes key video frames (requires vision model) |

**Other settings:**
- **Ingestion mode:** Auto (default) — process immediately on upload. Manual — store raw, user clicks "Process" when ready.
- **Processing LLM:** Which model to use for summaries/descriptions (can differ from agent LLM — use a small fast model for processing, big model for agent).
- **Language preference:** Affects summary language, transcription language hint.
- **Re-process on update:** When a file is replaced, automatically re-run the pipeline. Default ON.

### 10.3 Processing Steps by File Type

**MVP file types: PDF, DOCX, TXT, MD, CSV, XLSX**

| File Type | Text Extraction | Summary | Structure | Tables | Library |
|---|---|---|---|---|---|
| PDF | PyMuPDF (fitz) — extract text per page | LLM on extracted text | Headings from font size analysis | camelot-py | `pymupdf`, `camelot-py` |
| DOCX | python-docx — extract paragraphs | LLM on extracted text | Headings from Word styles | python-docx table objects | `python-docx` |
| TXT | Read raw | LLM on content | None (flat text) | None | built-in |
| MD | Read raw | LLM on content | Parse `#` headings | None | built-in |
| CSV | Parse headers + rows | LLM: column names, row count, data description | Column headers as structure | Entire file is a table | built-in `csv` |
| XLSX | openpyxl — parse all sheets | LLM: sheet names, columns, row counts, data description | Sheet names + column headers | Each sheet is a table | `openpyxl` |

**V2 file types:**
| File Type | Processing | Library |
|---|---|---|
| Audio (MP3, WAV, etc.) | faster-whisper transcription → summary → index | `faster-whisper` |
| Video (MP4, etc.) | Extract audio → transcribe → optional frame description → summary → index | `faster-whisper`, `ffmpeg` |
| Images (PNG, JPG, etc.) | LLM vision description → index | Vision-capable LLM |
| PPTX | Slide text extraction → summary → structure → index | `python-pptx` |
| Archives (ZIP, RAR) | Extract → process each file individually | `zipfile`, `rarfile` |

### 10.4 Processing Job System

DB-backed job queue. No Redis dependency in MVP.

**`processing_jobs` table:**
```
id: uuid (PK)
file_id: uuid (FK files) UNIQUE
workspace_id: uuid (FK workspaces)
status: enum (queued, processing, completed, partial, failed, cancelled)
steps: jsonb [
  { "name": "text_extraction", "status": "completed", "started_at": "...", "completed_at": "...", "error": null },
  { "name": "summary", "status": "processing", "started_at": "...", "completed_at": null, "error": null },
  { "name": "structure", "status": "pending", ... },
  ...
]
progress: int (0-100, calculated from completed steps / total steps)
retry_count: int (default 0, max 3)
error_message: text (nullable, last fatal error)
created_at: timestamp
started_at: timestamp (nullable)
completed_at: timestamp (nullable)
```

**Status meanings:**
- `queued` — waiting for worker to pick up
- `processing` — worker is actively processing
- `completed` — all steps succeeded
- `partial` — required steps succeeded but some optional steps failed (file is usable, search works, but e.g., summary missing)
- `failed` — required step failed (text extraction). File not searchable. User can retry.
- `cancelled` — user cancelled processing

### 10.5 Worker Strategy (MVP)

**Architecture:** Async worker running in the FastAPI process. Uses `asyncio.Queue` for in-memory dispatch + DB as source of truth for persistence.

**Flow:**
1. File uploaded → row inserted into `files` (status: `uploaded`) + `processing_jobs` (status: `queued`)
2. Worker picks up job from DB (polls every 2s or triggered via asyncio event)
3. Worker processes steps sequentially per file
4. Each step completion → update `processing_jobs.steps` in DB → emit SSE event to frontend
5. All done → update `files.status` to `ready` + `processing_jobs.status` to `completed`

**Concurrency:** Process up to 3 files in parallel (configurable). Within a file, steps run sequentially (each depends on text extraction).

**On server restart:** Worker scans for `queued` or `processing` jobs on startup and resumes them.

**Error handling:**
- Each step retries up to 3 times with exponential backoff (1s, 4s, 16s)
- If a required step fails after retries → job status = `failed`, file status = `failed`
- If an optional step fails → skip it, continue to next step, job status = `partial` at end
- User can click "Retry" on failed files → resets job to `queued`, clears error, increments retry_count
- LLM-dependent steps (summary, description) fail gracefully — file is still searchable via BM25/fuzzy, just without a summary

**Later (v2):** Separate worker process, Redis-backed queue (ARQ), horizontal scaling.

### 10.6 Upload UX

**Upload trigger:** Drag-and-drop zone on file browser + "Upload" button in top bar. Supports multi-file selection.

**Compact indicator (default, bottom-right corner):**
```
┌──────────────────────────────────┐
│ ↑ Uploading 3 files...  ━━━━ 67%│
└──────────────────────────────────┘
```
Click to expand. Non-intrusive — user can keep browsing.

**Expanded upload panel (slide-up drawer):**
```
┌──────────────────────────────────────────────┐
│ Uploads                              ─  ×    │
├──────────────────────────────────────────────┤
│ ✓ report-q4.pdf             2.1 MB   [Edit]  │
│   ✓ Uploaded → ✓ Text → ⟳ Summary → ○ Index │
│                                              │
│ ━ meeting-notes.docx        340 KB           │
│   ⟳ Uploading... 67%                         │
│                                              │
│ ○ data.xlsx                 1.5 MB           │
│   Queued                                     │
│                                              │
│ ✗ broken.pdf               890 KB    [Retry] │
│   ✗ Text extraction failed                   │
└──────────────────────────────────────────────┘
```

**Status icons:** ○ pending, ⟳ in progress, ✓ complete, ✗ failed

**Metadata editing (click [Edit] or during upload):**
- **Title:** Pre-filled from filename. Editable inline.
- **Tags:** Autocomplete from existing workspace tags. Create new on the fly.
- **Description:** Optional free text.

Metadata can be edited at any time — during upload, during processing, or after completion.

### 10.7 Connector Sync (Google Drive — post-MVP)

- User connects Google Drive via OAuth in workspace settings
- Selects specific folders to sync (not entire Drive)
- Initial sync: all selected files queued for processing
- Incremental sync: polling every 15 minutes (configurable) via Google Drive Changes API
- Changed/new files → re-process. Deleted files → soft-delete in Archiva.
- Sync status visible in settings: last sync time, files synced, errors
- Files from connectors are read-only in Archiva (edit in source)

---

## 11. Auth & Permissions

### 11.1 MVP Auth

**Provider:** Supabase Auth. Zero custom auth code.

**Methods:**
- Email + password (with email confirmation)
- Magic link (passwordless)
- Google OAuth (natural fit — we integrate Google Drive later)

**Flow:**
1. User signs up → Supabase creates `auth.users` row → DB trigger creates `profiles` + default `organization` + default `workspace`
2. Login → Supabase returns JWT → stored in httpOnly cookie (Next.js) → sent as Bearer token to FastAPI
3. FastAPI middleware validates JWT on every request, extracts user ID
4. All queries scoped to user's organization

**User profile:** name, email, avatar (from OAuth or uploaded).

### 11.2 Organization Model (MVP)

MVP is single-user:
- Sign up → auto-create organization (named after user) → auto-create "My Workspace" (default workspace)
- User can create additional workspaces within their org
- No invite/team features in MVP

**Schema prepared for multi-tenant** (org_members, roles, workspace_members tables exist but role enforcement is not implemented in MVP — owner has full access to everything).

### 11.3 Roles (v2 — schema only in MVP)

| Role | Permissions |
|---|---|
| Owner | Everything. Billing, delete org, manage members. |
| Admin | Manage workspaces, invite members, configure settings. Cannot delete org. |
| Member | Upload, browse, chat with agent, search. Cannot change settings. |
| Viewer | Read-only. Browse, search, view files. Cannot upload or chat. |

### 11.4 Workspace Access (v2)

- Each workspace has its own member list with roles
- A user can be Admin in one workspace and Viewer in another
- Workspace isolation enforced at query level (all queries include `workspace_id` filter)

---

## 12. Frontend Structure

### 12.1 Design Language

- **Theme:** Dark by default, light theme toggle available
- **Aesthetic:** Notion/Linear vibe — clean, minimal, generous whitespace, subtle borders
- **Font:** Inter (UI), JetBrains Mono (code/agent output)
- **Spacing:** 4px grid system
- **Colors:** Neutral grays for surfaces, single accent color (blue/indigo), semantic colors for status (green=success, amber=warning, red=error)
- **Motion:** Subtle, functional. No decorative animations. Transitions on panels, hover states, loading skeletons.

### 12.2 Routes

```
/                                        → Landing page (marketing)
/login                                   → Login
/signup                                  → Sign up

/app                                     → Redirect to default workspace
/app/[workspaceId]                       → Workspace root (file browser)
/app/[workspaceId]/folder/[folderId]     → Folder view
/app/[workspaceId]/file/[fileId]         → File detail + preview
/app/[workspaceId]/chat                  → New agent chat session
/app/[workspaceId]/chat/[sessionId]      → Continue existing session
/app/[workspaceId]/search                → Search page

/settings                                → User settings (profile, account)
/settings/workspaces                     → Workspace list + create
/settings/workspaces/[id]                → Workspace settings (general, ingestion, agent, connectors)
```

### 12.3 App Layout

```
┌─────────────────────────────────────────────────────────┐
│  Breadcrumbs: Workspace > Folder > ...     🔍   👤     │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  Logo    │                                              │
│          │           Main Content Area                  │
│  ──────  │                                              │
│  📁 Files│    (file browser / chat / search /           │
│  💬 Chat │     file preview / settings)                 │
│  🔍 Search                                              │
│          │                                              │
│  ──────  │                                              │
│  Recent  │                                              │
│  sessions│                                              │
│          │                                              │
│  ──────  │                                              │
│  ⚙ Set.  │                                              │
│  WS pick │                                              │
└──────────┴──────────────────────────────────────────────┘
              ┌──────────────────────────────┐
              │  Chat Panel (slide-over)     │ ← accessible from anywhere
              │  for quick questions         │
              └──────────────────────────────┘
```

**Sidebar (left, collapsible):**
- Logo/brand at top
- Workspace switcher (dropdown)
- Navigation: Files, Chat, Search
- Recent chat sessions (last 5, clickable to resume)
- Settings link at bottom

**Top bar:**
- Breadcrumb navigation (clickable path segments)
- Global search trigger (opens search page or command palette)
- User avatar + dropdown (profile, settings, logout)

**Chat access — slide-over panel only (no standalone page):**
- **Side panel** — toggleable from any page via FAB button. Slide-over from right with fullscreen toggle. Context-aware: knows which file/folder the user is currently viewing. Supports full chat functionality including thinking display, tool call cards, message editing, branching, and retry.

### 12.4 Key Pages

**File Browser (workspace root / folder view):**
- Table view (like Notion database or GitHub file list)
- Columns: Name (icon + name), Type, Size, Modified, Status (processing indicator)
- Sortable columns, bulk select with checkboxes
- Right-click context menu: rename, move, delete, download, process
- Empty state: illustration + "Upload your first file" CTA
- `+ New Folder` button, `↑ Upload` button
- Drag-and-drop zone (entire page, with visual overlay on drag)

**File Detail (`/app/[ws]/file/[id]`):**
- Split view: preview on left, metadata panel on right
- Preview: PDF viewer (pdf.js), text/code viewer (syntax highlighted), image viewer. Audio/video player (v2).
- Metadata panel: title (editable), tags (editable), description (editable), file info (size, type, pages, uploaded by, dates), processing status, LLM-generated summary, document structure (clickable TOC)
- Actions: download, re-process, delete, open in chat (starts a new chat scoped to this file)

**Agent Chat:**
- Messages stream character by character (SSE)
- Tool calls appear as collapsible cards between messages:
  ```
  ┌─ 🔧 search(query="Q4 revenue", file_type="xlsx") ──────┐
  │ Found 3 results:                                         │
  │ • Q4-Finance.xlsx — "Total revenue: $2.3M..."            │
  │ • Annual-Report.pdf — "Q4 showed 15% growth..."          │
  │ • Board-Minutes.docx — "Revenue target exceeded..."      │
  └──────────────────────────────────────────────────────────┘
  ```
- Each card shows: tool name, params (formatted), result (truncated, click to expand)
- Status indicators in real-time: "Thinking...", "Searching files...", "Reading document..."
- Input bar at bottom: text input + send button. File attachment (v2).
- Session sidebar (within chat page): list of past sessions, click to switch

**Search Page:**
- Large search input at top
- Filter bar: file type, folder scope, tags
- Results: file name, snippet with highlighted matches, breadcrumb path, relevance indicator
- Click result → navigates to file detail with match highlighted

**Settings — Workspace:**
- Tabs: General, Ingestion, Agent, Connectors (v2)
- **General:** workspace name, description, delete workspace
- **Ingestion:** mode toggle (auto/manual), optional step toggles, processing LLM selector, language preference (see Section 9.2). Info note for always-on steps.
- **Agent:** LLM provider + model selector, custom instructions textarea, response language preference

**Landing Page:**
- Hero: tagline + CTA ("Get Started" → signup)
- Feature highlights (3-4 cards): AI reasoning, transparency, file management, multilingual
- Demo screenshot/GIF of agent chat with visible tool calls
- Footer: links
- Simple, one-page. Not a priority for MVP but important for portfolio presentation.

### 12.5 Component Architecture

```
components/
├── layout/
│   ├── AppShell.tsx          # Sidebar + topbar + main wrapper
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   └── Breadcrumbs.tsx
├── files/
│   ├── FileBrowser.tsx       # Table view of files/folders
│   ├── FileRow.tsx           # Single row in file browser
│   ├── FileDetail.tsx        # Full file detail page content
│   ├── FilePreview.tsx       # PDF/text/image preview
│   ├── UploadDropzone.tsx    # Drag-and-drop upload area
│   ├── UploadPanel.tsx       # Upload progress drawer
│   └── MetadataEditor.tsx    # Title, tags, description editor
├── chat/
│   ├── ChatView.tsx          # Full chat page
│   ├── ChatPanel.tsx         # Slide-over chat panel
│   ├── MessageList.tsx       # Scrollable message container
│   ├── MessageBubble.tsx     # Single message (user or assistant)
│   ├── ToolCallCard.tsx      # Collapsible tool call display
│   ├── ChatInput.tsx         # Text input + send
│   └── SessionList.tsx       # Past sessions sidebar
├── search/
│   ├── SearchPage.tsx
│   ├── SearchInput.tsx
│   ├── SearchFilters.tsx
│   └── SearchResult.tsx
├── settings/
│   ├── SettingsLayout.tsx
│   ├── IngestionSettings.tsx
│   ├── AgentSettings.tsx
│   └── WorkspaceGeneral.tsx
├── workspace/
│   ├── WorkspaceSwitcher.tsx
│   └── WorkspaceCreate.tsx
└── ui/                       # shadcn/ui primitives (auto-generated)
```

### 12.6 State Management

**Zustand stores:**
- `useAuthStore` — user session, profile
- `useWorkspaceStore` — current workspace, workspace list
- `useFileStore` — current folder contents, navigation state
- `useUploadStore` — active uploads, progress tracking
- `useChatStore` — current session messages, streaming state
- `useSettingsStore` — workspace settings cache

**TanStack Query:** All server data fetching. Zustand only for client-side UI state.

---

## 13. Database Schema

### Core Tables

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organizations (auto-created per user in MVP)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workspaces (isolated content containers)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',  -- ingestion, agent, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Folders (self-referential tree)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,  -- NULL = workspace root
  name TEXT NOT NULL,
  path TEXT NOT NULL,  -- materialized path: "/parent-id/this-id" for fast tree queries
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, parent_id, name)  -- no duplicate names in same folder
);

-- Files
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,  -- NULL = workspace root
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL,        -- R2 object key
  storage_backend TEXT NOT NULL DEFAULT 'r2',
  status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded, processing, ready, partial, failed
  content_hash TEXT,                -- SHA-256 for duplicate detection
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extracted content (one row per file, created during processing)
CREATE TABLE file_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE UNIQUE,
  raw_text TEXT,                    -- full extracted text
  summary TEXT,                     -- LLM-generated 2-3 line summary
  structure JSONB,                  -- headings/sections/TOC as JSON tree
  page_count INT,
  word_count INT,
  language TEXT,                    -- detected language code
  tsv TSVECTOR,                    -- BM25 full-text search index
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extracted tables (zero or more per file)
CREATE TABLE file_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  table_index INT NOT NULL,         -- order within file
  headers JSONB,                    -- ["col1", "col2", ...]
  rows JSONB,                       -- [["val1", "val2"], ...]
  page_number INT,                  -- which page (for PDFs)
  sheet_name TEXT,                  -- which sheet (for XLSX)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tags (per workspace)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',     -- default indigo
  UNIQUE(workspace_id, name)
);

-- File-tag association
CREATE TABLE file_tags (
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

-- Processing jobs
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE UNIQUE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued, processing, completed, partial, failed, cancelled
  steps JSONB NOT NULL DEFAULT '[]',
  progress INT NOT NULL DEFAULT 0,        -- 0-100
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Agent chat sessions
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT,                       -- auto-generated from first message
  context_location JSONB,           -- {type: "workspace"|"folder"|"file", id: "uuid"}
  is_compressed BOOLEAN DEFAULT false,
  compressed_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent messages
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,               -- user, assistant, tool_call, tool_result
  content TEXT,
  tool_name TEXT,
  tool_args JSONB,
  tool_result JSONB,
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_files_workspace ON files(workspace_id);
CREATE INDEX idx_files_folder ON files(folder_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_content_hash ON files(content_hash);
CREATE INDEX idx_folders_workspace ON folders(workspace_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_path ON folders(path text_pattern_ops);  -- for LIKE 'path/%' queries
CREATE INDEX idx_file_contents_tsv ON file_contents USING GIN(tsv);  -- BM25 full-text search
CREATE INDEX idx_file_contents_text_trgm ON file_contents USING GIN(raw_text gin_trgm_ops);  -- fuzzy search
CREATE INDEX idx_agent_sessions_workspace ON agent_sessions(workspace_id, user_id);
CREATE INDEX idx_agent_messages_session ON agent_messages(session_id, created_at);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_file_tags_file ON file_tags(file_id);
CREATE INDEX idx_file_tags_tag ON file_tags(tag_id);

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy search
-- CREATE EXTENSION IF NOT EXISTS vector;  -- v2: pgvector for semantic search
```

### Workspace Settings JSONB Structure

```json
{
  "ingestion": {
    "auto_ingest": true,
    "summary_generation": true,
    "structure_extraction": true,
    "table_extraction": true,
    "transcription": false,
    "image_description": false,
    "video_description": false,
    "processing_llm": { "provider": "ollama", "model": "qwen2.5:14b" },
    "language": "en",
    "reprocess_on_update": true
  },
  "agent": {
    "llm_provider": "ollama",
    "llm_model": "qwen2.5:14b",
    "custom_instructions": "",
    "language": "en"
  }
}
```

---

## 14. Project Structure

```
archiva/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, lifespan, middleware
│   │   ├── config.py               # Pydantic Settings (env vars)
│   │   ├── database.py             # asyncpg connection pool
│   │   ├── auth.py                 # JWT validation middleware (Supabase)
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # Shared dependencies (get_db, get_user)
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py         # Login, signup, profile
│   │   │       ├── workspaces.py   # CRUD workspaces
│   │   │       ├── folders.py      # CRUD folders
│   │   │       ├── files.py        # Upload, download, CRUD
│   │   │       ├── agent.py        # Chat endpoint (SSE streaming)
│   │   │       ├── search.py       # Search endpoint
│   │   │       └── settings.py     # Workspace settings
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── storage/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py         # StorageBackend ABC
│   │   │   │   └── r2.py           # Cloudflare R2 implementation
│   │   │   ├── processing/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── worker.py       # Async job worker
│   │   │   │   ├── pipeline.py     # Orchestrates steps per file
│   │   │   │   ├── extractors/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── pdf.py
│   │   │   │   │   ├── docx.py
│   │   │   │   │   ├── text.py     # TXT + MD
│   │   │   │   │   ├── csv_ext.py
│   │   │   │   │   └── xlsx.py
│   │   │   │   ├── summarizer.py   # LLM summary generation
│   │   │   │   └── indexer.py      # BM25 + fuzzy indexing
│   │   │   ├── agent/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── core.py         # Pydantic AI agent setup
│   │   │   │   ├── tools.py        # browse, get_info, search, read
│   │   │   │   ├── context.py      # System prompt builder, context offloading
│   │   │   │   └── session.py      # Session load/save/compress
│   │   │   ├── search.py           # BM25 + fuzzy search service
│   │   │   └── llm/
│   │   │       ├── __init__.py
│   │   │       ├── base.py         # LLM provider ABC
│   │   │       ├── ollama.py       # Ollama provider
│   │   │       └── vllm.py         # vLLM provider
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── hashing.py          # Content hash, etc.
│   ├── migrations/                  # SQL migration files (numbered)
│   │   ├── 001_initial.sql
│   │   └── ...
│   ├── tests/
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js App Router pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   └── (dashboard)/
│   │   │       ├── layout.tsx       # AppShell (sidebar + topbar)
│   │   │       └── app/
│   │   │           └── [workspaceId]/
│   │   │               ├── page.tsx           # File browser (root)
│   │   │               ├── folder/[folderId]/page.tsx
│   │   │               ├── file/[fileId]/page.tsx
│   │   │               ├── chat/page.tsx
│   │   │               ├── chat/[sessionId]/page.tsx
│   │   │               ├── search/page.tsx
│   │   │               └── settings/page.tsx
│   │   ├── components/              # (see Section 11.5)
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-files.ts
│   │   │   ├── use-upload.ts
│   │   │   ├── use-chat.ts
│   │   │   └── use-workspace.ts
│   │   ├── lib/
│   │   │   ├── api.ts              # API client (fetch wrapper)
│   │   │   ├── supabase.ts         # Supabase client (auth only)
│   │   │   └── utils.ts
│   │   ├── stores/                  # (see Section 11.6)
│   │   └── types/
│   │       ├── api.ts              # API response types
│   │       └── models.ts           # Domain models
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── Dockerfile
├── docker-compose.yml               # Local dev: FastAPI + Next.js + Postgres (Supabase local)
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml                   # Lint + type-check + test
├── PLAN.md
└── README.md
```

---

## 15. Deployment

### 15.1 Local Development

**Docker Compose** for local dev:
- `supabase-db` — Supabase local Postgres (via Supabase CLI `supabase start`)
- `backend` — FastAPI with hot reload
- `frontend` — Next.js dev server

Or run Supabase locally via CLI and run backend/frontend natively (faster iteration).

**Required local tools:**
- Python 3.12+, Node.js 20+, Docker
- Supabase CLI (for local Postgres + Auth emulator)
- Ollama (for local LLM)

### 15.2 Production (MVP)

**Target:** Railway (simple, cheap, good DX)

**Services:**
- **Backend:** Railway service from Dockerfile. Environment variables for Supabase URL, R2 credentials, Ollama/vLLM endpoint.
- **Frontend:** Vercel (free tier, optimal for Next.js) OR Railway.
- **Database:** Supabase cloud (free tier: 500MB DB, 1GB storage, 50k monthly active users).
- **Storage:** Cloudflare R2 (free tier: 10GB storage, 10M reads/month).
- **LLM:** Ollama on same machine (if Railway has enough RAM) or external vLLM endpoint on a GPU provider (Vast.ai, RunPod — ~$0.20/hr for A100).

**Estimated monthly cost for MVP:** $0-15 (Supabase free + R2 free + Railway $5/mo + LLM pay-per-use or self-host)

### 15.3 CI/CD

**GitHub Actions:**
```yaml
on: [push, pull_request]

jobs:
  backend:
    - Python lint (ruff)
    - Type check (mypy)
    - Tests (pytest)

  frontend:
    - ESLint + Prettier
    - TypeScript type check
    - Build (next build)
```

**Deploy:** Auto-deploy on push to `main` via Railway/Vercel integration.

---

## 16. MVP Build Order

Sequential — each phase builds on the previous.

### Phase 1: Foundation (Architecture & Building Blocks)
1. **Project scaffolding** — monorepo structure, Docker Compose, env config, .gitignore, linting/formatting setup (ruff, eslint, prettier)
2. **Backend core architecture** — FastAPI app skeleton, config (Pydantic Settings), structured logging (structlog), custom exception hierarchy, request ID middleware, DB connection pool (asyncpg), health check endpoint
3. **Frontend core architecture** — Next.js app skeleton, Tailwind + shadcn/ui setup, dark theme, layout shell (sidebar + topbar), API client, Zustand stores skeleton, TanStack Query provider
4. **Database schema** — all migrations, tables, indexes, extensions (pg_trgm)

### Phase 2: Auth
5. **Supabase Auth backend** — JWT validation middleware, user dependency injection, protected route decorator
6. **Supabase Auth frontend** — login/signup pages, Google OAuth, auth state management, protected routes, redirect logic
7. **Auto-provisioning** — DB trigger: on signup → create profile + organization + default workspace

### Phase 3: Workspace & File Management (Backend + Frontend)
8. **Workspace CRUD** — backend API + frontend (create, list, switch, delete)
9. **Folder CRUD** — backend API + frontend (create, rename, delete, navigate tree, breadcrumbs)
10. **File management backend** — R2 integration (StorageBackend), upload endpoint (multipart), download (signed URLs), delete, metadata CRUD, tags CRUD
11. **File browser UI** — table view, sorting, bulk select, context menu, drag-and-drop upload zone, empty states

### Phase 4: Upload, Settings & Playback (Heavy UI/UX)
12. **Upload experience** — multi-file upload with progress, compact indicator, expanded drawer, cancel, metadata editing (title, tags, description) during/after upload
13. **Workspace settings UI** — general settings, ingestion toggles (with always-on info note), agent config (LLM selector, custom instructions), language preference
14. **File detail / playback page** — split view (preview + metadata panel), PDF viewer (pdf.js), text/code viewer, image viewer, editable metadata, document structure sidebar, processing status
15. **User settings** — profile page (name, avatar), account settings

### Phase 5: Processing Pipeline
16. **Processing job system** — DB-backed job queue, async worker, status tracking, SSE events for real-time progress
17. **Text extractors** — PDF (PyMuPDF), DOCX (python-docx), TXT/MD, CSV, XLSX (openpyxl)
18. **LLM integration** — abstracted provider interface, Ollama implementation, summary generation, structure extraction
19. **BM25 + fuzzy indexing** — tsvector generation, pg_trgm indexing
20. **Processing status UI** — step-by-step progress in upload panel, retry on failure, file status indicators in browser

### Phase 6: Search & Navigation Polish
21. **Search backend** — BM25 + fuzzy endpoint with filters (file type, folder scope, tags)
22. **Search UI** — search page, filter bar, highlighted result snippets, click-to-navigate
23. **Navigation polish** — responsive design pass, loading skeletons, error boundaries, 404 page, keyboard shortcuts, command palette
24. **Landing page** — simple marketing page (hero, features, CTA, demo screenshot)

### Phase 7: AI Agent (Last)
25. **Pydantic AI agent** — core setup, 4 tool definitions (browse, get_info, search, read), tool implementations
26. **Streaming SSE endpoint** — FastAPI SSE route, streams agent responses + tool calls in real time
27. **System prompt builder** — dynamic context injection based on user location in workspace
28. **Context management** — context offloading middleware, token counting, message compression, session load/save/continue
29. **Chat UI** — full page + slide-over panel, streaming messages, tool call cards (collapsible), status indicators, input bar, session list sidebar
30. **Chat polish** — session auto-titling, session search, keyboard shortcuts, scroll behavior

---

## 17. Discussion Log

*Decisions finalized through discussion are recorded here.*

> **Format:** `[date] Topic — Decision made, reasoning`

- `[2026-02-25] Name — Archiva.ai. "Archive + AI". Domain available, no direct competitor conflict. Professional, communicates CMS + intelligence.`
- `[2026-02-25] Backend — FastAPI (Python 3.12+). Fully async. No debate.`
- `[2026-02-25] Frontend — Next.js 15 + TypeScript + shadcn/ui + Tailwind CSS. Dark theme, minimal, dashboard-style (Notion/Linear vibe). User has 0% web frontend experience — Claude Code owns full responsibility for frontend implementation. ALL frontend code must follow: strict TypeScript (no any), component-based architecture, fully responsive, accessible (a11y), highly maintainable, configurable via props/constants (no hardcoded values), consistent naming conventions, proper error boundaries, loading states everywhere, clean separation of concerns (components / hooks / lib / stores). Code must be production-grade from day 1 — no shortcuts, no "fix later" comments.`
- `[2026-02-25] Database — Supabase (PostgreSQL + pgvector + Auth + Storage). NOT using Supabase JS client or PostgREST for data queries — connecting directly via asyncpg from FastAPI for maximum speed. Supabase used for: hosting Postgres, Auth (JWT), Storage (CDN + signed URLs), Dashboard (visual admin). If performance becomes an issue on Pro plan, migrate DB to self-hosted Postgres — zero code changes since we use standard asyncpg, not Supabase-specific queries.`
- `[2026-02-25] Cache — Redis (Upstash) planned for later, NOT in MVP. Skip for now, Postgres with proper indexes is enough initially. Add when: repeated data access patterns emerge, multiple users hitting same data, or rate limiting needed.`
- `[2026-02-25] Storage Architecture — Three layers:`
  - `Connectors (user's raw files): v1 = Google Drive (post-MVP). Later = OneDrive, Dropbox. Abstracted via StorageConnector interface.`
  - `Backend storage (raw files): MVP = Cloudflare R2 (10GB free, zero egress). Abstracted via StorageBackend interface.`
  - `Processed data (chunks, metadata): ALWAYS Supabase PostgreSQL.`
- `[2026-02-25] LLM Providers — Abstracted from day 1. v1: Ollama + vLLM. Later: Gemini, OpenAI, Groq. Model not locked — best available agentic LLM at runtime.`
- `[2026-02-25] Agent Framework — Pydantic AI (not LangGraph). Claude Code-style loop, not graph-based workflows. LLM decides tool order via tool selection. PII/transcription/translation are services behind tools, not nodes. Sophisticated features (HITL, subagents, context offloading) built as custom middleware.`
- `[2026-02-26] Search & Retrieval Strategy — Layered approach. Scope narrowing first, then search. MVP: BM25 (tsvector) + fuzzy (pg_trgm) + LLM summaries + structure. No vectors in MVP.`
- `[2026-02-26] Agent Tools (V1) — 4 tools: browse, get_info, search, read. Minimal params, Pydantic AI validates + auto-retries.`
- `[2026-02-26] Workspace Model — Workspaces in v1. Org → Workspaces → Folders → Files. Fully isolated, no cross-workspace queries. workspace_id injected via session context, not a tool param.`
- `[2026-02-26] System Prompt — Dynamic injection per turn. Location context (workspace/folder/file), counts not listings, rules, user preferences.`
- `[2026-02-26] Context Offloading — Middleware before each LLM call. Keep: system prompt + last 10 messages + key facts. Compress older messages. Drop old tool results.`
- `[2026-02-26] Tool Result Management — Tools return plain text strings (not structured JSON). read: 5000 chars, search: 20 results, browse: 50 items max, get_info: naturally small. Pagination hints embedded in text output.`
- `[2026-02-26] Session Management — New: fresh. Continue: load all if fits, only compressed if previously compacted. All messages stored in DB.`
- `[2026-02-26] Subagents — Deferred.`
- `[2026-02-26] Artifacts — v2. ACT tools (publish_artifact) + TRIGGER tools (trigger_service).`
- `[2026-02-26] Ingest Pipeline — Multi-step async processing. Auto-ingest default, manual mode available. Always-on: text extraction + BM25 + fuzzy (shown as info note, not toggles). Optional: summary, structure, tables, transcription, image/video description. DB-backed job queue, async worker in FastAPI process, 3 concurrent files. Retry 3x with backoff. Partial success allowed (optional steps can fail). Processing LLM can differ from agent LLM.`
- `[2026-02-26] Auth — Supabase Auth. Email/password + magic link + Google OAuth. Auto-create org + workspace on signup. Single-user in MVP, schema ready for multi-tenant.`
- `[2026-02-26] Frontend — Dark theme, Notion/Linear vibe. /app/[workspaceId]/... routes. Sidebar nav + topbar breadcrumbs. Chat: slide-over panel only (no standalone page), context-aware. File browser: table view. Zustand + TanStack Query.`
- `[2026-02-26] Database Schema — Full schema designed: profiles, organizations, workspaces, folders, files, file_contents, file_tables, tags, file_tags, processing_jobs, agent_sessions, agent_messages. Indexes for BM25 (GIN tsvector), fuzzy (GIN pg_trgm), materialized paths.`
- `[2026-02-26] Deployment — Local: Docker Compose + Supabase CLI. Production: Railway (backend) + Vercel (frontend) + Supabase cloud + R2. CI: GitHub Actions. Estimated $0-15/mo for MVP.`
- `[2026-02-26] MVP Build Order — 5 phases, 27 steps: Foundation → File Management → Processing Pipeline → AI Agent → Search & Polish.`
