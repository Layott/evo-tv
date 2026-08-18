"use client";

import * as React from "react";
import { toast } from "sonner";

import { ApiAccessShell } from "@/components/api-access/api-access-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, KeyRound, Loader2, Trash2 } from "@/components/icons";

/**
 * API keys, as a real screen rather than a promise of one.
 *
 * The endpoints have existed for months. This page did not: it rendered
 * `ComingSoon`, so the only way to mint or revoke a key was to call the API by
 * hand. That is how a key ends up being created from a browser console during a
 * deploy, which is exactly what happened, and it means a leaked key cannot be
 * revoked by the person who needs to revoke it.
 *
 * The value is returned once, on creation, and only a hash is stored. So the
 * screen is built around that fact: the new key gets a dialog of its own that
 * says plainly it will not be shown again, and the list can only ever show the
 * prefix.
 */

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ApiKeysPage() {
  const [keys, setKeys] = React.useState<ApiKey[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  /** The plaintext key, held only long enough to be copied. */
  const [revealed, setRevealed] = React.useState<{ name: string; key: string } | null>(
    null,
  );
  const [confirmRevoke, setConfirmRevoke] = React.useState<ApiKey | null>(null);
  const [revoking, setRevoking] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/account/api-keys", {
        credentials: "include",
      });
      if (res.status === 403) {
        setError("API keys are available to admin accounts.");
        setKeys([]);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setKeys(await res.json());
    } catch {
      setError("Could not load your keys. Try again in a moment.");
      setKeys([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // The route answers 409 with a readable sentence when the ten-key
        // limit is reached, so show what it said rather than a generic failure.
        toast.error(body?.error ?? "Could not create the key");
        return;
      }
      setName("");
      setRevealed({ name: body.name, key: body.key });
      void load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(key: ApiKey) {
    setRevoking(true);
    try {
      const res = await fetch(`/api/account/api-keys/${key.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Could not revoke that key");
        return;
      }
      toast.success(`Revoked ${key.name}`);
      setConfirmRevoke(null);
      void load();
    } finally {
      setRevoking(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Key copied");
    } catch {
      // Clipboard is blocked without focus or on an insecure origin. The value
      // is on screen and selectable, so say that rather than failing silently.
      toast.message("Copy blocked by the browser. Select the key and copy it.");
    }
  }

  const active = (keys ?? []).filter((k) => !k.revokedAt);
  const revoked = (keys ?? []).filter((k) => k.revokedAt);

  return (
    <ApiAccessShell>
      <form onSubmit={create} className="mb-6 rounded-xl bg-card/60 p-4">
        <label
          htmlFor="key-name"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Create a key
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is it for? e.g. apk-publish"
            maxLength={120}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!name.trim() || creating}
            className="bg-sky-600 hover:bg-sky-500"
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Create key
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Name it after the thing that will use it. When something leaks you want
          to know which machine to go and fix, and you can revoke one key without
          disturbing the others.
        </p>
      </form>

      {error ? (
        <div className="rounded-xl bg-amber-500/25 p-4 text-sm text-amber-100">
          {error}
        </div>
      ) : keys === null ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your keys…
        </div>
      ) : active.length === 0 && revoked.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No keys yet. Create one above and it will appear here.
        </p>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Active
              </h2>
              <div className="flex flex-col gap-1">
                {active.map((k) => (
                  <div
                    key={k.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-card/60 px-4 py-3"
                  >
                    <span className="font-semibold text-foreground">{k.name}</span>
                    <code className="rounded bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {k.prefix}…
                    </code>
                    <span className="text-xs text-muted-foreground">
                      created {formatDate(k.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      last used {formatDate(k.lastUsedAt)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmRevoke(k)}
                      className="ml-auto text-red-300 hover:bg-red-500/20 hover:text-red-200"
                    >
                      <Trash2 className="size-4" />
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {revoked.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Revoked
              </h2>
              <div className="flex flex-col gap-1">
                {revoked.map((k) => (
                  <div
                    key={k.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-card/30 px-4 py-3 text-muted-foreground"
                  >
                    <span className="font-medium line-through">{k.name}</span>
                    <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                      {k.prefix}…
                    </code>
                    <span className="text-xs">
                      revoked {formatDate(k.revokedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Shown once. The server keeps only a hash, so this dialog is the single
          moment the value exists anywhere it can be read. */}
      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent className="bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Copy your key now</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This is the only time {revealed?.name} will be shown. Only a hash is
              stored, so it cannot be recovered later.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-card/60 p-3">
            <code className="block break-all font-mono text-sm text-sky-200">
              {revealed?.key}
            </code>
          </div>

          <div className="rounded-lg bg-amber-500/25 p-3 text-xs text-amber-100">
            Anyone holding this key can act as your account through the API.
            Treat it like a password, keep it out of screenshots, and never
            commit it.
          </div>

          <DialogFooter>
            <Button
              onClick={() => revealed && copy(revealed.key)}
              className="bg-sky-600 hover:bg-sky-500"
            >
              <Copy className="size-4" />
              Copy key
            </Button>
            <Button variant="ghost" onClick={() => setRevealed(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmRevoke}
        onOpenChange={(o) => !o && setConfirmRevoke(null)}
      >
        <DialogContent className="bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Revoke {confirmRevoke?.name}?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Anything using this key stops working immediately. This cannot be
              undone; create a new key instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmRevoke && revoke(confirmRevoke)}
              disabled={revoking}
              className="bg-red-600 hover:bg-red-500"
            >
              {revoking ? <Loader2 className="size-4 animate-spin" /> : null}
              Revoke key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ApiAccessShell>
  );
}
