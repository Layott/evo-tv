"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "@/components/icons";
import { adminListStreams } from "@/lib/client";

/**
 * The chat rules, where a person can change them.
 *
 * They were enforced from the moment they shipped and editable only through the
 * API, which is the same as not being editable: the person who needs to stop a
 * scam link at nine in the evening is not going to write a PUT request.
 *
 * The house rules apply everywhere. A broadcast can carry its own set, and it
 * **replaces** the house rules rather than adding to them, because two sets that
 * partly apply is not something anybody can reason about with chat moving.
 */

interface Rules {
  blockLinks: boolean;
  allowedDomains: string[];
  bannedWords: string[];
  strikesBeforeBan: number;
  banMinutes: number;
}

const HOUSE = "__house__";

async function fetchRules(streamId: string | null): Promise<Rules> {
  const url = streamId
    ? `/api/admin/chat-rules?streamId=${encodeURIComponent(streamId)}`
    : "/api/admin/chat-rules";
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Could not read the chat rules");
  return (await res.json()) as Rules;
}

export function ChatRulesPanel() {
  const qc = useQueryClient();
  const [scope, setScope] = React.useState<string>(HOUSE);
  const streamId = scope === HOUSE ? null : scope;

  const streamsQ = useQuery({
    queryKey: ["admin", "streams"],
    queryFn: () => adminListStreams(),
  });
  const rulesQ = useQuery({
    queryKey: ["admin", "chat-rules", scope],
    queryFn: () => fetchRules(streamId),
  });

  const [draft, setDraft] = React.useState<Rules | null>(null);
  React.useEffect(() => {
    if (rulesQ.data) setDraft(rulesQ.data);
  }, [rulesQ.data]);

  const save = useMutation({
    mutationFn: async (next: Rules) => {
      const url = streamId
        ? `/api/admin/chat-rules?streamId=${encodeURIComponent(streamId)}`
        : "/api/admin/chat-rules";
      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(
          typeof body.error === "string" ? body.error : "Could not save the chat rules",
        );
      }
      return (await res.json()) as Rules;
    },
    onSuccess: () => {
      toast.success(
        streamId ? "Rules saved for this broadcast" : "House rules saved",
      );
      void qc.invalidateQueries({ queryKey: ["admin", "chat-rules"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save the chat rules"),
  });

  if (!draft) {
    return <p className="text-sm text-muted-foreground">Reading the chat rules…</p>;
  }

  const set = <K extends keyof Rules>(key: K, value: Rules[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>These rules apply to</Label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-full max-w-md bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={HOUSE}>Every chat, unless a broadcast overrides it</SelectItem>
            {(streamsQ.data?.streams ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A broadcast&apos;s own rules replace the house rules rather than adding
          to them, so what is on screen is the whole answer.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl bg-card/60 p-4">
        <div>
          <div className="text-sm font-medium text-foreground">Block links</div>
          <div className="max-w-[60ch] text-xs text-muted-foreground">
            Catches bare hosts as well as full addresses, and sees through the
            usual tricks: a zero-width character inside a name, or the dot
            spelled out.
          </div>
        </div>
        <Switch checked={draft.blockLinks} onCheckedChange={(v) => set("blockLinks", v)} />
      </div>

      <ChipField
        label="Links that are still allowed"
        hint="Subdomains count. evotv.co allows help.evotv.co and refuses evotv.co.claim-now.xyz."
        placeholder="evotv.co"
        values={draft.allowedDomains}
        onChange={(next) => set("allowedDomains", next)}
      />

      <ChipField
        label="Blocked words"
        hint="Matched anywhere in a message, ignoring case."
        placeholder="Add a word and press Enter"
        values={draft.bannedWords}
        onChange={(next) => set("bannedWords", next)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="strikes">Warnings before a mute</Label>
          <Input
            id="strikes"
            type="number"
            min={0}
            max={20}
            value={draft.strikesBeforeBan}
            onChange={(e) =>
              set("strikesBeforeBan", Math.max(0, Math.min(20, Number(e.target.value) || 0)))
            }
          />
          <p className="text-xs text-muted-foreground">
            Counted per person per broadcast. 0 blocks the message and never mutes.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ban-minutes">How long the mute lasts</Label>
          <Input
            id="ban-minutes"
            type="number"
            min={1}
            max={60 * 24 * 30}
            value={draft.banMinutes}
            onChange={(e) =>
              set("banMinutes", Math.max(1, Number(e.target.value) || 1))
            }
          />
          <p className="text-xs text-muted-foreground">
            Minutes. It expires by itself and shows in Banned users meanwhile.
          </p>
        </div>
      </div>

      <Button
        onClick={() => save.mutate(draft)}
        disabled={save.isPending}
        className="bg-sky-600 text-white hover:bg-sky-500"
      >
        {save.isPending ? "Saving" : "Save rules"}
      </Button>
    </div>
  );
}

/**
 * A list of short strings, entered one at a time.
 *
 * A comma-separated text box looks simpler and is worse: nobody can tell
 * whether a trailing space matters, and one typo silently changes an entry that
 * was already working.
 */
function ChipField({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = React.useState("");

  function add() {
    const value = text.trim().toLowerCase();
    if (!value || values.includes(value)) {
      setText("");
      return;
    }
    onChange([...values, value]);
    setText("");
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="max-w-md bg-card"
        />
        <Button type="button" variant="outline" onClick={add} className="bg-card">
          Add
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-foreground"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="pt-1 text-xs text-muted-foreground">Nothing listed.</p>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
