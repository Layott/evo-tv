"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "@/components/icons";

const GAMING_EMOJIS = [
  "🔥", "💀", "👑", "🏆", "🎯", "🚀",
  "⚡", "💯", "🎮", "🏹", "🛡️", "⚔️",
  "😂", "😱", "👀", "🙌",
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Emoji"
        >
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-56 p-2 bg-card border-border"
      >
        <div className="grid grid-cols-8 gap-1">
          {GAMING_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="text-lg h-8 w-8 flex items-center justify-center rounded hover:bg-accent"
              aria-label={`Insert ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
