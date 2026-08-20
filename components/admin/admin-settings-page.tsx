"use client";

import * as React from "react";
import { Mail, Palette, Save, ToggleLeft, Upload } from "@/components/icons";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListFlags as listFlags,
  adminSaveEmailTemplate,
  adminSetFlag as setFlag,
} from "@/lib/client";
import type { FeatureFlag } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "./page-header";
import { adminListEmailTemplates, readBranding, writeBranding } from "@/lib/client";
import { HowTo } from "./how-to";
import { MediaUpload } from "./media-upload";

const EMAIL_TEMPLATES: Record<string, { label: string; body: string }> = {
  welcome: {
    label: "Welcome",
    body: `# Welcome to EVO TV

Hey **{{firstName}}**,

Thanks for joining the home of African esports. Here's what to check out first:

- Live tournaments and watch parties
- Creator highlights
- Premium film-room analysis

See you on stream,
The EVO TV Team`,
  },
  verify_email: {
    label: "Verify email",
    body: `# Verify your email

Click the link below within 24 hours to verify {{email}}:

{{verifyUrl}}

If you didn't sign up, ignore this email.`,
  },
  password_reset: {
    label: "Password reset",
    body: `# Reset your password

We received a request to reset the password for **{{email}}**.

Reset link (valid 30 minutes): {{resetUrl}}

If this wasn't you, let us know at info@evotv.co.`,
  },
  subscription_receipt: {
    label: "Subscription receipt",
    body: `# Subscription receipt

Plan: **EVO Premium**
Amount: **{{amountNgn}}**
Period: {{periodStart}} - {{periodEnd}}

Thanks for supporting African esports.`,
  },
  go_live: {
    label: "Go-live notification",
    body: `# {{streamerName}} just went live

**{{title}}** is streaming now.

Watch: {{streamUrl}}`,
  },
};

export function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Feature flags, branding, email templates and uploaded files."
      />
      <HowTo page="settings" />
      
      <Tabs defaultValue="flags">
        <TabsList className="bg-card">
          <TabsTrigger value="flags">
            <ToggleLeft className="mr-1 h-3.5 w-3.5" />
            Feature flags
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="mr-1 h-3.5 w-3.5" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="mr-1 h-3.5 w-3.5" />
            Email templates
          </TabsTrigger>
          <TabsTrigger value="storage">
            <Upload className="mr-1 h-3.5 w-3.5" />
            Uploads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="mt-4">
          <FeatureFlagsSection />
        </TabsContent>
        <TabsContent value="branding" className="mt-4">
          <BrandingSection />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <EmailTemplatesSection />
        </TabsContent>
        <TabsContent value="storage" className="mt-4">
          <UploadsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * A switch reads as `in_stream_shop` only to the person who named the column.
 *
 * The flag key is what the code checks and it stays the identity of the row,
 * but the line somebody reads before flipping a product feature on for every
 * viewer should be words. The description underneath says what it does; this
 * says what it is.
 */
