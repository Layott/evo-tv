"use client";

import * as React from "react";
import type { ChatMessage } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pin, Trash2, Ban } from "@/components/icons";
import { toast } from "sonner";
import { pinMessage, deleteMessage, banFromChat } from "@/lib/client";

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function roleColor(role: ChatMessage["userRole"]) {
  if (role === "admin") return "text-sky-300";
  if (role === "premium") return "text-amber-300";
  return "text-foreground";
}

/**
 * A display name that always exists.
 *
 * `userHandle` is typed as a string but is not one: a profile only gets a
 * handle when the user sets one, and the optimistic message the chat box adds
 * before the server replies copies that null straight through. Rendering it hit
 * `null.slice(0, 2)` and threw inside React, which unmounts the whole tree, so
 * typing one message took the entire page down.
 */
/**
 * What the server said, when it said anything.
 *
 * Three catch blocks printed a fixed sentence, so "you are not a moderator",
 * "that person is already banned" and "the message no longer exists" all read
 * as "Could not ban user" and none of them could be told apart from a bug.
 */
function reason(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message.trim() : "";
  return message.length > 0 && message.length < 160 ? message : fallback;
}

function displayHandle(handle: string | null | undefined): string {
  return handle?.trim() || "viewer";
}

export function MessageItem({
  msg,
  isAdmin,
}: {
  msg: ChatMessage;
  isAdmin: boolean;
}) {
  const [pinned, setPinned] = React.useState(msg.isPinned);
  const [deleted, setDeleted] = React.useState(msg.isDeleted);
  const [banned, setBanned] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handlePin() {
    if (busy) return;
    setBusy(true);
    setPinned((prev) => !prev);
    try {
      await pinMessage({ streamId: msg.streamId, messageId: msg.id });
      toast.success(pinned ? "Message unpinned" : "Message pinned");
    } catch (err) {
      setPinned((prev) => !prev);
      toast.error(reason(err, "Could not pin message"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setDeleted(true);
    try {
      await deleteMessage({ streamId: msg.streamId, messageId: msg.id });
      toast.success("Message deleted");
    } catch (err) {
      setDeleted(false);
      toast.error(reason(err, "Could not delete message"));
    } finally {
      setBusy(false);
    }
  }

  async function handleBan() {
    if (busy) return;
    setBusy(true);
    try {
      await banFromChat({ streamId: msg.streamId, messageId: msg.id, hours: 24 });
      setBanned(true);
      setDeleted(true);
      toast.error(`Banned ${displayHandle(msg.userHandle)} for 24h`);
    } catch (err) {
      toast.error(reason(err, "Could not ban user"));
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <div className="px-3 py-1.5 text-xs italic text-muted-foreground">
        {banned ? `[${displayHandle(msg.userHandle)} banned · message removed]` : "[message removed]"}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "group flex gap-2 px-3 py-1.5 hover:bg-accent/60 rounded-md transition-colors",
        // A pinned message is a deeper fill. It was a 10% wash with an amber
        // stripe down the left, which is the accent bar the rules name outright.
        pinned && "bg-amber-500/25"
      )}
      title={fmtTime(msg.createdAt)}
    >
      <Avatar className="size-6 flex-shrink-0">
        <AvatarImage src={msg.userAvatarUrl} alt={displayHandle(msg.userHandle)} />
        <AvatarFallback className="text-[10px]">
          {displayHandle(msg.userHandle).slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className={cn("text-xs font-semibold mr-1.5", roleColor(msg.userRole))}>
          {displayHandle(msg.userHandle)}
          {msg.userRole === "premium" && (
            <span className="ml-1 text-[9px] text-amber-400">
              prem
            </span>
          )}
          {msg.userRole === "admin" && (
            <span className="ml-1 text-[9px] text-sky-400">
              admin
            </span>
          )}
          <span className="text-muted-foreground font-normal">:</span>
        </span>
        <span className="text-sm text-foreground break-words">{msg.body}</span>
      </div>
      {isAdmin && (
        <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon-sm"
            variant="ghost"
            className={cn("size-6", pinned && "text-amber-400")}
            onClick={handlePin}
            disabled={busy}
            aria-label={pinned ? "Unpin" : "Pin"}
            aria-pressed={pinned}
          >
            <Pin className="size-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-6"
            onClick={handleDelete}
            disabled={busy}
            aria-label="Delete"
          >
            <Trash2 className="size-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-6 text-red-400"
            onClick={handleBan}
            disabled={busy}
            aria-label="Ban user"
          >
            <Ban className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
