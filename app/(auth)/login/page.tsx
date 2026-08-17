"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "@/components/icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers";
import { TextField } from "@/components/auth/form-field";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Says why somebody is looking at a login page they did not ask for.
 *
 * The API drops `evotv_signed_out` when it ends a session for inactivity.
 * Without this the site just forgets you between visits, which reads as a bug
 * rather than as the thing protecting your account on a shared machine.
 */
function useIdleSignOutNotice(): boolean {
  const [idle, setIdle] = React.useState(false);
  React.useEffect(() => {
    if (!document.cookie.split("; ").includes("evotv_signed_out=idle")) return;
    setIdle(true);
    document.cookie = "evotv_signed_out=; path=/; max-age=0";
  }, []);
  return idle;
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const signedOutForIdle = useIdleSignOutNotice();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    const { error } = await signIn(values.email, values.password);
    if (error) {
      // Deliberately does not say whether the address exists.
      toast.error("Could not sign in", {
        description: "Check your email and password and try again.",
      });
      return;
    }
    toast.success("Welcome back to EVO TV");
    router.push(next || "/home");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to follow your teams, catch lives, and join the chat.
        </p>
      </div>

      {signedOutForIdle ? (
        <div className="rounded-xl bg-muted/60 px-4 py-3" role="status">
          <p className="text-sm text-foreground">
            You were signed out after 3 hours without activity.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This keeps your account closed if you leave a shared computer.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card/50 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-foreground font-semibold">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password || undefined}
                className="flex h-11 w-full rounded-md border border-border bg-card/50 px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground shadow-xs outline-none transition focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-500/30 aria-invalid:border-destructive aria-invalid:ring-destructive/30"
                {...register("password")}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password ? (
              <p className="text-xs text-red-400" role="alert">
                {errors.password.message}
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card/50 px-2 text-[11px] st text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <OAuthButtons />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        New to EVO TV?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-semibold text-sky-400 hover:text-sky-300"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
