"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Files", href: "", icon: "folder" },
  { label: "Chat", href: "/chat", icon: "message" },
  { label: "Search", href: "/search", icon: "search" },
] as const;

interface SidebarProps {
  workspaceId: string;
}

export function Sidebar({ workspaceId }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/app/${workspaceId}`;

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 items-center px-4">
        <Link href="/app" className="text-lg font-semibold tracking-tight">
          Archiva
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const fullHref = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath || pathname.startsWith(`${basePath}/folder`)
              : pathname.startsWith(fullHref);

          return (
            <Link
              key={item.label}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <NavIcon name="settings" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
    message:
      "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    search:
      "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    settings:
      "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  };

  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={icons[name]} />
    </svg>
  );
}
