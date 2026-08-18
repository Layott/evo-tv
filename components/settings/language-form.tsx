"use client";

import * as React from "react";
import { Loader2 } from "@/components/icons";
import { toast } from "sonner";

import { getUserPrefs, updateUserPrefs } from "@/lib/client";
import { useT } from "@/components/providers/i18n-provider";
import type { UserPrefs } from "@/lib/types";

import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGS = [
  { v: "en", label: "English" },
  { v: "fr", label: "Français" },
  { v: "pt", label: "Português" },
  { v: "ha", label: "Hausa" },
  { v: "yo", label: "Yoruba" },
  { v: "ig", label: "Igbo" },
  { v: "sw", label: "Kiswahili" },
];

/**
 * The language setting, which now persists.
 *
 * This waited 400ms and showed a toast. Nothing was read, nothing was written,
 * and reopening the page put it back to English, so a viewer who set Yoruba
 * found English again on their next visit and reasonably concluded the feature
 * did not exist. `/api/users/me/prefs` has carried a `language` field the whole
 * time; this form was the only one on the page not using it.
 */
export function LanguageForm() {
  const [lang, setLang] = React.useState<UserPrefs["language"]>("en");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const { setLocale } = useT();

  React.useEffect(() => {
    let cancelled = false;
    getUserPrefs()
      .then((p) => {
        if (!cancelled && p?.language) setLang(p.language);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const saved = await updateUserPrefs({ language: lang });
      if (!saved) throw new Error("no response");
      // Apply it now rather than on the next load. Saving a language and
      // watching the page stay in English is how this looked broken before.
      setLocale(lang);
      toast.success(
        `Language set to ${LANGS.find((l) => l.v === lang)?.label}`,
      );
    } catch {
      toast.error("Could not save your language. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Language" description="Display language across EVO TV.">
      <div className="max-w-sm space-y-3">
        <Label htmlFor="lang">App language</Label>
        <Select
          value={lang}
          onValueChange={(v) => setLang(v as UserPrefs["language"])}
          disabled={loading}
        >
          <SelectTrigger id="lang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l.v} value={l.v}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-sky-500 text-ink hover:bg-sky-500/90"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save language
        </Button>
      </div>
    </SectionCard>
  );
}
