"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameFolder } from "@/lib/queries/folders";
import { useUpdateFile } from "@/lib/queries/files";

interface RenameDialogProps {
  workspaceId: string;
  type: "file" | "folder";
  targetId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({
  workspaceId,
  type,
  targetId,
  currentName,
  open,
  onOpenChange,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const renameFolder = useRenameFolder(workspaceId);
  const updateFile = useUpdateFile(workspaceId);
  const isPending = renameFolder.isPending || updateFile.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) return;

    const onSuccess = () => {
      onOpenChange(false);
    };

    if (type === "folder") {
      renameFolder.mutate(
        { folderId: targetId, name: name.trim() },
        { onSuccess },
      );
    } else {
      updateFile.mutate(
        { fileId: targetId, data: { name: name.trim() } },
        { onSuccess },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename {type}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onFocus={(e) => {
                // Select filename without extension for files
                if (type === "file") {
                  const dotIdx = e.target.value.lastIndexOf(".");
                  if (dotIdx > 0) {
                    e.target.setSelectionRange(0, dotIdx);
                  } else {
                    e.target.select();
                  }
                } else {
                  e.target.select();
                }
              }}
            />
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName || isPending}
            >
              {isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
