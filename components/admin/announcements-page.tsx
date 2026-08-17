"use client";

import * as React from "react";
import { Bell, Loader2, Send } from "@/components/icons";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import {
  adminPreviewAnnouncement,
  adminSendAnnouncement,
  type AnnouncementAudience,
  type AnnouncementPreview,
} from "@/lib/client";
import { ASSIGNABLE_ROLES } from "@/lib/auth/role-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "./page-header";

/**
 * Telling viewers something.
 *
 * Three channels at once: the notification row in the app and on the site, an
 * Expo push to anyone with the app, and a Web Push to anyone who allowed
 * browser notifications. The row is the one that cannot fail silently, so it is
 * always written even when nobody has a device registered.
 *
 * The preview step is not politeness. There is no unsend: once a push is with
 * Apple or Google it is gone, and "how many people is this actually going to"
 * is the question worth answering before rather than after.
 */
export function AnnouncementsPage() {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [audienceKind, setAudienceKind] = React.useState<"everyone" | "role" | "user">(
    "everyone",
  );
  const [audienceRole, setAudienceRole] = React.useState("user");
  const [audienceEmail, setAudienceEmail] = React.useState("");
  const [confirming, setConfirming] = React.useState<AnnouncementPreview | null>(null);

  const audience: AnnouncementAudience =
    audienceKind === "role"
      ? { kind: "role", role: audienceRole }
      : audienceKind === "user"
        ? { kind: "user", email: audienceEmail.trim() }
        : { kind: "everyone" };

  const payload = {
    title: title.trim(),
    body: body.trim(),
    linkUrl: linkUrl.trim(),
    audience,
  };

  const ready =
    payload.title.length >= 3 &&
    payload.body.length >= 3 &&
    (audienceKind !== "user" || audienceEmail.trim().length > 3);

  const preview = useMutation({
    mutationFn: () => adminPreviewAnnouncement(payload),
    onSuccess: (result) => setConfirming(result),
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not work out the audience"),
  });

  const send = useMutation({
    mutationFn: () => adminSendAnnouncement(payload),
    onSuccess: (result) => {
      toast.success(
        `Sent to ${result.recipients} account${result.recipients === 1 ? "" : "s"}. ` +
          `${result.expoDelivered} app push${result.expoDelivered === 1 ? "" : "es"}, ` +
          `${result.webDelivered} browser.`,
      );
      setConfirming(null);
      setTitle("");
      setBody("");
      setLinkUrl("");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not send it"),
  });

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="One message, three ways: the notification list, the app, and the browser. There is no unsend."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 rounded-xl border border-border bg-card/30 p-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="We are live with MPRO LEAGUE"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea
              id="ann-body"
              rows={4}
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Kick-off in ten minutes. Tap to watch."
            />
            <p className="text-xs text-muted-foreground">{body.length} of 500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ann-link">Where tapping it goes</Label>
            <Input
              id="ann-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/channel"
            />
            <p className="text-xs text-muted-foreground">
              An in-app path starting with a slash. Leave blank to open the app.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ann-audience">Who gets it</Label>
            <Select
              value={audienceKind}
              onValueChange={(v) => setAudienceKind(v as typeof audienceKind)}
            >
              <SelectTrigger id="ann-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone with an account</SelectItem>
                <SelectItem value="role">Everyone with a role</SelectItem>
                <SelectItem value="user">One person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audienceKind === "role" ? (
            <div className="space-y-2">
              <Label htmlFor="ann-role">Role</Label>
              <Select value={audienceRole} onValueChange={setAudienceRole}>
                <SelectTrigger id="ann-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {audienceKind === "user" ? (
            <div className="space-y-2">
              <Label htmlFor="ann-email">Email</Label>
              <Input
                id="ann-email"
                type="email"
                value={audienceEmail}
                onChange={(e) => setAudienceEmail(e.target.value)}
                placeholder="name@evotv.co"
              />
            </div>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={!ready || preview.isPending}
              onClick={() => preview.mutate()}
            >
              {preview.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Check the audience
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/30 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="h-4 w-4" />
              How it will look
            </p>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-medium text-foreground">
                {title.trim() || "Title"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {body.trim() || "The message body appears here."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/30 p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Worth knowing</p>
            <p>
              A push only reaches somebody who installed the app or allowed browser
              notifications. Everyone else still gets the message in their
              notifications list, which is why the counts differ.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this?</DialogTitle>
            <DialogDescription>
              {confirming
                ? `This reaches ${confirming.recipients} account${
                    confirming.recipients === 1 ? "" : "s"
                  } (${confirming.description}). ${confirming.withPushTokens} of them can receive a push right now. There is no unsend.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
              Not yet
            </Button>
            <Button
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
