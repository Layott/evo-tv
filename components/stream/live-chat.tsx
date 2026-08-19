"use client";

import * as React from "react";
import type { ChatMessage } from "@/lib/types";
import { listInitialMessages, sendMessage } from "@/lib/client";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users, Gauge } from "@/components/icons";
import { toast } from "sonner";
import { MessageItem } from "@/components/chat/message-item";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { cn } from "@/lib/utils";

const MAX_MSGS = 200;
const CHAR_LIMIT = 400;

export function LiveChat({ streamId }: { streamId: string }) {
  const { user, role } = useAuth();
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

  // Real incoming messages. This used to invent one every two to four seconds;
  // the server publishes to `stream:<id>:chat` and this subscribes to it.
  React.useEffect(() => {
    const source = new EventSource(`/api/sse/chat/${streamId}`);

    source.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      /*
       * The bus publishes four shapes and this read only one of them, wrongly.
       *
       * A new message arrives as `{ type: "message", message }`, and this cast
       * the envelope itself to a ChatMessage: `id` and `body` were undefined on
       * the envelope, so the guard below dropped every frame. Nothing anybody
       * else typed ever appeared; only your own optimistic line did, which is
       * why a room with two people in it looked like a room with one.
       *
       * A deletion (`deleted`) and a pin (`pinned`) were dropped for the same
       * reason, so a moderator deleting a message saw it vanish for themselves
       * alone and it stayed on screen for everybody watching.
       */
      const frame = payload as {
        type?: string;
        message?: ChatMessage;
        messageId?: string;
        isPinned?: boolean;
      };

      if (frame.type === "deleted" && frame.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === frame.messageId ? { ...m, isDeleted: true } : m,
          ),
        );
        return;
      }

      if (frame.type === "pinned" && frame.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === frame.messageId
              ? { ...m, isPinned: frame.isPinned ?? !m.isPinned }
              : m,
          ),
        );
        return;
      }

      // `hello` opens the stream and `timeout` is aimed at one viewer, who
      // finds out by being refused the next time they send.
      if (frame.type !== "message") return;
      const msg = frame.message;
      if (!msg?.id || !msg.body) return;

      setMessages((prev) => {
        // The sender already appended its own message optimistically.
        if (prev.some((m) => m.id === msg.id)) return prev;

        /*
         * The same message, still wearing its local id.
         *
         * Matching on id alone is only safe once the POST has come back and
         * swapped the optimistic row for the server's. Until then the ids
         * cannot match, so the copy arriving over SSE was appended and the
         * sender saw their own line twice. That race is ordinary on a phone,
         * where the round trip is slow enough for SSE to win.
         *
         * So an unsent row from the same author with the same text is treated
         * as this message and upgraded in place, which also gives it the real
         * id and lets the check above handle any later duplicate.
         */
        const pendingIndex = prev.findIndex(
          (m) =>
            m.id.startsWith("msg_local_") &&
            m.userId === msg.userId &&
            m.body === msg.body,
        );
        if (pendingIndex !== -1) {
          const next = [...prev];
          next[pendingIndex] = msg;
          return next;
        }

        const next = [...prev, msg];
        return next.length > MAX_MSGS ? next.slice(next.length - MAX_MSGS) : next;
      });
    };

    return () => source.close();
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

  const send = async () => {
    const body = input.trim();
    if (!body) return;
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }

    // Optimistic: show it immediately, then reconcile with the server's row so
    // the id matches what arrives back over SSE and the message is not doubled.
    const optimisticId = `msg_local_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      streamId,
      userId: user.id,
      // Fall back rather than pass null through: an account without a handle
      // is normal, and the row that comes back from the server carries a
      // resolved name anyway.
      userHandle: user.handle || user.displayName || "viewer",
      userAvatarUrl: user.avatarUrl,
      userRole: role,
      body,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      isPinned: false,
    };
    setMessages((prev) => {
      const next = [...prev, optimistic];
      return next.length > MAX_MSGS ? next.slice(next.length - MAX_MSGS) : next;
    });
    setInput("");
    stuckToBottom.current = true;

    try {
      const saved = await sendMessage(streamId, body);
      // A response missing an id is not a message. Replacing the optimistic row
      // with one is what turned a just-sent line into a blank "viewer" entry,
      // so the local row is kept and SSE reconciles it instead.
      if (saved?.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? saved : m.id === saved.id ? saved : m,
          ).filter(
            // If SSE already delivered this message, dropping the optimistic
            // twin here is what stops the pair from surviving the swap.
            (m, i, arr) => arr.findIndex((o) => o.id === m.id) === i,
          ),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(body);
      toast.error("Message not sent");
    }
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
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4" />
          Stream Chat
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Gauge className="size-3" />
            Slow: 3s
          </div>
          {canToggleSubs && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Subs only</span>
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
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Chat is warming up…
          </div>
        ) : (
          visibleMessages.map((m) => (
            <MessageItem key={m.id} msg={m} isAdmin={isAdmin} />
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-2">
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
            className="h-9 bg-card border-border text-sm"
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
            input.length > CHAR_LIMIT * 0.9 ? "text-amber-400" : "text-muted-foreground"
          )}
        >
          {input.length} / {CHAR_LIMIT}
        </div>
      </div>
    </div>
  );
}
