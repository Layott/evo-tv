"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMockAuth } from "@/components/providers";
import { simulateSsoLogin, type SsoProvider } from "@/lib/mock/sso";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.468 2.227-1.236 3.02-.823.852-2.175 1.512-3.25 1.427-.137-1.104.413-2.246 1.146-2.984.823-.83 2.23-1.437 3.34-1.463zM20.5 17.403c-.578 1.336-.855 1.932-1.6 3.114-1.04 1.648-2.505 3.7-4.32 3.717-1.613.015-2.028-1.05-4.217-1.037-2.19.012-2.646 1.053-4.26 1.037-1.815-.018-3.204-1.87-4.243-3.517C-.96 16.062-1.27 10.665 1.187 7.74c1.75-2.09 4.516-3.31 7.115-3.31 2.65 0 4.318 1.454 6.512 1.454 2.13 0 3.426-1.456 6.49-1.456 2.316 0 4.77 1.266 6.513 3.452-5.717 3.13-4.795 11.29-1.317 9.524z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.607 1.25a18.27 18.27 0 0 0-5.487 0c-.163-.386-.395-.875-.607-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.294.075.075 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 0 1 .079.009c.12.098.246.198.373.295a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.77 1.364 1.225 1.994a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.057c.5-4.761-.838-8.898-3.549-12.562a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.156.964 2.156 2.157 0 1.19-.963 2.156-2.156 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.157.964 2.157 2.157 0 1.19-.964 2.156-2.157 2.156z" />
    </svg>
  );
}

const providers = [
  { key: "google", label: "Google", Icon: GoogleIcon },
  { key: "apple", label: "Apple", Icon: AppleIcon },
  { key: "discord", label: "Discord", Icon: DiscordIcon },
] as const;

export function OAuthButtons({ className }: { className?: string }) {
  const router = useRouter();
  const { login, onboardingComplete } = useMockAuth();
  const [active, setActive] = React.useState<SsoProvider | null>(null);

  async function handleProvider(provider: SsoProvider, label: string) {
    if (active) return;
    setActive(provider);
    try {
      const { profile, providerLabel } = await simulateSsoLogin(provider);
      // Mock-auth has role-based login, not arbitrary profile login. Treat all SSO logins as standard "user".
      login("user");
      toast.success(`Signed in as ${profile.handle} via ${providerLabel}`);
      // Send to onboarding for first-time SSO users; otherwise to home.
      router.push(onboardingComplete ? "/home" : "/onboarding");
    } catch {
      toast.error(`Could not sign in with ${label}`);
    } finally {
      setActive(null);
    }
  }

  const activeLabel = active ? providers.find((p) => p.key === active)?.label ?? active : null;

  return (
    <>
      <div className={cn("grid grid-cols-3 gap-2", className)}>
        {providers.map(({ key, label, Icon }) => {
          const loading = active === key;
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              disabled={!!active}
              onClick={() => handleProvider(key, label)}
              aria-label={`Sign in with ${label}`}
              className="w-full border-neutral-800 bg-neutral-900/50 text-neutral-200 transition-colors hover:bg-neutral-900 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              <span className="hidden sm:inline">{label}</span>
            </Button>
          );
        })}
      </div>

      <Dialog open={!!active}>
        <DialogContent className="max-w-sm border-neutral-800 bg-neutral-950 text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
              <Loader2 className="size-5 animate-spin" />
            </div>
            <DialogTitle>Authorizing with {activeLabel}…</DialogTitle>
            <DialogDescription>
              Connecting your {activeLabel} account to EVO TV. This won't take a second.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
