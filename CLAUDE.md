# Archiva.ai — Project Instructions

## Project Overview
AI-powered CMS where an agent reasons over organizational documents. See `PLAN.md` for full architecture and decisions.

## Tooling
- **Python package manager:** `uv` — always use `uv add` to install packages and `uv run` to execute Python commands
- **Frontend package manager:** `pnpm`

## Tech Stack
- **Backend:** FastAPI (Python 3.12+), asyncpg, Pydantic AI, Cloudflare R2
- **Frontend:** Next.js 15 (App Router), TypeScript, shadcn/ui, Tailwind CSS, Zustand, TanStack Query
- **Database:** Supabase PostgreSQL + pg_trgm (no pgvector in MVP)
- **Auth:** Supabase Auth (JWT)
- **LLM:** Ollama / vLLM (abstracted)

## Build Order (Current Phase: Foundation)
1. Foundation (scaffolding, architecture, config)
2. Backend core + Frontend core (parallel)
3. Auth (Supabase integration)
4. Workspace management, permissions, roles
5. File upload, settings, playback pages, heavy UI/UX
6. Navigation polish, optimization, upload/viewing refinement
7. Agent (last — after everything else works)

---

## Python / Backend Rules

### Code Quality — Non-Negotiable
- **Pydantic models everywhere.** No raw dicts for structured data. Ever. Use `BaseModel`, `dataclass`, or `TypedDict` — prefer `BaseModel`.
- **No `.get()` / `getattr()` / `hasattr()` for known structures.** Use `.dot` access on typed objects. If you're reaching for `.get()`, you need a model.
- **Strict typing.** Every function has full type hints — params and return. No `Any` unless interfacing with genuinely untyped externals. Use `TypeVar`, `Generic`, `Protocol` where appropriate.
- **No `# type: ignore`** without a comment explaining why.
- **Enums over magic strings.** Status codes, roles, file types — all `StrEnum` or `IntEnum`.
- **Result types over exceptions for expected failures.** Use a `Result[T, E]` pattern or explicit return types for operations that can fail in expected ways. Exceptions for unexpected/programmer errors only.

### Architecture
- **Service layer pattern.** Routes → Services → Database. Routes are thin (validation + delegation). Business logic lives in services. No SQL in routes.
- **Dependency injection via FastAPI `Depends()`.** No global state. No module-level singletons except config.
- **Repository pattern for DB access.** Each domain has a repository class. Raw SQL lives only in repositories. Services never write SQL.
- **Abstract base classes for swappable components.** `StorageBackend`, `LLMProvider`, `Extractor` — all ABC with concrete implementations. New providers = new class, zero changes to existing code.
- **Config via Pydantic Settings.** All env vars validated at startup. App crashes on missing config, not at runtime. Nested settings for logical grouping (`settings.database.url`, `settings.r2.bucket`).

### Async
- **Async all the way.** No `sync_to_async` wrappers, no thread pool hacks. If a library doesn't support async, find one that does or wrap it properly in `asyncio.to_thread()` with a comment.
- **Connection pooling.** asyncpg pool created at startup, shared via dependency injection. Never create connections per-request.
- **No blocking I/O in async functions.** File reads, HTTP calls, DB queries — all async. Use `aiofiles` for filesystem if needed.

### Error Handling & Logging
- **Structured logging from day 1.** Use `structlog`. JSON output in production, pretty console in dev. Every log line includes context (request_id, user_id, workspace_id).
- **Request ID on every request.** Middleware generates UUID, attaches to all logs and responses. Traceable end-to-end.
- **Custom exception hierarchy.** `ArchivaError` base → `NotFoundError`, `PermissionError`, `ValidationError`, `StorageError`, `ProcessingError`, `LLMError`. Each has status code, error code, user message. Global exception handler maps to HTTP responses.
- **No bare `except:`.** Always catch specific exceptions. Log the full traceback with `logger.exception()`.
- **No silent failures.** Every caught exception is either re-raised, logged, or returned as a typed error.

### Performance
- **Bulk operations over loops.** Insert 100 rows in one query, not 100 queries. Use `executemany` / `COPY` / unnest patterns.
- **Lazy loading.** Don't fetch related data unless needed. Use explicit `include` params.
- **Pagination everywhere.** No unbounded queries. Every list endpoint has `limit` + `offset` with sane defaults and max caps.
- **Query optimization.** Explain analyze on complex queries. Use indexes intentionally (see schema). Avoid N+1.
- **Streaming responses for large data.** SSE for agent, streaming for file downloads. Never buffer entire large responses in memory.

### Code Style
- **snake_case** for everything Python (functions, variables, files, modules).
- **Imports:** stdlib → third-party → local, separated by blank lines. Absolute imports only.
- **One class per file** for models, services, repositories. Utils can be grouped.
- **No comments for obvious code.** Comments explain WHY, not WHAT. If code needs a WHAT comment, refactor it.
- **Docstrings on public APIs only.** Services, route handlers. Not on private methods, not on obvious CRUD.
- **Constants in UPPER_SNAKE_CASE.** In a dedicated `constants.py` or at module top.

---

## TypeScript / Frontend Rules

### Code Quality — Non-Negotiable
- **Strict TypeScript.** `strict: true` in tsconfig. Zero `any`. Zero `@ts-ignore`. Zero `as` type assertions unless proven safe with a comment.
- **Interface/type for all data shapes.** No inline object types repeated in multiple places. Define once in `types/`, import everywhere.
- **Zod for runtime validation** at API boundaries. API responses validated before use. Don't trust the backend blindly from the client.
- **No `undefined` checks with `?.` chains deeper than 2 levels.** If you need `a?.b?.c?.d`, your types are wrong or you need a guard/loader.
- **Explicit return types on all exported functions.** Let inference work for internal/simple functions, but exports are typed.

