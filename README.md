# Archiva AI

**An AI agent that reasons over your organization's documents — not a search tool, a reasoning system.**

Most document AI tools rely on embedding-based RAG: chunk your files, store vectors, retrieve the top-k similar chunks, and hope the answer is in there. This approach is noisy, loses context, pollutes the LLM with irrelevant content, and falls apart on complex queries that require cross-document reasoning.

Archiva AI takes a fundamentally different approach. **No embeddings. No vector database. No chunking.** Instead, an autonomous tool-calling agent navigates your document corpus the way a human researcher would — browsing folders, reading specific files, searching for relevant content, and pulling exactly what it needs. The LLM only sees what it asks for, resulting in precise, grounded answers with zero pollution.

## Why No Embeddings?

| Embedding-based RAG | Archiva AI |
|---|---|
| Chunks documents, losing structure and context | Reads full documents on demand, preserving context |
| Retrieves top-k similar chunks — noisy, often irrelevant | Agent decides what to read — precise, no pollution |
| Cannot compare two documents side by side | Reads both documents, performs structured comparison |
| Fails on multi-hop reasoning across files | Agent chains tool calls — browse → search → read → reason |
| Slow ingestion — embedding pipelines take minutes/hours | Upload and start querying in seconds |
| Requires vector DB infrastructure (Pinecone, Qdrant, etc.) | Just PostgreSQL — no extra infrastructure |

## How the Agent Works

The agent has four tools and complete autonomy over how to use them:

```
browse   → Navigate folders, list files, understand what data exists
search   → Full-text search across all documents in a workspace
get_info → Get file metadata, summaries, structure, tags
read     → Read file content with pagination and in-document search
```

For a query like *"Compare the liability clauses in Contract A vs Contract B"*, the agent:
1. **Searches** for both contracts by name
2. **Reads** Contract A, finds the liability section
3. **Reads** Contract B, finds the liability section
4. **Reasons** over both — produces a structured comparison

Every tool call is streamed to the UI in real time, so you see exactly how the agent arrives at its answer.

## Features

- **Cross-document reasoning** — compare cases, find contradictions, trace references across hundreds of files
- **Fast ingestion** — upload documents and start researching immediately, no embedding pipeline
- **Transparent reasoning** — every tool call the agent makes is visible in real time
- **Workspace-based organization** — separate workspaces for different projects or teams
- **Broad file support** — PDF, DOCX, XLSX, CSV, images, audio, video, code files, and more
- **Auto-processing** — documents are summarized, structured, and indexed on upload
- **Configurable LLM** — plug in any provider (Ollama, vLLM, OpenAI, Anthropic, Gemini) per workspace
- **Full-text search** — PostgreSQL-powered search with fuzzy matching across your entire corpus

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | FastAPI, Python 3.12+, asyncpg, Pydantic AI |
| **Frontend** | Next.js 15 (App Router), TypeScript, shadcn/ui, Tailwind CSS |
| **State** | Zustand, TanStack Query |
| **Database** | Supabase PostgreSQL |
| **Storage** | Cloudflare R2 |
| **Auth** | Supabase Auth (JWT) |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    Frontend                       │
│          Next.js 15 · TypeScript · shadcn         │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│                   Backend API                     │
│             FastAPI · Async · Pydantic            │
├───────────┬───────────┬───────────┬──────────────┤
│   Auth    │   Files   │   Agent   │   Search     │
│  Service  │  Service  │  Service  │   Service    │
└─────┬─────┴─────┬─────┴─────┬─────┴──────┬──────┘
      │           │           │            │
      ▼           ▼           ▼            ▼
┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
│ Supabase │ │   R2    │ │   LLM   │ │PostgreSQL│
│   Auth   │ │ Storage │ │Provider │ │   FTS    │
└──────────┘ └─────────┘ └─────────┘ └──────────┘
```

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker
- `uv` (Python package manager)
- `pnpm` (frontend package manager)

### Setup
```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend
cd frontend
pnpm install
pnpm dev
```

Or with Docker:
```bash
docker-compose up
```

## Roadmap
- Multi-tenant organization management (teams, roles, invitations)
- Agent memory across sessions
- Scheduled agent tasks and reports