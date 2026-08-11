"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers";
import { TextField, FieldWrapper } from "@/components/auth/form-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { CountrySelect, AFRICAN_COUNTRIES } from "@/components/auth/country-select";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

const countryCodes = AFRICAN_COUNTRIES.map((c) => c.code) as [string, ...string[]];

const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    handle: z
      .string()
      .min(3, "Handle must be at least 3 characters")
      .max(20, "Handle must be 20 characters or fewer")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
    country: z.enum(countryCodes, { message: "Select a country" }),
    acceptTerms: z.literal(true, { message: "You must accept the terms" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      handle: "",
      password: "",
      confirmPassword: "",
      country: "NG",
      acceptTerms: false as unknown as true,
    },
  });

  const password = watch("password");
  const country = watch("country");
  const acceptTerms = watch("acceptTerms");

  const onSubmit = async (values: SignupValues) => {
    const { error } = await signUp({
      email: values.email,
      password: values.password,
      name: values.handle,
    });
    if (error) {
      toast.error("Could not create the account", { description: error });
      return;
    }
    toast.success("Account created");
    router.push("/verify-email");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Join EVO TV</h1>
        <p className="text-sm text-neutral-400">
          Create your account and start watching African esports live.
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

          <TextField
            id="handle"
            label="Handle"
            autoComplete="username"
            placeholder="evopro"
            hint="3–20 characters, letters, numbers, underscores."
            error={errors.handle?.message}
            {...register("handle")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-neutral-200 font-semibold">
              Password
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

          <TextField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <FieldWrapper id="country" label="Country" error={errors.country?.message}>
            <CountrySelect
              id="country"
              value={country || ""}
              onValueChange={(v) => setValue("country", v as SignupValues["country"], { shouldValidate: true })}
              aria-invalid={!!errors.country || undefined}
            />
          </FieldWrapper>

          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="acceptTerms"
              checked={!!acceptTerms}
              onCheckedChange={(c) =>
                setValue("acceptTerms", (c === true) as unknown as true, { shouldValidate: true })
              }
              className="mt-0.5 data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-500"
              aria-invalid={!!errors.acceptTerms || undefined}
            />
            <Label htmlFor="acceptTerms" className="text-xs leading-snug text-neutral-400">
              I agree to the{" "}
              <Link href="#" className="text-sky-400 hover:text-sky-300">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-sky-400 hover:text-sky-300">
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
          {errors.acceptTerms ? (
            <p className="-mt-2 text-xs text-red-400" role="alert">
              {errors.acceptTerms.message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account…
              </>
            ) : (
              "Create account"
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
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
