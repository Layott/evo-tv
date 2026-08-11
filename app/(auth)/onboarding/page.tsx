"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Users,
  Shield,
  BellRing,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listGames, listTeams } from "@/lib/client";
import type { Game, Team, UserPrefs } from "@/lib/types";
import { useAuth } from "@/components/providers";

type NotifKey = keyof UserPrefs["notifOptIn"];

interface WizardState {
  games: string[];
  teams: string[];
  notif: UserPrefs["notifOptIn"];
  theme: UserPrefs["theme"];
  language: UserPrefs["language"];
  quality: UserPrefs["playback"]["defaultQuality"];
}

const INITIAL_STATE: WizardState = {
  games: [],
  teams: [],
  notif: { goLive: true, eventReminder: true, newVod: true, weeklyDigest: false },
  theme: "dark",
  language: "en",
  quality: "auto",
};

const LANGUAGES: { code: UserPrefs["language"]; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "sw", label: "Kiswahili" },
];

const QUALITIES: UserPrefs["playback"]["defaultQuality"][] = [
  "auto",
  "1080p",
  "720p",
  "480p",
  "360p",
];

const NOTIF_ITEMS: { key: NotifKey; title: string; body: string }[] = [
  {
    key: "goLive",
    title: "Go-live alerts",
    body: "Get pinged when teams or streamers you follow start broadcasting.",
  },
  {
    key: "eventReminder",
    title: "Event reminders",
    body: "Heads-up 15 minutes before tournaments and finals start.",
  },
  {
    key: "newVod",
    title: "New VOD drops",
    body: "When a highlight or full VOD publishes from your favourites.",
  },
  {
    key: "weeklyDigest",
    title: "Weekly digest",
    body: "A Sunday recap of matches, standings, and upcoming events.",
  },
];

