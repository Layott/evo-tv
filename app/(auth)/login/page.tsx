"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMockAuth } from "@/components/providers";
import { TextField } from "@/components/auth/form-field";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");
  const { login } = useMockAuth();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const remember = watch("remember");

  const onSubmit = async (values: LoginValues) => {
    await new Promise((r) => setTimeout(r, 700));
    login("user");
    toast.success("Welcome back to EVO TV", {
      description: `Signed in as ${values.email}`,
    });
    router.push(next || "/home");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Welcome back</h1>
        <p className="text-sm text-neutral-400">
          Sign in to follow your teams, catch lives, and join the chat.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
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
              <Label htmlFor="password" className="text-neutral-200 font-semibold">
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
                className="flex h-11 w-full rounded-md border border-neutral-800 bg-neutral-900/50 px-3 pr-10 text-sm text-neutral-100 placeholder:text-neutral-600 shadow-xs outline-none transition focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-500/30 aria-invalid:border-destructive aria-invalid:ring-destructive/30"
                {...register("password")}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:text-neutral-200"
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

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={!!remember}
              onCheckedChange={(c) => setValue("remember", c === true)}
              className="data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-500"
            />
            <Label htmlFor="remember" className="text-xs text-neutral-400">
              Remember me for 30 days
            </Label>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
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
            <div className="w-full border-t border-neutral-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-neutral-900/50 px-2 text-[11px] uppercase tracking-widest text-neutral-500">
              or continue with
            </span>
          </div>
        </div>

        <OAuthButtons />
      </div>

      <p className="text-center text-sm text-neutral-400">
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
