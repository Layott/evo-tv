"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

import { SectionCard, SettingRow } from "./section-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestDataExport } from "@/lib/client";
import { useAuth } from "@/components/providers";

export function PrivacyForm() {
  const { user } = useAuth();
  const [visibility, setVisibility] = React.useState<"public" | "followers" | "private">(
    "public"
  );
  const [history, setHistory] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const { ticketId } = await requestDataExport(user?.id ?? "user_current");
      toast.success(`Export queued. Ticket: ${ticketId}. Email arrives in ~24h.`);
    } catch {
      toast.error("Could not queue export. Try again later.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <SectionCard title="Privacy" description="Control what others can see about you.">
      <div className="divide-y divide-neutral-800">
        <SettingRow
          label="Profile visibility"
          description="Who can view your profile page"
        >
          <Select
            value={visibility}
            onValueChange={(v: "public" | "followers" | "private") => {
              setVisibility(v);
              toast.success(`Visibility: ${v}`);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="followers">Followers only</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Show watch history"
          description="Let others see what you&apos;ve been watching"
        >
          <Switch
            checked={history}
            onCheckedChange={(v) => {
              setHistory(v);
              toast.success(v ? "History visible" : "History hidden");
            }}
          />
        </SettingRow>
        <SettingRow
          label="Export my data"
          description="Download a copy of your EVO TV data"
        >
          <Button
            variant="outline"
            className="border-neutral-800"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Request export
          </Button>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
