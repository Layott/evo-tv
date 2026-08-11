"use client";

import * as React from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.7v2.98A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.68a7.2 7.2 0 0 1 0-4.6V7.1H1.7a12 12 0 0 0 0 10.56l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.2 15.1 0 12 0 7.4 0 3.42 2.64 1.7 6.48l3.85 2.98C6.46 6.76 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c-.02-2.4 1.96-3.55 2.05-3.61-1.12-1.63-2.86-1.86-3.48-1.89-1.48-.15-2.89.87-3.64.87-.75 0-1.91-.85-3.14-.83-1.61.02-3.1.94-3.93 2.38-1.68 2.9-.43 7.2 1.2 9.55.8 1.16 1.75 2.45 3 2.4 1.21-.05 1.67-.78 3.13-.78 1.46 0 1.87.78 3.14.75 1.3-.02 2.12-1.17 2.91-2.33.92-1.33 1.3-2.62 1.32-2.69-.03-.01-2.53-.97-2.56-3.82ZM14.2 5.2c.66-.8 1.11-1.92.99-3.03-.95.04-2.11.63-2.8 1.43-.61.71-1.15 1.85-1 2.94 1.06.08 2.14-.54 2.81-1.34Z" />
    </svg>
  );
}

/**
 * Social sign-in.
 *
 * This used to call `simulateSsoLogin` from the mock layer, which invented a
 * profile and signed the browser in as a fabricated "user" without ever
 * contacting a provider. It now hands off to Better-Auth, which redirects to the
 * provider and returns to `/oauth`.
 *
 * Only Google and Apple are offered, because those are the only two
 * `lib/auth/index.ts` registers, and each is registered only when its client id
 * and secret are present. Discord was in the mock list and has no configuration
 * behind it, so it is gone rather than showing a button that cannot work.
 */
const PROVIDERS = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

export function OAuthButtons({ className }: { className?: string }) {
  const [active, setActive] = React.useState<ProviderId | null>(null);

  async function handleProvider(provider: ProviderId, label: string) {
    if (active) return;
    setActive(provider);
    try {
      // Redirects away on success, so nothing after this runs in that case.
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/home",
      });
      if (error) {
        toast.error(`Could not sign in with ${label}`, {
          description: error.message,
        });
        setActive(null);
      }
    } catch {
      toast.error(`Could not sign in with ${label}`);
      setActive(null);
    }
  }

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {PROVIDERS.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          disabled={active !== null}
          onClick={() => handleProvider(id, label)}
          className="w-full justify-center gap-2"
        >
          <Icon className="size-4" />
          {active === id ? `Opening ${label}…` : `Continue with ${label}`}
        </Button>
      ))}
    </div>
  );
}
