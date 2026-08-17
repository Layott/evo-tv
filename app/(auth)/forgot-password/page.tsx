"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, KeyRound, CheckCircle2 } from "@/components/icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/auth/form-field";
import { authClient } from "@/lib/auth/client";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  /**
   * Send a real reset code.
   *
   * This slept for 600ms and then claimed "Reset link sent". It called nothing.
   * Anyone locked out followed the instruction, waited for an email that was
   * never requested, and had no way back into their account.
   *
   * It is a six digit code rather than a link, which is what the server's
   * emailOTP plugin issues, so the copy says code and the next screen asks for
   * one.
   */
  const onSubmit = async (values: Values) => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: values.email,
      type: "forget-password",
    });

    if (error) {
      toast.error(error.message ?? "Could not send the code. Try again.");
      return;
    }

    setSent(true);
    toast.success("Code sent", {
      description: "Check your inbox for a six digit code.",
    });
    // Carry the address forward so the reset screen does not ask for it twice.
    setTimeout(
      () => router.push(`/reset-password?email=${encodeURIComponent(values.email)}`),
      1200,
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-500/25 text-sky-100">
          {sent ? (
            <CheckCircle2 className="size-6 text-sky-400" />
          ) : (
            <KeyRound className="size-6 text-sky-400" />
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {sent ? "Check your inbox" : "Reset your password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {sent
            ? "We sent a six digit code to your inbox. Taking you to the next step…"
            : "Enter your email and we'll send you a six digit code to reset your password."}
        </p>
      </div>

      {!sent ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-border bg-card/50 p-6"
          noValidate
        >
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full bg-sky-500 font-semibold text-ink hover:bg-sky-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending link…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
