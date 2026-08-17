"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth/client";

const RESEND_COOLDOWN = 30;

/**
 * Show enough of the address to recognise it, not enough to leak it on a
 * shared screen. `MOCK_EMAIL = "ade***@gmail.com"` used to be hardcoded here
 * and shown to every user as their own address, which is worse than showing
 * nothing: it tells someone the code went somewhere it did not.
 */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const head = name.slice(0, Math.min(3, name.length));
  return `${head}${"*".repeat(Math.max(1, name.length - head.length))}@${domain}`;
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN);
  const { data: session } = authClient.useSession();
  const email = session?.user?.email ?? "";

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  /**
   * Verify for real.
   *
   * This slept for 600ms, said "Email verified", and sent the user to
   * onboarding with `email_verified` still false. Any code at all was accepted,
   * including one typed at random, so the screen proved nothing.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    if (!email) {
      setError("Sign in first, then verify this address.");
      return;
    }
    setIsSubmitting(true);
    const { error: err } = await authClient.emailOtp.verifyEmail({
      email,
      otp: code,
    });
    setIsSubmitting(false);

    if (err) {
      setError(err.message ?? "That code was not accepted. Request a new one.");
      return;
    }

    toast.success("Email verified");
    router.push("/onboarding");
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (err) {
      toast.error(err.message ?? "Could not resend the code.");
      return;
    }
    // Only start the cooldown once something was actually sent, so a failed
    // attempt does not lock the button for 30 seconds.
    setCooldown(RESEND_COOLDOWN);
    toast.success("Verification code resent", {
      description: `Sent to ${maskEmail(email)}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-500/25 text-sky-100">
          <Mail className="size-6 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-mono font-semibold text-foreground">
                {maskEmail(email)}
              </span>
            </>
          ) : (
            "Sign in first, then come back to verify your address."
          )}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border bg-card/50 p-6"
        noValidate
      >
        <div className="flex flex-col items-center gap-3">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
            }}
            containerClassName="gap-2"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="size-12 rounded-md border border-border bg-background text-lg font-semibold text-foreground data-[active=true]:border-sky-500 data-[active=true]:ring-sky-500/30"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error ? (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || code.length !== 6}
          className="h-11 w-full bg-sky-500 font-semibold text-ink hover:bg-sky-400"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify email"
          )}
        </Button>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Didn't get it? </span>
          {cooldown > 0 ? (
            <span className="text-muted-foreground">Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="font-semibold text-sky-400 hover:text-sky-300"
            >
              Resend code
            </button>
          )}
        </div>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Tip: in local mode any 6-digit code will verify.
      </p>
    </div>
  );
}
