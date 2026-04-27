"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/auth/form-field";

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

  const onSubmit = async (_values: Values) => {
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
    toast.success("Reset link sent", {
      description: "Check your inbox for instructions.",
    });
    setTimeout(() => router.push("/login"), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-500/10 ring-1 ring-sky-500/30">
          {sent ? (
            <CheckCircle2 className="size-6 text-sky-400" />
          ) : (
            <KeyRound className="size-6 text-sky-400" />
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
          {sent ? "Check your inbox" : "Reset your password"}
        </h1>
        <p className="text-sm text-neutral-400">
          {sent
            ? "We sent you a link to reset your password. Redirecting to sign in…"
            : "Enter your email and we'll send you a password reset link."}
        </p>
      </div>

      {!sent ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6"
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
            className="h-11 w-full bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
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

      <p className="text-center text-sm text-neutral-400">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
