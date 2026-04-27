"use client";

import * as React from "react";
import type { ChatMessage } from "@/lib/types";
import { listInitialMessages, makeIncomingMessage } from "@/lib/mock";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users, Gauge } from "lucide-react";
import { toast } from "sonner";
import { MessageItem } from "@/components/chat/message-item";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { cn } from "@/lib/utils";

const MAX_MSGS = 200;
const CHAR_LIMIT = 400;

export function LiveChat({ streamId }: { streamId: string }) {
  const { user, role } = useMockAuth();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [subsOnly, setSubsOnly] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stuckToBottom = React.useRef(true);

  const isAdmin = role === "admin";
  const canToggleSubs = role === "admin" || role === "premium";

  // Initial load
  React.useEffect(() => {
    let cancelled = false;
    listInitialMessages(streamId).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    });
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  // Simulated incoming messages
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setMessages((prev) => {
        const next = [...prev, makeIncomingMessage(streamId)];
        return next.length > MAX_MSGS ? next.slice(next.length - MAX_MSGS) : next;
      });
      timer = setTimeout(tick, 2000 + Math.random() * 2000);
    };
    timer = setTimeout(tick, 2000 + Math.random() * 2000);
    return () => clearTimeout(timer);
  }, [streamId]);

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

  const send = () => {
    const body = input.trim();
    if (!body) return;
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }
    const msg: ChatMessage = {
      id: `msg_local_${Date.now()}`,
      streamId,
      userId: user.id,
      userHandle: user.handle,
      userAvatarUrl: user.avatarUrl,
      userRole: role,
      body,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      isPinned: false,
    };
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_MSGS ? next.slice(next.length - MAX_MSGS) : next;
    });
    setInput("");
    stuckToBottom.current = true;
  };

  const insertEmoji = (e: string) => {
    setInput((prev) => (prev + e).slice(0, CHAR_LIMIT));
  };

  const visibleMessages = subsOnly
    ? messages.filter(
        (m) => m.userRole === "premium" || m.userRole === "admin"
      )
    : messages;

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Users className="size-4" />
          Stream Chat
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
            <Gauge className="size-3" />
            Slow: 3s
          </div>
          {canToggleSubs && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-400">Subs only</span>
              <Switch
                checked={subsOnly}
                onCheckedChange={(v) => {
                  setSubsOnly(v);
                  toast.message(v ? "Subscribers-only mode on" : "Subscribers-only mode off");
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-1 min-h-0"
      >
        {visibleMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            Chat is warming up…
          </div>
        ) : (
          visibleMessages.map((m) => (
            <MessageItem key={m.id} msg={m} isAdmin={isAdmin} />
          ))
        )}
      </div>

      {/* Input */}
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
            placeholder={user ? "Send a message" : "Sign in to chat"}
            disabled={!user}
            className="h-9 bg-neutral-900 border-neutral-800 text-sm"
          />
          <EmojiPicker onPick={insertEmoji} />
          <Button
            size="icon-sm"
            onClick={send}
            disabled={!user || !input.trim()}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <div
          className={cn(
            "mt-1 text-right text-[10px]",
            input.length > CHAR_LIMIT * 0.9 ? "text-amber-400" : "text-neutral-500"
          )}
        >
          {input.length} / {CHAR_LIMIT}
        </div>
      </div>
    </div>
  );
}
