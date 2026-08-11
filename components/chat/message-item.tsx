"use client";

import * as React from "react";
import type { ChatMessage } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pin, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { pinMessage, deleteMessage, banUser } from "@/lib/client";

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
  return "text-neutral-200";
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
      await pinMessage(msg.id, msg.userHandle);
      toast.success(pinned ? "Message unpinned" : "Message pinned");
    } catch {
      setPinned((prev) => !prev);
      toast.error("Could not pin message");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setDeleted(true);
    try {
      await deleteMessage(msg.id, msg.userHandle);
      toast.success("Message deleted");
    } catch {
      setDeleted(false);
      toast.error("Could not delete message");
    } finally {
      setBusy(false);
    }
  }

  async function handleBan() {
    if (busy) return;
    setBusy(true);
    try {
      await banUser(msg.streamId, msg.userId, 24);
      setBanned(true);
      setDeleted(true);
      toast.error(`Banned ${msg.userHandle} for 24h`);
    } catch {
      toast.error("Could not ban user");
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <div className="px-3 py-1.5 text-xs italic text-neutral-500">
        {banned ? `[${msg.userHandle} banned · message removed]` : "[message removed]"}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "group flex gap-2 px-3 py-1.5 hover:bg-neutral-900/60 rounded-md transition-colors",
        pinned && "bg-amber-500/10 border-l-2 border-amber-400"
      )}
      title={fmtTime(msg.createdAt)}
    >
      <Avatar className="size-6 flex-shrink-0">
        <AvatarImage src={msg.userAvatarUrl} alt={msg.userHandle} />
        <AvatarFallback className="text-[10px]">
          {msg.userHandle.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className={cn("text-xs font-semibold mr-1.5", roleColor(msg.userRole))}>
          {msg.userHandle}
          {msg.userRole === "premium" && (
            <span className="ml-1 text-[9px] uppercase tracking-wider text-amber-400">
              prem
            </span>
          )}
          {msg.userRole === "admin" && (
            <span className="ml-1 text-[9px] uppercase tracking-wider text-sky-400">
              admin
            </span>
          )}
          <span className="text-neutral-500 font-normal">:</span>
        </span>
        <span className="text-sm text-neutral-100 break-words">{msg.body}</span>
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
