"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Mic2 } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { games } from "@/lib/mock/games";
import { submitApplication, getMyApplication, type CreatorApplication } from "@/lib/mock/creators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COUNTRIES = [
  { code: "NG", label: "Nigeria" },
  { code: "ZA", label: "South Africa" },
  { code: "KE", label: "Kenya" },
  { code: "GH", label: "Ghana" },
  { code: "MA", label: "Morocco" },
  { code: "EG", label: "Egypt" },
  { code: "TZ", label: "Tanzania" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "UG", label: "Uganda" },
  { code: "SN", label: "Senegal" },
  { code: "DZ", label: "Algeria" },
  { code: "TN", label: "Tunisia" },
  { code: "OTHER", label: "Other" },
];

const SOCIAL_PLATFORMS: Array<{ value: CreatorApplication["socialPlatform"]; label: string }> = [
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "tiktok", label: "TikTok" },
  { value: "kick", label: "Kick" },
  { value: "other", label: "Other" },
];

type StepId = "about" | "audience" | "review";

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "about", label: "About you" },
  { id: "audience", label: "Audience proof" },
  { id: "review", label: "Review & submit" },
];

export default function CreatorApplyPage() {
  const router = useRouter();
  const { user } = useMockAuth();
  const [stepIdx, setStepIdx] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [bio, setBio] = React.useState("");
  const [country, setCountry] = React.useState<string>("NG");
  const [primaryGameId, setPrimaryGameId] = React.useState<string>(games[0]?.id ?? "");
  const [socialPlatform, setSocialPlatform] = React.useState<CreatorApplication["socialPlatform"]>("youtube");
  const [socialHandle, setSocialHandle] = React.useState("");
  const [followerCount, setFollowerCount] = React.useState<string>("");
  const [agreement, setAgreement] = React.useState(false);

  // Already-applied guard
  React.useEffect(() => {
    if (!user) return;
    getMyApplication(user.id).then((app) => {
      if (app) {
        toast.message("You've already applied — viewing status");
        router.replace("/creator-program/thanks");
      }
    });
  }, [user, router]);

  const step = STEPS[stepIdx]!;

  function next() {
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  }
  function back() {
    setStepIdx((i) => Math.max(0, i - 1));
  }

  const aboutValid = bio.trim().length >= 20 && country && primaryGameId;
  const audienceValid = !!socialHandle.trim() && (parseInt(followerCount, 10) || 0) >= 0;
  const reviewValid = agreement;

  async function handleSubmit() {
    if (!user) {
      toast.error("Sign in to apply");
      return;
    }
    setSubmitting(true);
    const result = await submitApplication({
      userId: user.id,
      bio,
      country,
      primaryGameId,
      socialPlatform,
      socialHandle,
      followerCount: parseInt(followerCount, 10) || 0,
      agreementAccepted: agreement,
    });
    if (!result.success) {
      toast.error(result.reason ?? "Could not submit");
      setSubmitting(false);
      return;
    }
    toast.success("Application submitted!", { description: "We'll get back within 5 working days." });
    router.push("/creator-program/thanks");
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <div className="mb-4 flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="size-8 border-neutral-800">
          <Link href="/creator-program">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-neutral-50">
            <Mic2 className="mr-2 inline size-5 text-amber-400" />
            Creator program application
          </h1>
          <p className="text-sm text-neutral-400">Three quick steps. Takes about 2 minutes.</p>
        </div>
      </div>

      <Stepper steps={STEPS} current={stepIdx} />

      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
        {step.id === "about" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bio">Tell us about yourself</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What do you stream? Why EVO? Anything we should know?"
                className="min-h-[120px] border-neutral-800 bg-neutral-900"
              />
              <p className="text-[11px] text-neutral-500">{bio.trim().length} / 20 characters minimum</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="border-neutral-800 bg-neutral-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Primary game</Label>
                <Select value={primaryGameId} onValueChange={setPrimaryGameId}>
                  <SelectTrigger className="border-neutral-800 bg-neutral-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        {step.id === "audience" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select value={socialPlatform} onValueChange={(v) => setSocialPlatform(v as CreatorApplication["socialPlatform"])}>
                  <SelectTrigger className="border-neutral-800 bg-neutral-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="social-handle">Handle / channel URL</Label>
                <Input
                  id="social-handle"
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder="@yourname or full URL"
                  className="border-neutral-800 bg-neutral-900"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="followers">Follower / subscriber count</Label>
              <Input
                id="followers"
                type="number"
                min={0}
                inputMode="numeric"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                placeholder="e.g. 12500"
                className="border-neutral-800 bg-neutral-900 tabular-nums"
              />
              <p className="text-[11px] text-neutral-500">
                Don&apos;t worry about exact numbers — we&apos;ll verify on review.
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              <ExternalLink className="mr-1 inline size-3" />
              Make sure your channel handle is public so our reviewer can verify watch hours.
            </div>
          </div>
        ) : null}

        {step.id === "review" ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-100">Review your application</h3>
            <dl className="overflow-hidden rounded-lg border border-neutral-800 divide-y divide-neutral-800 text-sm">
              <Row label="Bio">{bio || <em className="text-neutral-500">empty</em>}</Row>
              <Row label="Country">
                {COUNTRIES.find((c) => c.code === country)?.label ?? country}
              </Row>
              <Row label="Primary game">
                {games.find((g) => g.id === primaryGameId)?.shortName ?? primaryGameId}
              </Row>
              <Row label="Platform">{SOCIAL_PLATFORMS.find((p) => p.value === socialPlatform)?.label}</Row>
              <Row label="Handle">{socialHandle}</Row>
              <Row label="Followers">{(parseInt(followerCount, 10) || 0).toLocaleString()}</Row>
            </dl>
            <label className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <Checkbox
                checked={agreement}
                onCheckedChange={(v) => setAgreement(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-neutral-300">
                I agree to the EVO TV Creator Agreement, including the 70/30 revenue split, content guidelines, and
                payout terms. I confirm the information above is accurate.
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            className="border-neutral-700"
            onClick={back}
            disabled={stepIdx === 0 || submitting}
          >
            <ArrowLeft className="size-3.5" /> Back
          </Button>
          {stepIdx < STEPS.length - 1 ? (
            <Button
              onClick={next}
              disabled={(stepIdx === 0 && !aboutValid) || (stepIdx === 1 && !audienceValid)}
              className="bg-sky-600 hover:bg-sky-500"
            >
              Next <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!reviewValid || submitting}
              className="bg-amber-500 text-amber-950 hover:bg-amber-400"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Submit application
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  steps,
  current,
}: {
  steps: Array<{ id: string; label: string }>;
  current: number;
}) {
  return (
    <ol className="flex items-center gap-3">
      {steps.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-3">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
              i < current
                ? "bg-emerald-500 text-emerald-950"
                : i === current
                  ? "bg-sky-500 text-white"
                  : "bg-neutral-800 text-neutral-400",
            )}
          >
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </div>
          <span
            className={cn(
              "text-xs font-medium",
              i === current ? "text-neutral-100" : "text-neutral-500",
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 ? (
            <span className={cn("h-px flex-1", i < current ? "bg-emerald-500/40" : "bg-neutral-800")} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center bg-neutral-950 p-3">
      <dt className="text-xs uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  );
}
