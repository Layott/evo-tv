"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import { useMockAuth } from "@/components/providers/mock-auth-provider";

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
  const { user } = useMockAuth();
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
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input readOnly value={email} className="bg-neutral-950/60" />
          <p className="text-xs text-neutral-500">Contact support to change your email.</p>
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
            className="bg-sky-500 text-black hover:bg-sky-500/90"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Change password
          </Button>
        </form>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
          <p className="mt-1 text-xs text-neutral-400">
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
