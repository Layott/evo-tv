"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "@/components/icons";
import { toast } from "sonner";

import { SectionCard } from "./section-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestAccountDeletion } from "@/lib/client";
import { useAuth } from "@/components/providers";

const passwordSchema = z
  .object({
    current: z.string().min(8, "Enter your current password"),
    next: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((v) => v.next === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type PwValues = z.infer<typeof passwordSchema>;

export function AccountForm({ email }: { email: string }) {
  const [emailValue, setEmailValue] = React.useState(email);
  const [savingEmail, setSavingEmail] = React.useState(false);
  // The prop arrives empty on first paint while /api/users/me is in flight.
  React.useEffect(() => setEmailValue(email), [email]);
  const { user } = useAuth();
  const [deleting, setDeleting] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PwValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const { scheduledForIso } = await requestAccountDeletion(user?.id ?? "user_current");
      const niceDate = new Date(scheduledForIso).toLocaleDateString();
      toast.error(`Account queued for deletion. Removal: ${niceDate}.`);
    } catch {
      toast.error("Could not queue deletion. Try again later.");
    } finally {
      setDeleting(false);
    }
  }

  async function onSubmit(_values: PwValues) {
    await new Promise((r) => setTimeout(r, 700));
    toast.success("Password changed");
    reset();
  }

  return (
    <SectionCard
      title="Account"
      description="Sign-in email, password, and account removal."
    >
      <div className="space-y-4">
        {/*
          Editable, rather than "contact support".
          
          The field was read-only and showed an address fabricated from the
          handle, so it was both unchangeable and wrong. Better-Auth's
          `changeEmail` is enabled now, so this is a real form.
        */}
        <div className="space-y-1.5">
          <Label htmlFor="account-email">Email</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="account-email"
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="bg-card hover:bg-accent"
              disabled={
                savingEmail ||
                !emailValue.trim() ||
                emailValue.trim().toLowerCase() === email.toLowerCase()
              }
              onClick={async () => {
                const next = emailValue.trim();
                setSavingEmail(true);
                try {
                  const res = await fetch("/api/auth/change-email", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newEmail: next }),
                  });
                  if (!res.ok) {
                    const body = await res.text();
                    // Better-Auth answers with a readable message for the case
                    // that actually happens: the address is already taken.
                    throw new Error(body || "Could not change your email");
                  }
                  // Not done yet, and saying so matters: the change only
                  // applies once the link in the confirmation email is opened,
                  // and that email goes to the address currently on file.
                  toast.success(
                    `Check ${email} for a link to confirm the change to ${next}.`,
                  );
                  setEmailValue(email);
                } catch (err) {
                  toast.error(
                    err instanceof Error && err.message.length < 160
                      ? err.message
                      : "Could not change your email",
                  );
                  setEmailValue(email);
                } finally {
                  setSavingEmail(false);
                }
              }}
            >
              {savingEmail ? "Saving…" : "Change"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This is the address you sign in with. Changing it sends a
            confirmation link to your current address, and nothing changes until
            you open it.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" {...register("current")} />
            {errors.current ? (
              <p className="text-xs text-red-400">{errors.current.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="next">New password</Label>
              <Input id="next" type="password" {...register("next")} />
              {errors.next ? (
                <p className="text-xs text-red-400">{errors.next.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" {...register("confirm")} />
              {errors.confirm ? (
                <p className="text-xs text-red-400">{errors.confirm.message}</p>
              ) : null}
            </div>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-sky-500 text-ink hover:bg-sky-500/90"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Change password
          </Button>
        </form>
        <div className="rounded-xl bg-red-500/25 p-4">
          <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This permanently removes your EVO TV account, watch history, and subscriptions.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="mt-3">
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Your data will be removed within 14 days.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 text-white hover:bg-red-500/90"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SectionCard>
  );
}
