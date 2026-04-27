"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { MessageCircle } from "lucide-react";

interface Comment {
  id: string;
  handle: string;
  avatarUrl: string;
  body: string;
  createdAt: string;
  likes: number;
}

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function seed(vodId: string): Comment[] {
  const base = [
    { handle: "viper", body: "That rotation at minute 12 is a masterclass.", mins: 10, likes: 48 },
    { handle: "shadow", body: "GOATed commentary. Replay value through the roof.", mins: 120, likes: 22 },
    { handle: "blaze", body: "Whoever edited the highlight cuts — raise.", mins: 360, likes: 71 },
    { handle: "havoc", body: "Did anyone else clip the 1v4? I need it.", mins: 720, likes: 14 },
    { handle: "rex", body: "Film Room made me see the meta differently.", mins: 60 * 24, likes: 93 },
    { handle: "nyx", body: "More like this please 🙌", mins: 60 * 24 * 2, likes: 9 },
  ];
  return base.map((c, i) => ({
    id: `cm_${vodId}_${i}`,
    handle: c.handle,
    avatarUrl: `/placeholder.svg?height=40&width=40&text=${c.handle.slice(0, 2).toUpperCase()}`,
    body: c.body,
    createdAt: new Date(Date.now() - c.mins * 60_000).toISOString(),
    likes: c.likes,
  }));
}

export function VodComments({ vodId }: { vodId: string }) {
  const { user } = useMockAuth();
  const [comments, setComments] = React.useState<Comment[]>(() => seed(vodId));
  const [draft, setDraft] = React.useState("");

  const post = () => {
    const body = draft.trim();
    if (!body) return;
    if (!user) {
      toast.error("Sign in to comment");
      return;
    }
    const newComment: Comment = {
      id: `cm_local_${Date.now()}`,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      body,
      createdAt: new Date().toISOString(),
      likes: 0,
    };
    setComments((prev) => [newComment, ...prev]);
    setDraft("");
    toast.success("Comment posted");
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="size-4 text-neutral-400" />
        <h2 className="text-lg font-semibold text-neutral-100">
          Comments{" "}
          <span className="text-sm font-normal text-neutral-500">
            ({comments.length})
          </span>
        </h2>
      </div>

      <div className="flex gap-3 mb-5">
        <Avatar className="size-9">
          <AvatarImage src={user?.avatarUrl} alt={user?.handle ?? "guest"} />
          <AvatarFallback>{(user?.handle ?? "gu").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            placeholder={user ? "Add a comment…" : "Sign in to comment"}
            disabled={!user}
            rows={2}
            className="bg-neutral-900 border-neutral-800 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">{draft.length} / 500</span>
            <Button size="sm" onClick={post} disabled={!user || !draft.trim()}>
              Post
            </Button>
          </div>
        </div>
      </div>

      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar className="size-9">
              <AvatarImage src={c.avatarUrl} alt={c.handle} />
              <AvatarFallback>{c.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-neutral-100">
                  {c.handle}
                </span>
                <span className="text-neutral-500">{relTime(c.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-200 break-words">{c.body}</p>
              <div className="mt-1 text-[11px] text-neutral-500">{c.likes} likes</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
