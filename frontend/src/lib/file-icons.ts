import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  Presentation,
  type LucideIcon,
} from "lucide-react";

const MIME_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  // Documents
  "application/pdf": { icon: FileText, color: "text-red-400" },
  "application/msword": { icon: FileText, color: "text-blue-400" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { icon: FileText, color: "text-blue-400" },
  "text/plain": { icon: FileText, color: "text-gray-400" },
  "text/markdown": { icon: FileText, color: "text-gray-400" },
  "application/rtf": { icon: FileText, color: "text-blue-300" },

  // Spreadsheets
  "application/vnd.ms-excel": { icon: FileSpreadsheet, color: "text-green-400" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { icon: FileSpreadsheet, color: "text-green-400" },
  "text/csv": { icon: FileSpreadsheet, color: "text-green-400" },

  // Presentations
  "application/vnd.ms-powerpoint": { icon: Presentation, color: "text-orange-400" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { icon: Presentation, color: "text-orange-400" },

  // Archives
  "application/zip": { icon: FileArchive, color: "text-yellow-400" },
  "application/x-tar": { icon: FileArchive, color: "text-yellow-400" },
  "application/gzip": { icon: FileArchive, color: "text-yellow-400" },
  "application/x-rar-compressed": { icon: FileArchive, color: "text-yellow-400" },
  "application/x-7z-compressed": { icon: FileArchive, color: "text-yellow-400" },

  // Code
  "application/json": { icon: FileCode, color: "text-yellow-300" },
  "application/xml": { icon: FileCode, color: "text-orange-300" },
  "text/html": { icon: FileCode, color: "text-orange-300" },
  "text/css": { icon: FileCode, color: "text-blue-300" },
  "text/javascript": { icon: FileCode, color: "text-yellow-300" },
  "application/javascript": { icon: FileCode, color: "text-yellow-300" },
};

const PREFIX_MAP: { prefix: string; icon: LucideIcon; color: string }[] = [
  { prefix: "image/", icon: FileImage, color: "text-purple-400" },
  { prefix: "video/", icon: FileVideo, color: "text-pink-400" },
  { prefix: "audio/", icon: FileAudio, color: "text-cyan-400" },
  { prefix: "text/", icon: FileText, color: "text-gray-400" },
];

const DEFAULT_ICON = { icon: File, color: "text-muted-foreground" };

export function getFileIcon(mimeType: string): { icon: LucideIcon; color: string } {
  const exact = MIME_ICON_MAP[mimeType];
  if (exact) return exact;

  for (const entry of PREFIX_MAP) {
    if (mimeType.startsWith(entry.prefix)) {
      return { icon: entry.icon, color: entry.color };
    }
  }

  return DEFAULT_ICON;
}
