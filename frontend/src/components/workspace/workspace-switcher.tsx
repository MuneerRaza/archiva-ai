"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/lib/queries/workspaces";

export function WorkspaceSwitcher() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useWorkspaces();

  const workspaces = data?.data ?? [];
  const current = workspaces.find((w) => w.id === params.workspaceId);

  function handleSelect(workspaceId: string) {
    setOpen(false);
    if (workspaceId !== params.workspaceId) {
      router.push(`/app/${workspaceId}`);
    }
  }

  if (isLoading) {
    return <Skeleton className="mx-3 h-8 rounded-md" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="mx-1.5 h-8 w-full justify-between px-2.5 text-[13px] font-medium"
        >
          <span className="truncate">
            {current?.name ?? "Select workspace"}
          </span>
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-1" align="start">
        <div className="space-y-0.5">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                ws.id === params.workspaceId
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-[var(--overlay-4)] hover:text-foreground",
              )}
            >
              {ws.id === params.workspaceId && (
                <Check className="h-3.5 w-3.5 shrink-0" />
              )}
              <span
                className={cn(
                  "truncate",
                  ws.id !== params.workspaceId && "ml-[22px]",
                )}
              >
                {ws.name}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
