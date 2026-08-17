"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { TextField } from "@/components/auth/form-field";
import { authClient } from "@/lib/auth/client";

const schema = z
  .object({
    // The address the code was sent to. Prefilled from the query string when
    // arriving from /forgot-password, editable in case someone lands here
    // directly with the code from their inbox.
    email: z.string().email("Enter a valid email"),
    otp: z
      .string()
      .regex(/^\d{6}$/, "The code is six digits"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary above it or `next build` fails
  // prerendering the static shell for this route.
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: params.get("email") ?? "",
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");

  /**
   * Actually reset the password.
   *
   * This slept for 600ms, said "Password updated", and sent the user to the
   * sign-in screen with their old password still in force. Someone following
   * the reset flow would have been told it worked and then locked out again by
   * a password they had just been told was replaced.
   *
   * The code is the proof of ownership, so it is collected here rather than
   * being embedded in a link. That also means a code read off a phone works on
   * a desktop, which a link in a mobile mailbox does not.
   */
  const onSubmit = async (values: Values) => {
    const { error } = await authClient.emailOtp.resetPassword({
      email: values.email,
      otp: values.otp,
      password: values.password,
    });

    if (error) {
      toast.error(
        error.message ?? "That code was not accepted. Request a new one.",
      );
      return;
    }

    toast.success("Password updated", {
      description: "Sign in with your new password.",
    });
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-500/25 text-sky-100">
          <ShieldCheck className="size-6 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Pick something strong. You'll use it for every sign-in.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-2xl border border-border bg-card/50 p-6"
        noValidate
      >
        {/* The code proves ownership of the address, so both are collected
            before a new password is accepted. */}
        <TextField
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <TextField
          id="otp"
          label="Six digit code"
          inputMode="numeric"
          placeholder="123456"
          autoComplete="one-time-code"
          maxLength={6}
          error={errors.otp?.message}
          {...register("otp")}
        />

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-foreground font-semibold">
            New password
          </Label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password || undefined}
            className="flex h-11 w-full rounded-md border border-border bg-card/50 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-500/30 aria-invalid:border-destructive"
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
          <Label htmlFor="confirmPassword" className="text-foreground font-semibold">
            Confirm new password
          </Label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword || undefined}
            className="flex h-11 w-full rounded-md border border-border bg-card/50 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-500/30 aria-invalid:border-destructive"
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
          className="h-11 w-full bg-sky-500 font-semibold text-ink hover:bg-sky-400"
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

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
