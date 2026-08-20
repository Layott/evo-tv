"use client";

import * as React from "react";
import { Bell, Loader2, Send } from "@/components/icons";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  adminListDestinations,
  adminPreviewAnnouncement,
  adminSendAnnouncement,
  type AnnouncementAudience,
  type AnnouncementDestination,
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
import { HowTo } from "./how-to";

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
  /*
   * Where it goes, picked from real things.
   *
   * `destKind` is the shape and `destId` is which one. A path is never typed:
   * the server composes it from the choice, so a renamed route cannot leave a
   * dead link inside a message that was already sent.
   */
  const [destKind, setDestKind] = React.useState<
    "none" | "page" | "show" | "stream" | "video" | "external"
  >("none");
  const [destPage, setDestPage] = React.useState("home");
  const [destId, setDestId] = React.useState("");
  const [destUrl, setDestUrl] = React.useState("");

  const [audienceKind, setAudienceKind] = React.useState<
    "everyone" | "role" | "user" | "users" | "subscribers" | "free"
  >("everyone");
  const [audienceRole, setAudienceRole] = React.useState("user");
  const [audienceEmail, setAudienceEmail] = React.useState("");
  const [audienceEmails, setAudienceEmails] = React.useState("");
  const [sendPush, setSendPush] = React.useState(true);
  const [sendEmail, setSendEmail] = React.useState(false);

  const destinationsQ = useQuery({
    queryKey: ["admin", "destinations"],
    queryFn: () => adminListDestinations(),
  });
  const destinations = destinationsQ.data;
  const [confirming, setConfirming] = React.useState<AnnouncementPreview | null>(null);

  const emailList = audienceEmails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));

  const audience: AnnouncementAudience =
    audienceKind === "role"
      ? { kind: "role", role: audienceRole }
      : audienceKind === "user"
        ? { kind: "user", email: audienceEmail.trim() }
        : audienceKind === "users"
          ? { kind: "users", emails: emailList }
          : audienceKind === "subscribers"
            ? { kind: "subscribers" }
            : audienceKind === "free"
              ? { kind: "free" }
              : { kind: "everyone" };

  const destination: AnnouncementDestination =
    destKind === "page"
      ? { kind: "page", page: destPage }
      : destKind === "show" && destId
        ? { kind: "show", id: destId }
        : destKind === "stream" && destId
          ? { kind: "stream", id: destId }
          : destKind === "video" && destId
            ? { kind: "video", id: destId }
            : destKind === "external" && destUrl.trim()
              ? { kind: "external", url: destUrl.trim() }
              : { kind: "none" };

  const payload = {
    title: title.trim(),
    body: body.trim(),
    destination,
    audience,
    channels: { push: sendPush, email: sendEmail },
  };

  const ready =
    payload.title.length >= 3 &&
    payload.body.length >= 3 &&
    (audienceKind !== "user" || audienceEmail.trim().length > 3) &&
    (audienceKind !== "users" || emailList.length > 0) &&
    (destKind !== "show" || Boolean(destId)) &&
    (destKind !== "stream" || Boolean(destId)) &&
    (destKind !== "video" || Boolean(destId)) &&
    (destKind !== "external" || destUrl.trim().startsWith("http"));

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
          `${result.webDelivered} browser${result.emailed ? `, ${result.emailed} emails` : ""}.`,
      );
      setConfirming(null);
      setTitle("");
      setBody("");
      setDestKind("none");
      setDestId("");
      setDestUrl("");
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
      <HowTo page="announcements" />

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

          {/*
            Where tapping it goes, picked rather than typed.
            
            This was a box asking for "/channel", which needs the operator to
            know the route table and ships a dead link the day a route is
            renamed. The path is composed on the server from whatever is chosen
            here.
          */}
          <div className="space-y-2">
            <Label htmlFor="ann-dest">Where tapping it goes</Label>
            <Select
              value={destKind}
              onValueChange={(v) => {
                setDestKind(v as typeof destKind);
                setDestId("");
              }}
            >
              <SelectTrigger id="ann-dest">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Just open the app</SelectItem>
                <SelectItem value="page">A page</SelectItem>
                <SelectItem value="show">A show</SelectItem>
                <SelectItem value="stream">A broadcast</SelectItem>
                <SelectItem value="video">A video</SelectItem>
                <SelectItem value="external">Somewhere off EVO TV</SelectItem>
              </SelectContent>
            </Select>

            {destKind === "page" ? (
              <Select value={destPage} onValueChange={setDestPage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(destinations?.pages ?? []).map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {destKind === "show" || destKind === "stream" || destKind === "video" ? (
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      destinationsQ.isPending ? "Loading…" : "Pick one"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {((destKind === "show"
                    ? destinations?.shows
                    : destKind === "stream"
                      ? destinations?.streams
                      : destinations?.videos) ?? []
                  ).map((thing) => (
                    <SelectItem key={thing.id} value={thing.id}>
                      {thing.label}
                      {thing.detail ? (
                        <span className="text-muted-foreground"> · {thing.detail}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {destKind === "external" ? (
              <Input
                value={destUrl}
                onChange={(e) => setDestUrl(e.target.value)}
                placeholder="https://example.com/something"
                inputMode="url"
              />
            ) : null}
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
                <SelectItem value="subscribers">Everyone who is paying</SelectItem>
                <SelectItem value="free">Everyone who is not paying</SelectItem>
                <SelectItem value="role">Everyone with a role</SelectItem>
                <SelectItem value="user">One person</SelectItem>
                <SelectItem value="users">A list of people</SelectItem>
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

          {audienceKind === "users" ? (
            <div className="space-y-2">
              <Label htmlFor="ann-emails">The people</Label>
              <Textarea
                id="ann-emails"
                rows={4}
                value={audienceEmails}
                onChange={(e) => setAudienceEmails(e.target.value)}
                placeholder="one@example.com, two@example.com"
              />
              <p className="text-xs text-muted-foreground">
                {emailList.length} address{emailList.length === 1 ? "" : "es"}{" "}
                recognised. Separate them with commas, spaces or new lines.
                Addresses with no account are simply skipped, and the preview
                says how many were found.
              </p>
            </div>
          ) : null}

          {/*
            How it reaches them.
            
            The notification list is always written, because it is the only
            channel that survives a failure: a push that is refused leaves
            nothing behind, and somebody with no device would never see the
            message at all.
          */}
          <div className="space-y-2">
            <Label>How it reaches them</Label>
            <div className="space-y-2 rounded-lg bg-card/60 p-3">
              <label className="flex items-center gap-3 text-sm text-foreground/80">
                <input type="checkbox" checked disabled className="h-4 w-4" />
                Their notifications list (always)
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(e) => setSendPush(e.target.checked)}
                  className="h-4 w-4"
                />
                A push, to anyone with the app or browser notifications
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4"
                />
                An email
              </label>
            </div>
          </div>

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
                  } (${confirming.description}). ${confirming.withPushTokens} of them can receive a push right now. Tapping it opens ${confirming.destination}. There is no unsend.`
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