### Component Architecture
- **Server Components by default.** Only add `"use client"` when the component genuinely needs browser APIs, event handlers, or hooks.
- **Small, focused components.** If a component file exceeds ~150 lines, split it. If a component takes more than 5 props, consider composition.
- **Props interfaces, not inline types.** `interface FileBrowserProps { ... }` — named, exported, reusable.
- **No prop drilling beyond 2 levels.** Use Zustand stores or React Context for deeply shared state.
- **Composition over configuration.** Prefer `<Card><CardHeader>` over `<Card header="..." />`. Slots > props for complex layouts.
- **Every component handles:** loading state (skeleton), error state (error boundary or inline), empty state (helpful message + CTA). No blank screens.

### State Management
- **TanStack Query for ALL server state.** Fetching, caching, revalidation, optimistic updates. No manual fetch + useState patterns.
- **Zustand for client-only UI state.** Sidebar open/closed, current selection, upload queue. Keep stores small and focused.
- **No redundant state.** If it's derivable, derive it. Use `useMemo` / selectors. Don't store `filteredItems` if you have `items` + `filter`.
- **Optimistic updates for mutations.** Show the result immediately, reconcile on server response. Makes UI feel instant.

### Styling
- **Tailwind CSS only.** No CSS modules, no styled-components, no inline styles. Zero custom CSS files unless absolutely necessary (third-party overrides).
- **shadcn/ui as component foundation.** Customize via Tailwind, don't fork. Use CSS variables for theming.
- **Consistent spacing.** Use Tailwind's spacing scale (p-2, p-4, gap-3). No arbitrary values unless pixel-perfect alignment requires it.
- **Dark theme first.** Design in dark, ensure light works. Use `dark:` variants.
- **Responsive from day 1.** Mobile-first breakpoints. Every page works on 375px width minimum.

### Performance
- **Dynamic imports for heavy components.** PDF viewer, code editor, charts — lazy load with `next/dynamic`.
- **Image optimization.** Always use `next/image`. Never raw `<img>`.
- **Memoize expensive renders.** `React.memo` for list items, `useMemo` for expensive computations. Don't over-memoize simple components.
- **Virtual scrolling for long lists.** File browser with 1000+ items? Use `@tanstack/react-virtual`.
- **Debounce user input.** Search, filter, resize handlers — debounce 200-300ms.
- **No layout shift.** Reserve space for async content with skeletons. Explicit `width`/`height` on media.

### Code Style
- **camelCase** for variables/functions, **PascalCase** for components/types, **UPPER_SNAKE_CASE** for constants.
- **Named exports only.** No `export default`. Enables better refactoring and tree-shaking.
- **File naming:** `kebab-case.ts` for utilities, `PascalCase.tsx` for components. Match the primary export.
- **Barrel exports (`index.ts`) only at feature boundaries**, not in every folder.
- **Imports:** React/Next → third-party → `@/components` → `@/hooks` → `@/lib` → `@/stores` → `@/types` → relative. Use `@/` path alias.

### Accessibility
- **Semantic HTML.** `<button>` not `<div onClick>`. `<nav>`, `<main>`, `<aside>`, `<section>`.
- **Keyboard navigation.** Every interactive element focusable and operable via keyboard. Tab order logical.
- **ARIA labels on icon-only buttons.** Screen readers can't see icons.
- **Color is never the only indicator.** Use icons, text, or patterns alongside color for status.
- **Focus visible outlines.** Never `outline-none` without a visible replacement.

---

## Shared Rules (Both Frontend & Backend)

### Git
- **Conventional commits.** `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`. Lowercase, imperative mood, max 72 chars.
- **No co-author lines** in commit messages.
- **One logical change per commit.** Don't mix refactoring with features.

### File Organization
- **Feature-based grouping** where possible. `/services/processing/` not `/services/all-services.py`.
- **Shared types/constants co-located** at the boundary where they're shared.
- **No circular imports.** If A imports B and B needs A, extract the shared part to C.
- **Delete dead code.** No commented-out blocks, no unused imports, no "just in case" code.

### API Contract
- **Backend and frontend share API types.** Backend defines Pydantic response models. Frontend defines matching TypeScript interfaces. Keep them in sync manually (no codegen in MVP, but types MUST match).
- **Consistent API response envelope:**
  ```
  Success: { data: T }
  Error: { error: { code: string, message: string, details?: any } }
  List: { data: T[], pagination: { total: number, limit: number, offset: number, has_more: boolean } }
  ```
- **RESTful conventions.** `GET /workspaces`, `POST /workspaces`, `GET /workspaces/:id`, `PATCH /workspaces/:id`, `DELETE /workspaces/:id`.
- **Status codes mean things.** 200 success, 201 created, 204 no content, 400 bad request, 401 unauthorized, 403 forbidden, 404 not found, 409 conflict, 422 validation error, 500 server error.

### Security
- **Never log secrets, tokens, or passwords.** Scrub sensitive fields in structured logging.
- **Validate at boundaries.** Backend validates every request (Pydantic). Frontend validates every response (Zod). Don't trust either direction.
- **SQL injection impossible** — asyncpg uses parameterized queries. Never string-format SQL.
- **XSS impossible** — React escapes by default. Never use `dangerouslySetInnerHTML` without sanitization.
- **CORS configured explicitly.** Only allow known origins. No wildcards in production.

### Testing (When We Get There)
- **Backend:** pytest + pytest-asyncio. Test services, not routes. Mock external services (R2, LLM).
- **Frontend:** Vitest + Testing Library. Test behavior, not implementation. No snapshot tests.
- **No test for the sake of testing.** Test business logic, edge cases, error paths. Don't test that React renders a div.
