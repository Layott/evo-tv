"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createLeague, scoringLabel, type ScoringSystem } from "@/lib/mock/fantasy";
import { listGames } from "@/lib/mock/games";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoinPill } from "@/components/predictions/coin-pill";

export default function NewFantasyLeaguePage() {
  const router = useRouter();
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";

  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [gameId, setGameId] = React.useState<string>("");
  const [maxMembers, setMaxMembers] = React.useState(20);
  const [entryFee, setEntryFee] = React.useState(200);
  const [salaryCap, setSalaryCap] = React.useState(25000);
  const [scoringSystem, setScoringSystem] = React.useState<ScoringSystem>("kda");
  const [endsInDays, setEndsInDays] = React.useState(14);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!gameId && (games.data?.length ?? 0) > 0) setGameId(games.data![0]!.id);
  }, [games.data, gameId]);

  const disabled =
    !name.trim() || !gameId || maxMembers < 2 || entryFee < 0 || salaryCap < 5000 || endsInDays < 1;

  async function onSubmit() {
    if (disabled) return;
    setSubmitting(true);
    const endsAt = new Date(Date.now() + endsInDays * 86_400_000).toISOString();
    const lg = await createLeague({
      name,
      description,
      gameId,
      maxMembers,
      entryFee,
      salaryCap,
      scoringSystem,
      endsAt,
      ownerId: userId,
    });
    setSubmitting(false);
    toast.success(`League "${lg.name}" created!`);
    router.push(`/fantasy/leagues/${lg.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href="/fantasy">
          <ArrowLeft className="h-4 w-4" /> Back to leagues
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
          <Sparkles className="h-6 w-6 text-sky-400" /> Create a fantasy league
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Configure your league. Members pay an entry fee that funds the prize pool.
        </p>
      </header>

      <div className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">League name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lagos Free Fire Friday"
            className="border-neutral-800 bg-neutral-900"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the vibe? Who should join?"
            className="min-h-[80px] border-neutral-800 bg-neutral-900"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger className="border-neutral-800 bg-neutral-900">
                <SelectValue placeholder="Pick a game" />
              </SelectTrigger>
              <SelectContent>
                {(games.data ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Scoring</Label>
            <Select value={scoringSystem} onValueChange={(v) => setScoringSystem(v as ScoringSystem)}>
              <SelectTrigger className="border-neutral-800 bg-neutral-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kills">{scoringLabel("kills")}</SelectItem>
                <SelectItem value="kda">{scoringLabel("kda")}</SelectItem>
                <SelectItem value="objectives">{scoringLabel("objectives")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max">Max members</Label>
            <Input
              id="max"
              type="number"
              min={2}
              max={500}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Math.max(2, Number(e.target.value || 2)))}
              className="border-neutral-800 bg-neutral-900"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ends">Ends in (days)</Label>
            <Input
              id="ends"
              type="number"
              min={1}
              max={120}
              value={endsInDays}
              onChange={(e) => setEndsInDays(Math.max(1, Number(e.target.value || 1)))}
              className="border-neutral-800 bg-neutral-900"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fee">Entry fee (coins)</Label>
            <Input
              id="fee"
              type="number"
              min={0}
              step={50}
              value={entryFee}
              onChange={(e) => setEntryFee(Math.max(0, Number(e.target.value || 0)))}
              className="border-neutral-800 bg-neutral-900"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cap">Salary cap (coins)</Label>
            <Input
              id="cap"
              type="number"
              min={5000}
              step={500}
              value={salaryCap}
              onChange={(e) => setSalaryCap(Math.max(5000, Number(e.target.value || 5000)))}
              className="border-neutral-800 bg-neutral-900"
            />
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Estimated prize pool</span>
            <CoinPill coins={entryFee * maxMembers} tone="amber" />
          </div>
          <p className="mt-1 text-[11px] text-amber-200/70">
            Calculated as entry fee × max members. Adjust by changing those fields above.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800">
            <Link href="/fantasy">Cancel</Link>
          </Button>
          <Button
            disabled={disabled || submitting}
            onClick={onSubmit}
            className="bg-sky-600 text-white hover:bg-sky-500"
          >
            {submitting ? "Creating..." : "Create league"}
          </Button>
        </div>
      </div>
    </div>
  );
}
