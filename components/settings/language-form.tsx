"use client";

import * as React from "react";
import { Loader2 } from "@/components/icons";
import { toast } from "sonner";

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

export function LanguageForm() {
  const [lang, setLang] = React.useState("en");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    toast.success(`Language set to ${LANGS.find((l) => l.v === lang)?.label}`);
  }

  return (
    <SectionCard title="Language" description="Display language across EVO TV.">
      <div className="max-w-sm space-y-3">
        <Label htmlFor="lang">App language</Label>
        <Select value={lang} onValueChange={setLang}>
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
          className="bg-sky-500 text-black hover:bg-sky-500/90"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save language
        </Button>
      </div>
    </SectionCard>
  );
}
