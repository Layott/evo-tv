"use client";

import * as React from "react";
import type { VodChapter } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  chapters: VodChapter[];
  currentSec: number;
  onJump: (sec: number) => void;
}

function ChapterList({ chapters, currentSec, onJump }: Props) {
  const activeIdx = (() => {
    let idx = -1;
    chapters.forEach((c, i) => {
      if (c.startSec <= currentSec) idx = i;
    });
    return idx;
  })();
  return (
    <ul className="divide-y divide-border">
      {chapters.map((c, i) => (
        <li key={`${c.label}-${i}`}>
          <button
            onClick={() => onJump(c.startSec)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/70 transition-colors",
              i === activeIdx && "bg-sky-500/5 border-l-2 border-sky-500"
            )}
          >
            <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">
              {fmt(c.startSec)}
            </span>
            <span
              className={cn(
                "text-sm",
                i === activeIdx ? "text-sky-300 font-medium" : "text-foreground"
              )}
            >
              {c.label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function VodChapters({ chapters, currentSec, onJump }: Props) {
  if (!chapters || chapters.length === 0) return null;

  return (
    <>
      {/* Desktop panel */}
      <div className="hidden lg:block rounded-lg border border-border bg-background">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <List className="size-4 text-foreground/80" />
          <h3 className="text-sm font-semibold text-foreground">
            Chapters <span className="text-muted-foreground">({chapters.length})</span>
          </h3>
        </div>
        <ChapterList chapters={chapters} currentSec={currentSec} onJump={onJump} />
      </div>

      {/* Mobile accordion */}
      <div className="lg:hidden">
        <Accordion type="single" collapsible className="rounded-lg border border-border bg-background">
          <AccordionItem value="chapters" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <List className="size-4" />
                Chapters ({chapters.length})
              </span>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              <ChapterList
                chapters={chapters}
                currentSec={currentSec}
                onJump={onJump}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