function flagLabel(key: string): string {
  const words = key.replace(/[._-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function FeatureFlagsSection() {
  const qc = useQueryClient();
  const flagsQ = useQuery<FeatureFlag[]>({
    queryKey: ["admin", "flags"],
    queryFn: listFlags,
  });

  async function onToggle(key: string, enabled: boolean) {
    await setFlag(key, enabled);
    qc.setQueryData<FeatureFlag[]>(["admin", "flags"], (prev) =>
      (prev ?? []).map((f) => (f.key === key ? { ...f, enabled } : f)),
    );
    toast.success(`${flagLabel(key)} ${enabled ? "is on" : "is off"}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Feature flags</h3>
        <p className="text-xs text-muted-foreground">Toggle product features on or off at runtime.</p>
      </div>
      <ul className="divide-y divide-border">
        {flagsQ.isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={`sk-${i}`} className="flex items-center justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
                </div>
                <div className="h-6 w-10 rounded-full bg-muted" />
              </li>
            ))
          : (flagsQ.data ?? []).map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm text-foreground">{flagLabel(f.key)}</div>
                  <div className="text-xs text-muted-foreground">{f.description}</div>
                </div>
                <Switch checked={f.enabled} onCheckedChange={(v) => onToggle(f.key, v)} />
              </li>
            ))}
      </ul>
    </div>
  );
}

function BrandingSection() {
  const qc = useQueryClient();
  const brandingQ = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: readBranding,
  });

  const [siteName, setSiteName] = React.useState("EVO TV");
  const [tagline, setTagline] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");

  React.useEffect(() => {
    if (!brandingQ.data) return;
    setSiteName(brandingQ.data.siteName);
    setTagline(brandingQ.data.tagline);
    setLogoUrl(brandingQ.data.logoUrl);
  }, [brandingQ.data]);

  /*
   * This used to raise "Branding saved" and store nothing.
   *
   * It is the same shape of bug as the password change that said it worked and
   * left the old password valid: a screen that lies about a write is worse than
   * a screen that has no write, because the person believes the job is done.
   *
   * The colour picker is gone rather than wired. The palette is a token system
   * with a hard rule behind it, and an arbitrary hue set here would fight every
   * surface that reads those tokens.
   */
  async function onSave() {
    try {
      await writeBranding({ siteName, tagline, logoUrl });
      await qc.invalidateQueries({ queryKey: ["admin", "branding"] });
      toast.success("Branding saved. The site reads it on the next request.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the branding");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground">Branding</h3>
        <div className="space-y-1.5">
          <Label>Site name</Label>
          <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="border-border bg-card" />
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="border-border bg-card" />
        </div>
        {/*
          The colour picker is gone rather than wired. The palette is a token
          system with a rule behind it, and a hue set here would fight every
          surface that reads those tokens, including the on-air graphics.
        */}
        <p className="text-xs text-muted-foreground">
          Colour comes from the brand palette in the theme, not from here, so a
          value set on this page cannot disagree with the rest of the site.
        </p>
        {/*
          The picker used to read the file to a data URL and hand the whole
          image back as a string, so saving the branding wrote a base64 blob
          into a settings row and every page that read the branding carried it.
          With no logo set it also rendered `<img src="">`, which is the broken
          image icon the walk found sitting in the dashboard.

          Same uploader as every other image on the platform: the browser PUTs
          the bytes at the bucket and the field keeps the URL.
        */}
        <MediaUpload
          label="Logo"
          kind="image"
          folder="branding"
          value={logoUrl}
          onChange={setLogoUrl}
          hint="Shown next to the site name. A transparent PNG reads best on the dark surface."
        />
        <p className="text-xs text-muted-foreground">
          Leave it empty and the first letter of the site name is used instead.
        </p>
        <div className="pt-2">
          <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={onSave}>
            <Save className="h-4 w-4" />
            Save branding
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground">Preview</h3>
        <p className="text-xs text-muted-foreground">How branding will appear in-app.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-3 border-b border-border bg-background p-4">
            {/* The preview showed the letter tile whatever was uploaded, so
                there was no way to see the logo before saving it. */}
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={siteName}
                className="h-8 w-8 rounded-md object-contain"
              />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-black"
                style={{ backgroundColor: "var(--brand,#46e3ce)", color: "#04100f" }}
              >
                {siteName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-foreground">{siteName}</div>
              <div className="text-xs" style={{ color: "var(--brand,#46e3ce)" }}>
                {tagline}
              </div>
            </div>
          </div>
          <div className="bg-background p-4 text-sm text-foreground/80">
            <p className="mb-3">Action button preview:</p>
            <button
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--brand,#46e3ce)" }}
            >
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailTemplatesSection() {
  const [templateKey, setTemplateKey] = React.useState<keyof typeof EMAIL_TEMPLATES>("welcome");
  const [body, setBody] = React.useState(EMAIL_TEMPLATES["welcome"]!.body);
  const [saving, setSaving] = React.useState(false);

  /*
   * Open what was written last, not the shipped default.
   *
   * The editor reset to the built-in text every time a template was selected,
   * so an operator wrote something, was told it saved, came back and found the
   * original. There are two plausible readings of that and both are wrong: "it
   * did not save" and "somebody overwrote me".
   */
  const savedQ = useQuery({
    queryKey: ["admin", "email-templates"],
    queryFn: adminListEmailTemplates,
  });

  React.useEffect(() => {
    const saved = savedQ.data?.find((t) => t.key === String(templateKey));
    setBody(saved?.body ?? EMAIL_TEMPLATES[templateKey]!.body);
  }, [templateKey, savedQ.data]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const tpl = EMAIL_TEMPLATES[templateKey]!;
      const { savedAt } = await adminSaveEmailTemplate(String(templateKey), tpl.label, body);
      await savedQ.refetch();
      const niceTime = new Date(savedAt).toLocaleTimeString();
      toast.success(`Template "${tpl.label}" saved at ${niceTime}`);
    } catch {
      toast.error("Could not save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={templateKey} onValueChange={(v) => setTemplateKey(v as keyof typeof EMAIL_TEMPLATES)}>
            <SelectTrigger className="w-56 border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EMAIL_TEMPLATES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button
            className="bg-sky-600 text-white hover:bg-sky-500"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <Label>Body (markdown)</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[320px] border-border bg-background font-mono text-xs"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Use <code className="rounded bg-muted px-1">{`{{variables}}`}</code> to substitute at send-time.
      </p>
    </div>
  );
}

/**
 * Republish files the bucket kept private.
 *
 * The presigned upload asked for `public-read` in its query string and the
 * bucket ignored it, so every image the CMS uploaded landed unreadable: the
 * stream thumbnail was a broken rectangle and so was every poster uploaded the
 * same way. New uploads are checked at the source now. This is for the ones
 * already up there, and it lives here so fixing them does not need a terminal
 * on the droplet.
 */
function UploadsSection() {
  const [result, setResult] = React.useState<{
    checked: number;
    broken: number;
    repaired: number;
    stillBroken: { key: string; status: number }[];
    truncated: boolean;
  } | null>(null);

  const repair = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/uploads/repair", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `Repair failed (${res.status})`,
        );
      }
      return body as unknown as NonNullable<typeof result>;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.broken === 0) toast.success("Every uploaded file is publicly readable");
      else if (data.repaired > 0) toast.success(`Republished ${data.repaired} file${data.repaired === 1 ? "" : "s"}`);
      else toast.error("Files are still unreadable after setting their permissions");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not repair the uploads"),
  });

  return (
    <div className="overflow-hidden rounded-xl bg-card/40">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Uploaded files</h3>
        <p className="text-xs text-muted-foreground">
          Checks every file the dashboard has uploaded and fixes the ones that
          cannot be opened. A broken thumbnail or poster is almost always this.
        </p>
      </div>

      <div className="px-4 pb-4">
        <Button
          onClick={() => repair.mutate()}
          disabled={repair.isPending}
          className="bg-sky-600 text-white hover:bg-sky-500"
        >
          {repair.isPending ? "Checking files" : "Check and repair"}
        </Button>

        {result ? (
          <div className="mt-3 rounded-lg bg-background/60 p-3 text-xs text-muted-foreground">
            <p>
              {result.checked} file{result.checked === 1 ? "" : "s"} checked ·{" "}
              {result.broken} unreadable · {result.repaired} repaired
              {result.truncated ? " · more to go, run it again" : ""}
            </p>
            {result.stillBroken.length > 0 ? (
              <div className="mt-2 space-y-1">
                <p className="text-red-300">
                  These are still unreadable after setting their permissions,
                  which points at the bucket rather than the files:
                </p>
                {result.stillBroken.slice(0, 5).map((f) => (
                  <code key={f.key} className="block break-all text-[11px] text-foreground/60">
                    {f.status} · {f.key}
                  </code>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
