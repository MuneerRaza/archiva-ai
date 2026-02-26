"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-2">
        {title && (
          <h1 className="text-sm font-medium text-foreground">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
