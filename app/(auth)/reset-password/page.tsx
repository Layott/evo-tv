"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = watch("password");

  const onSubmit = async (_values: Values) => {
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Password updated", {
      description: "Sign in with your new password.",
    });
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-500/10 ring-1 ring-sky-500/30">
          <ShieldCheck className="size-6 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Set a new password</h1>
        <p className="text-sm text-neutral-400">
          Pick something strong. You'll use it for every sign-in.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-neutral-200 font-semibold">
            New password
          </Label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password || undefined}
            className="flex h-11 w-full rounded-md border border-neutral-800 bg-neutral-900/50 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-500/30 aria-invalid:border-destructive"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-red-400" role="alert">
              {errors.password.message}
            </p>
          ) : null}
          <PasswordStrengthMeter password={password || ""} className="pt-1" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-neutral-200 font-semibold">
            Confirm new password
          </Label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword || undefined}
            className="flex h-11 w-full rounded-md border border-neutral-800 bg-neutral-900/50 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-500/30 aria-invalid:border-destructive"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-red-400" role="alert">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-neutral-400">
        <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
