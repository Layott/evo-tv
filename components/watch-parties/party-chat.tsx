"use client";

import * as React from "react";
import { Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import {
  addPartyMessage,
  listPartyMessages,
  makeIncomingPartyMessage,
  type PartyMessage,
} from "@/lib/mock/watch-parties";
import { cn } from "@/lib/utils";

const MAX_MSGS = 200;
const CHAR_LIMIT = 300;

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface PartyChatProps {
  partyId: string;
  joined: boolean;
  memberCount: number;
}

export function PartyChat({ partyId, joined, memberCount }: PartyChatProps) {
  const { user } = useMockAuth();
  const [messages, setMessages] = React.useState<PartyMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stuckToBottom = React.useRef(true);

  // Initial load
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPartyMessages(partyId).then((msgs) => {
      if (!cancelled) {
        setMessages(msgs.slice(-MAX_MSGS));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  // Ambient incoming chatter from other party-goers
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setMessages((prev) => {
        const next = [...prev, makeIncomingPartyMessage(partyId)];
        return next.length > MAX_MSGS ? next.slice(next.length - MAX_MSGS) : next;
      });
      timer = setTimeout(tick, 4_000 + Math.random() * 4_000);
    };
    timer = setTimeout(tick, 4_000 + Math.random() * 4_000);
    return () => clearTimeout(timer);
  }, [partyId]);

  // Auto-scroll
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stuckToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stuckToBottom.current = distance < 80;
  };

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }
    if (!joined) {
      toast.error("Join the party to chat");
      return;
    }
    setSending(true);
    const optimistic: PartyMessage = {
      id: `partymsg_local_${Date.now()}`,
      partyId,
      userId: user.id,
      userHandle: user.handle,
      userAvatarUrl: user.avatarUrl,
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, optimistic];
      return next.length > MAX_MSGS ? next.slice(next.length - MAX_MSGS) : next;
    });
    setInput("");
    stuckToBottom.current = true;
    try {
      await addPartyMessage(partyId, {
        userId: user.id,
        userHandle: user.handle,
        userAvatarUrl: user.avatarUrl,
        body,
      });
    } catch {
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Sparkles className="size-4 text-sky-400" />
          Party Chat
        </div>
        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
          <Users className="size-3" /> {memberCount} in room
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto py-1"
      >
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="size-6 animate-pulse rounded-full bg-neutral-900" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-900" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-900" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-500">
            No messages yet — be the first to break the silence.
          </div>
        ) : (
          messages.map((m) => (
            <PartyMessageRow key={m.id} msg={m} isMe={m.userId === user?.id} />
          ))
        )}
      </div>

      <div className="border-t border-neutral-800 p-2">
        <div className="flex items-center gap-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, CHAR_LIMIT))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              !user ? "Sign in to chat" : !joined ? "Join the party to chat" : "Send a message"
            }
            disabled={!user || !joined || sending}
            className="h-9 border-neutral-800 bg-neutral-900 text-sm"
          />
          <Button
            size="icon-sm"
            onClick={send}
            disabled={!user || !joined || !input.trim() || sending}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <div
          className={cn(
            "mt-1 text-right text-[10px]",
            input.length > CHAR_LIMIT * 0.9 ? "text-amber-400" : "text-neutral-500",
          )}
        >
          {input.length} / {CHAR_LIMIT}
        </div>
      </div>
    </div>
  );
}

function PartyMessageRow({ msg, isMe }: { msg: PartyMessage; isMe: boolean }) {
  if (msg.isSystem) {
    return (
      <div className="px-3 py-1 text-center text-[11px] italic text-neutral-500">
        — {msg.body} —
      </div>
    );
  }
  return (
    <div
      className={cn(
        "group flex gap-2 rounded-md px-3 py-1.5 transition-colors hover:bg-neutral-900/60",
        isMe && "bg-sky-500/5",
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
        <span
          className={cn(
            "mr-1.5 text-xs font-semibold",
            isMe ? "text-sky-300" : "text-neutral-200",
          )}
        >
          {msg.userHandle}
          <span className="font-normal text-neutral-500">:</span>
        </span>
        <span className="break-words text-sm text-neutral-100">{msg.body}</span>
      </div>
    </div>
  );
}
