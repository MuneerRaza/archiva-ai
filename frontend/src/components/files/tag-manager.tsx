"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTags, useCreateTag, useAddTagToFile, useRemoveTagFromFile } from "@/lib/queries/tags";
import type { Tag } from "@/types/models";

interface TagManagerProps {
  workspaceId: string;
  fileId: string;
  currentTags: Tag[];
}

export function TagManager({ workspaceId, fileId, currentTags }: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const { data: allTags = [] } = useTags(workspaceId);
  const createTag = useCreateTag(workspaceId);
  const addTag = useAddTagToFile(workspaceId);
  const removeTag = useRemoveTagFromFile(workspaceId);

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !currentTagIds.has(t.id));

  function handleAddTag(tagId: string) {
    addTag.mutate({ fileId, tagId });
  }

  function handleRemoveTag(tagId: string) {
    removeTag.mutate({ fileId, tagId });
  }

  function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTag.mutate(
      { name: newTagName.trim() },
      {
        onSuccess: (res) => {
          const tag = res.data;
          addTag.mutate({ fileId, tagId: tag.id });
          setNewTagName("");
        },
      },
    );
  }

  return (
    <div className="space-y-2">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {currentTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="gap-1 text-[12px]"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Add tag popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-[12px]">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-2" align="start">
          {availableTags.length > 0 && (
            <div className="mb-2 max-h-[150px] space-y-0.5 overflow-y-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    handleAddTag(tag.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-accent"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleCreateTag} className="flex gap-1.5">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag..."
              className="h-7 text-[12px]"
            />
            <Button
              type="submit"
              size="sm"
              className="h-7"
              disabled={!newTagName.trim() || createTag.isPending}
            >
              Add
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
