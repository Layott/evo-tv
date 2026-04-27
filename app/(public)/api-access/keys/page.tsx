"use client";

import * as React from "react";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { ApiAccessShell } from "@/components/api-access/api-access-shell";
import { ApiPaywallCard } from "@/components/api-access/paywall-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { timeAgo } from "@/components/admin/utils";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKey,
} from "@/lib/mock/api-keys";

export default function ApiKeysPage() {
  const { role, user } = useMockAuth();
  const isPremium = role === "premium" || role === "admin";
  const userId = user?.id ?? "user_premium";

  const [keys, setKeys] = React.useState<ApiKey[] | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [shownKey, setShownKey] = React.useState<ApiKey | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isPremium) return;
    listApiKeys(userId).then(setKeys);
  }, [isPremium, userId]);

  if (!isPremium) {
    return (
      <ApiAccessShell>
        <ApiPaywallCard />
      </ApiAccessShell>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Name your key first");
      return;
    }
    setCreating(true);
    try {
      const newKey = await createApiKey(createName, userId);
      setShownKey(newKey);
      setCreateOpen(false);
      setCreateName("");
      const refreshed = await listApiKeys(userId);
      setKeys(refreshed);
      toast.success("Key generated. Copy it now — you won't see it again.");
    } catch {
      toast.error("Could not create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await revokeApiKey(id);
      const refreshed = await listApiKeys(userId);
      setKeys(refreshed);
      toast.success("Key revoked");
    } catch {
      toast.error("Could not revoke");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyText(text: string, label = "Copied") {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.message("Clipboard unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <ApiAccessShell>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 p-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">API keys</h2>
            <p className="text-xs text-neutral-500">
              Store keys securely. They can read public data on your behalf.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Generate new key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Generate API key</DialogTitle>
                  <DialogDescription>
                    Give this key a recognizable name. You'll see the secret once — copy it
                    immediately and stash it in a secret manager.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="apikey-name">Name</Label>
                  <Input
                    id="apikey-name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Production server"
                    autoFocus
                    maxLength={48}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCreateOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating
                      </>
                    ) : (
                      <>
                        <KeyRound className="size-4" />
                        Generate
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Name</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Prefix</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Created</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Last used</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Status</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-neutral-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys === null ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="border-neutral-800">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-800" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : keys.length === 0 ? (
                <TableRow className="border-neutral-800">
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-neutral-500">
                    No keys yet. Generate one to start hitting the API.
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((k) => (
                  <TableRow key={k.id} className="border-neutral-800">
                    <TableCell className="text-sm font-medium text-neutral-100">
                      {k.name}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => copyText(k.prefix, "Prefix copied")}
                        className="font-mono text-xs text-sky-300 hover:underline"
                      >
                        {k.prefix}***
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-neutral-400">
                      {timeAgo(k.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-neutral-400">
                      {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={k.status === "active" ? "emerald" : "neutral"} dot={k.status === "active"}>
                        {k.status === "active" ? "Active" : "Revoked"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        disabled={k.status !== "active" || revokingId === k.id}
                        onClick={() => handleRevoke(k.id)}
                      >
                        {revokingId === k.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="size-3.5" />
                            Revoke
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* New key reveal modal */}
      <Dialog open={Boolean(shownKey)} onOpenChange={(o) => !o && setShownKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              This is the only time we'll show the secret. Copy and store it now.
            </DialogDescription>
          </DialogHeader>
          {shownKey?.fullKey ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                {shownKey.name}
              </div>
              <div className="mt-1 break-all font-mono text-sm text-neutral-100">
                {shownKey.fullKey}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => copyText(shownKey?.fullKey ?? "", "Key copied")}
            >
              <Copy className="size-4" />
              Copy
            </Button>
            <Button onClick={() => setShownKey(null)}>I've stored it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ApiAccessShell>
  );
}
