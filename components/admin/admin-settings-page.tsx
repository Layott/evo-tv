"use client";

import * as React from "react";
import { Mail, Palette, Save, ToggleLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

If this wasn't you, let us know at support@evotv.app.`,
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
      <PageHeader title="Settings" description="Feature flags, branding and email templates." />

      <Tabs defaultValue="flags">
        <TabsList className="bg-neutral-900">
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
      </Tabs>
    </div>
  );
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
    toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
      <div className="border-b border-neutral-800 p-4">
        <h3 className="text-sm font-semibold text-neutral-100">Feature flags</h3>
        <p className="text-xs text-neutral-500">Toggle product features on or off at runtime.</p>
      </div>
      <ul className="divide-y divide-neutral-800">
        {flagsQ.isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={`sk-${i}`} className="flex items-center justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-800" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-neutral-800" />
                </div>
                <div className="h-6 w-10 animate-pulse rounded-full bg-neutral-800" />
              </li>
            ))
          : (flagsQ.data ?? []).map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="font-mono text-sm text-neutral-100">{f.key}</div>
                  <div className="text-xs text-neutral-400">{f.description}</div>
                </div>
                <Switch checked={f.enabled} onCheckedChange={(v) => onToggle(f.key, v)} />
              </li>
            ))}
      </ul>
    </div>
  );
}

function BrandingSection() {
  const [siteName, setSiteName] = React.useState("EVO TV");
  const [tagline, setTagline] = React.useState("African esports, live everywhere.");
  const [primary, setPrimary] = React.useState("#10b981");
  const [logoUrl, setLogoUrl] = React.useState("/evo-logo/evo-tv-152.png");
  const logoInput = React.useRef<HTMLInputElement>(null);

  function onSave() {
    toast.success("Branding saved");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h3 className="text-sm font-semibold text-neutral-100">Branding</h3>
        <div className="space-y-1.5">
          <Label>Site name</Label>
          <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="border-neutral-800 bg-neutral-900" />
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="border-neutral-800 bg-neutral-900" />
        </div>
        <div className="space-y-1.5">
          <Label>Primary color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-1"
              aria-label="Primary color"
            />
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="border-neutral-800 bg-neutral-900 font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
              {}
              <img src={logoUrl} alt="logo" className="h-full w-full object-contain p-2" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              onClick={() => logoInput.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload logo
            </Button>
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setLogoUrl(String(ev.target?.result ?? ""));
                  reader.readAsDataURL(f);
                }
              }}
            />
          </div>
        </div>
        <div className="pt-2">
          <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={onSave}>
            <Save className="h-4 w-4" />
            Save branding
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h3 className="text-sm font-semibold text-neutral-100">Preview</h3>
        <p className="text-xs text-neutral-500">How branding will appear in-app.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-800">
          <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 p-4">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-black"
              style={{ backgroundColor: primary, color: "#052e1a" }}
            >
              {siteName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">{siteName}</div>
              <div className="text-xs" style={{ color: primary }}>
                {tagline}
              </div>
            </div>
          </div>
          <div className="bg-neutral-950 p-4 text-sm text-neutral-300">
            <p className="mb-3">Action button preview:</p>
            <button
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: primary }}
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

  React.useEffect(() => {
    setBody(EMAIL_TEMPLATES[templateKey]!.body);
  }, [templateKey]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const tpl = EMAIL_TEMPLATES[templateKey]!;
      const { savedAt } = await adminSaveEmailTemplate(String(templateKey), tpl.label, body);
      const niceTime = new Date(savedAt).toLocaleTimeString();
      toast.success(`Template "${tpl.label}" saved at ${niceTime}`);
    } catch {
      toast.error("Could not save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={templateKey} onValueChange={(v) => setTemplateKey(v as keyof typeof EMAIL_TEMPLATES)}>
            <SelectTrigger className="w-56 border-neutral-800 bg-neutral-900">
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
          className="min-h-[320px] border-neutral-800 bg-neutral-950 font-mono text-xs"
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Use <code className="rounded bg-neutral-800 px-1">{`{{variables}}`}</code> to substitute at send-time.
      </p>
    </div>
  );
}