const STEP_TITLES = [
  { title: "Pick your games", subtitle: "Choose at least one to personalize your feed.", Icon: Shield },
  { title: "Follow teams", subtitle: "Track squads across your selected games.", Icon: Users },
  { title: "Stay in the loop", subtitle: "We only ping you when it matters.", Icon: BellRing },
  { title: "Make it yours", subtitle: "Language, theme and playback defaults.", Icon: SlidersHorizontal },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();

  const [step, setStep] = React.useState(1);
  const [state, setState] = React.useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = React.useState(false);

  const [games, setGames] = React.useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = React.useState(true);

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setGamesLoading(true);
    listGames().then((g) => {
      if (!cancelled) {
        setGames(g);
        setGamesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (step !== 2 || state.games.length === 0) return;
    let cancelled = false;
    setTeamsLoading(true);
    Promise.all(state.games.map((gameId) => listTeams({ gameId }))).then((results) => {
      if (cancelled) return;
      const flat = results.flat();
      const dedup = Array.from(new Map(flat.map((t) => [t.id, t])).values());
      dedup.sort((a, b) => a.ranking - b.ranking);
      setTeams(dedup);
      setTeamsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [step, state.games]);

  const toggleGame = (id: string) =>
    setState((s) => ({
      ...s,
      games: s.games.includes(id) ? s.games.filter((g) => g !== id) : [...s.games, id],
      teams:
        s.games.includes(id)
          ? s.teams.filter((teamId) => {
              const t = teams.find((x) => x.id === teamId);
              return t ? t.gameId !== id : true;
            })
          : s.teams,
    }));

  const toggleTeam = (id: string) =>
    setState((s) => ({
      ...s,
      teams: s.teams.includes(id) ? s.teams.filter((t) => t !== id) : [...s.teams, id],
    }));

  const toggleNotif = (key: NotifKey) =>
    setState((s) => ({ ...s, notif: { ...s.notif, [key]: !s.notif[key] } }));

  const canProceed =
    step === 1 ? state.games.length >= 1 : step === 4 ? !submitting : true;

  const handleNext = async () => {
    if (step < 4) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    completeOnboarding();
    toast.success("You're all set", {
      description: "Welcome to EVO TV.",
    });
    router.push("/home");
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const progressPct = (step / 4) * 100;
  const current = STEP_TITLES[step - 1];
  const Icon = current.Icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Step {step} of 4
        </span>
        <Link
          href="/home"
          className="text-xs font-medium text-neutral-400 hover:text-neutral-100"
          onClick={() => completeOnboarding()}
        >
          Skip for now
        </Link>
      </div>

      <Progress
        value={progressPct}
        className="h-1.5 bg-neutral-900 [&>[data-slot=progress-indicator]]:bg-sky-500"
      />

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-sky-400" />
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">{current.title}</h1>
        </div>
        <p className="text-sm text-neutral-400">{current.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        {step === 1 ? (
          <StepGames
            games={games}
            loading={gamesLoading}
            selected={state.games}
            onToggle={toggleGame}
          />
        ) : step === 2 ? (
          <StepTeams
            loading={teamsLoading}
            teams={teams}
            gamesLookup={new Map(games.map((g) => [g.id, g]))}
            selected={state.teams}
            onToggle={toggleTeam}
          />
        ) : step === 3 ? (
          <StepNotifications notif={state.notif} onToggle={toggleNotif} />
        ) : (
          <StepPreferences
            theme={state.theme}
            language={state.language}
            quality={state.quality}
            onThemeChange={(theme) => setState((s) => ({ ...s, theme }))}
            onLanguageChange={(language) => setState((s) => ({ ...s, language }))}
            onQualityChange={(quality) => setState((s) => ({ ...s, quality }))}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || submitting}
          className="h-11 border-neutral-800 bg-neutral-900/50 text-neutral-200 hover:bg-neutral-800"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || submitting}
          className="h-11 bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Finishing…
            </>
          ) : step === 4 ? (
            <>
              Finish
              <Check className="size-4" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Step 1: Games ------------------------------ */

function StepGames({
  games,
  loading,
  selected,
  onToggle,
}: {
  games: Game[];
  loading: boolean;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-neutral-900" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {games.map((g) => {
        const isSelected = selected.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id)}
            aria-pressed={isSelected}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-neutral-950 text-left transition",
              isSelected
                ? "border-sky-500 ring-2 ring-sky-500/30"
                : "border-neutral-800 hover:border-neutral-700",
            )}
          >
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={g.coverUrl}
                alt={g.name}
                fill
                sizes="(max-width: 640px) 100vw, 240px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
              {isSelected ? (
                <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-sky-500 text-neutral-950">
                  <Check className="size-3.5" />
                </div>
              ) : null}
            </div>
            <div className="space-y-1 p-3">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-neutral-50">{g.shortName}</h3>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  {g.platform}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                {new Intl.NumberFormat("en", { notation: "compact" }).format(g.activePlayers)} active players
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Step 2: Teams ------------------------------- */

function StepTeams({
  loading,
  teams,
  gamesLookup,
  selected,
  onToggle,
}: {
  loading: boolean;
  teams: Team[];
  gamesLookup: Map<string, Game>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-900" />
        ))}
      </div>
    );
  }
  if (teams.length === 0) {
    return (
      <p className="text-sm text-neutral-400">No teams available for your selected games.</p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {teams.map((t) => {
        const isSelected = selected.includes(t.id);
        const game = gamesLookup.get(t.gameId);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            aria-pressed={isSelected}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-neutral-950 p-3 text-left transition",
              isSelected
                ? "border-sky-500 ring-2 ring-sky-500/30"
                : "border-neutral-800 hover:border-neutral-700",
            )}
          >
            <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-neutral-800">
              <Image
                src={t.logoUrl}
                alt={t.name}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-neutral-50">{t.name}</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-neutral-400">
                  {t.tag}
                </span>
              </div>
              <p className="truncate text-[11px] text-neutral-500">
                {game?.shortName ?? "Unknown"} · {t.country} · #{t.ranking}
              </p>
            </div>
            <div
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                isSelected
                  ? "border-sky-500 bg-sky-500 text-neutral-950"
                  : "border-neutral-700",
              )}
            >
              {isSelected ? <Check className="size-3" /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------- Step 3: Notifications -------------------------- */

function StepNotifications({
  notif,
  onToggle,
}: {
  notif: UserPrefs["notifOptIn"];
  onToggle: (k: NotifKey) => void;
}) {
  return (
    <div className="space-y-3">
      {NOTIF_ITEMS.map((n) => {
        const checked = notif[n.key];
        return (
          <div
            key={n.key}
            className="flex items-start gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-4"
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor={`notif-${n.key}`} className="text-sm font-semibold text-neutral-100">
                {n.title}
              </Label>
              <p className="mt-1 text-xs text-neutral-500">{n.body}</p>
            </div>
            <Switch
              id={`notif-${n.key}`}
              checked={checked}
              onCheckedChange={() => onToggle(n.key)}
              className="data-[state=checked]:bg-sky-500"
            />
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- Step 4: Preferences ---------------------------- */

function StepPreferences({
  theme,
  language,
  quality,
  onThemeChange,
  onLanguageChange,
  onQualityChange,
}: {
  theme: UserPrefs["theme"];
  language: UserPrefs["language"];
  quality: UserPrefs["playback"]["defaultQuality"];
  onThemeChange: (t: UserPrefs["theme"]) => void;
  onLanguageChange: (l: UserPrefs["language"]) => void;
  onQualityChange: (q: UserPrefs["playback"]["defaultQuality"]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-neutral-200 font-semibold">Theme</Label>
        <RadioGroup
          value={theme}
          onValueChange={(v) => onThemeChange(v as UserPrefs["theme"])}
          className="grid grid-cols-3 gap-2"
        >
          {(["system", "light", "dark"] as const).map((opt) => {
            const active = theme === opt;
            return (
              <label
                key={opt}
                htmlFor={`theme-${opt}`}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-lg border bg-neutral-950 px-3 py-2.5 text-sm capitalize transition",
                  active
                    ? "border-sky-500 text-sky-400 ring-2 ring-sky-500/30"
                    : "border-neutral-800 text-neutral-300 hover:border-neutral-700",
                )}
              >
                <RadioGroupItem
                  id={`theme-${opt}`}
                  value={opt}
                  className="border-neutral-700 data-[state=checked]:border-sky-500 data-[state=checked]:text-sky-500"
                />
                {opt}
              </label>
            );
          })}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="language" className="text-neutral-200 font-semibold">
          Language
        </Label>
        <Select value={language} onValueChange={(v) => onLanguageChange(v as UserPrefs["language"])}>
          <SelectTrigger
            id="language"
            className="w-full border-neutral-800 bg-neutral-900/50 text-neutral-100"
          >
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                <span className="text-xs font-mono text-neutral-400">{l.code}</span>
                <span>{l.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-neutral-200 font-semibold">Default playback quality</Label>
        <div className="grid grid-cols-5 gap-2">
          {QUALITIES.map((q) => {
            const active = quality === q;
            return (
              <button
                key={q}
                type="button"
                onClick={() => onQualityChange(q)}
                className={cn(
                  "rounded-lg border bg-neutral-950 px-2 py-2 text-xs font-semibold transition",
                  active
                    ? "border-sky-500 text-sky-400 ring-2 ring-sky-500/30"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-700",
                )}
              >
                {q}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <Checkbox checked disabled className="mt-0.5 border-sky-500 bg-sky-500 text-neutral-950 opacity-100 disabled:opacity-100" />
        <p className="text-xs text-neutral-300">
          Your preferences save to this device. Sign in anywhere to sync them across EVO TV.
        </p>
      </div>
    </div>
  );
}
