export type ViewerType =
  | "pdf"
  | "image"
  | "text"
  | "markdown"
  | "code"
  | "media"
  | "spreadsheet"
  | "excel"
  | "document"
  | "fallback";

const TEXT_TYPES = new Set([
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
]);

const CODE_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".rb",
  ".php",
  ".sh",
  ".bash",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".sql",
  ".graphql",
  ".vue",
  ".svelte",
  ".swift",
  ".kt",
  ".r",
  ".lua",
  ".zig",
  ".env",
]);

const EXCEL_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

const DOCUMENT_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
]);

export function getViewerType(mimeType: string, fileName: string): ViewerType {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/"))
    return "media";

  // Excel / spreadsheet
  if (EXCEL_TYPES.has(mimeType)) return "excel";
  if (mimeType === "text/csv") return "spreadsheet";

  // Word documents
  if (DOCUMENT_TYPES.has(mimeType)) return "document";

  // Markdown
  if (mimeType === "text/markdown" || fileName.endsWith(".md"))
    return "markdown";

  const ext = fileName.includes(".")
    ? `.${fileName.split(".").pop()?.toLowerCase()}`
    : "";

  // Code files by extension
  if (CODE_EXTENSIONS.has(ext)) return "code";

  // Text types
  if (TEXT_TYPES.has(mimeType) || mimeType.startsWith("text/")) return "text";

  return "fallback";
}

export type PIIModality =
  | "text"
  | "document"
  | "spreadsheet"
  | "image"
  | "audio"
  | "video";

/** Map a file's MIME type to the PII detection modality. */
export function piiModalityForMime(mimeType: string, fileName: string): PIIModality {
  if (mimeType === "application/pdf") return "document";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (EXCEL_TYPES.has(mimeType) || mimeType === "text/csv") return "spreadsheet";
  if (DOCUMENT_TYPES.has(mimeType)) return "document";
  void fileName;
  return "text";
}

/** Map file extension to shiki language ID for syntax highlighting */
export function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.split(".").pop()?.toLowerCase() ?? ""
    : "";

  const map: Record<string, string> = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    rb: "ruby",
    php: "php",
    sh: "bash",
    bash: "bash",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "ini",
    sql: "sql",
    graphql: "graphql",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    vue: "vue",
    svelte: "svelte",
    swift: "swift",
    kt: "kotlin",
    r: "r",
    lua: "lua",
    zig: "zig",
    md: "markdown",
  };

  return map[ext] ?? "text";
}
