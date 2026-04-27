"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const MOCK_EMAIL = "ade***@gmail.com";
const RESEND_COOLDOWN = 30;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Email verified");
    setIsSubmitting(false);
    router.push("/onboarding");
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN);
    toast.success("Verification code resent", { description: `Sent to ${MOCK_EMAIL}` });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-500/10 ring-1 ring-sky-500/30">
          <Mail className="size-6 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Verify your email</h1>
        <p className="text-sm text-neutral-400">
          We sent a 6-digit code to{" "}
          <span className="font-mono font-semibold text-neutral-200">{MOCK_EMAIL}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6"
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
                  className="size-12 rounded-md border border-neutral-800 bg-neutral-950 text-lg font-semibold text-neutral-100 data-[active=true]:border-sky-500 data-[active=true]:ring-sky-500/30"
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
          className="h-11 w-full bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
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
          <span className="text-neutral-500">Didn't get it? </span>
          {cooldown > 0 ? (
            <span className="text-neutral-500">Resend in {cooldown}s</span>
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

      <p className="text-center text-xs text-neutral-500">
        Tip: in local mode any 6-digit code will verify.
      </p>
    </div>
  );
}
