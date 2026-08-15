"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApiPaywallCard() {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/10 p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
        <Lock className="size-5" />
      </div>
      <h2 className="text-xl font-bold text-foreground">API access is a Premium feature</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Unlock 50,000 requests / month, all v1 endpoints, real-time SSE streams, and tipster-grade
        odds data.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <Button asChild className="bg-amber-500 text-black hover:bg-amber-400">
          <Link href="/upgrade">
            <Sparkles className="size-4" />
            Upgrade for API access
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-border">
          <Link href="/api-access/docs">Browse docs anyway</Link>
        </Button>
      </div>
    </div>
  );
}
