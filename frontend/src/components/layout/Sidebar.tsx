"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FolderClosed,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useUIStore } from "@/stores/ui-store";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Files", href: "", icon: FolderClosed },
  { label: "Activity", href: "/activity", icon: ListChecks },
];

interface SidebarProps {
  workspaceId: string;
}

export function Sidebar({ workspaceId }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/app/${workspaceId}`;
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-[var(--overlay-6)] bg-sidebar transition-[width] duration-200",
        sidebarCollapsed ? "w-[56px]" : "w-[220px]",
      )}
    >
      {/* Brand row with collapse toggle */}
      <div className="flex h-12 shrink-0 items-center gap-1 px-2">
        <button
          onClick={toggleSidebar}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--overlay-6)] hover:text-foreground"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
        {!sidebarCollapsed && (
          <Link href="/app" className="ml-0.5">
            <Logo className="h-7" />
          </Link>
        )}
      </div>

      {/* Workspace switcher */}
      {!sidebarCollapsed && (
        <div className="px-1.5 pb-2">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const fullHref = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath ||
                pathname.startsWith(`${basePath}/folder`)
              : pathname.startsWith(fullHref);

          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={fullHref}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                sidebarCollapsed
                  ? "justify-center px-2 py-2"
                  : "gap-2.5 px-3 py-2",
                "text-[13px] font-medium",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--overlay-6)] px-2 py-2">
        <Link
          href={`${basePath}/settings`}
          title={sidebarCollapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center rounded-lg transition-colors",
            sidebarCollapsed
              ? "justify-center px-2 py-2"
              : "gap-2.5 px-3 py-2",
            "text-[13px] font-medium",
            pathname.includes("/settings")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!sidebarCollapsed && "Settings"}
        </Link>
      </div>
    </aside>
  );
}
