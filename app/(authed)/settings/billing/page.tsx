"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, CreditCard, ArrowLeft, BadgeCheck } from "@/components/icons";
import { toast } from "sonner";

import { useAuth } from "@/components/providers";
import { getActiveSubscription } from "@/lib/client";
import type { Subscription } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatNgn } from "@/components/profile/ngn";
import { Badge } from "@/components/ui/badge";

export default function BillingPage() {
  const { user } = useAuth();
  const [sub, setSub] = React.useState<Subscription | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const s = await getActiveSubscription(user.id);
      setSub(s);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /*
   * Only payments that happened.
   *
   * This invented three rows whenever a subscription existed, with references
   * "PS_2026_02", "PS_2026_01" and "PS_2025_12" and dates counted backwards
   * from today, so a viewer who subscribed yesterday was shown two months of
   * charges they never paid. On a billing page that is not a placeholder, it is
   * a false financial record.
   *
   * There is no payments table: the platform keeps the subscription, and
   * Paystack keeps the transactions. So the only payment we can honestly
   * evidence is the one that created this subscription, and the receipt trail
   * lives with the processor.
   */
  const history = sub
    ? [
        {
          date: new Date(sub.createdAt).toLocaleDateString(),
          amount: sub.priceNgn,
          ref: sub.providerSubId || sub.id,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to settings
      </Link>
      <h1 className="text-xl font-bold text-foreground">Billing</h1>
      <p className="text-sm text-muted-foreground">Subscription, payment method, and receipts.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <BadgeCheck className={sub ? "size-6 text-amber-400" : "size-6 text-muted-foreground"} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {sub ? "Premium" : "Free plan"}
                </h2>
                {sub ? (
                  <Badge className="bg-sky-500/25 text-sky-100">
                    Active
                  </Badge>
                ) : null}
              </div>
              {sub ? (
                <>
                  <p className="mt-1 text-sm text-foreground/80">
                    {formatNgn(sub.priceNgn)}/mo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Next charge {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-foreground/80">
                  Upgrade for ad-free, 1080p and early VOD access.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="bg-sky-500 text-ink hover:bg-sky-500/90">
                  <Link href="/upgrade">{sub ? "Change plan" : "Upgrade"}</Link>
                </Button>
                {sub ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="border-border">
                        Cancel subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Premium?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your Premium benefits stay active until{" "}
                          {new Date(sub.currentPeriodEnd).toLocaleDateString()}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Premium</AlertDialogCancel>
                        {/* This showed a success toast and cancelled nothing.
                            The endpoint has always existed. */}
                        <AlertDialogAction
                          className="bg-red-500 text-white hover:bg-red-500/90"
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/subscriptions/cancel", {
                                method: "POST",
                                credentials: "include",
                              });
                              if (!res.ok) throw new Error(await res.text());
                              setSub(null);
                              toast.success(
                                "Subscription cancelled. Premium runs to the end of the period you paid for.",
                              );
                            } catch {
                              toast.error("Could not cancel. Try again in a moment.");
                            }
                          }}
                        >
                          Confirm cancel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-base font-semibold text-foreground">Payment method</h2>
          <p className="text-sm text-muted-foreground">Managed securely via Paystack.</p>
          {/*
            No invented card.

            This printed "Visa 4242, expires 09 / 27" for every account,
            including accounts that have never paid for anything. It is the test
            card number, it was never read from anywhere, and a billing screen
            that shows somebody a card they do not own is the last place to put
            a placeholder.

            The platform does not store card details at all: Paystack charges
            per transaction and we keep the subscription, not the instrument. So
            the honest answer is what happens at renewal, and that is what this
            now says.
          */}
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-background p-4">
            <CreditCard className="size-6 text-[#00C3F7]" />
            <div className="min-w-0 flex-1">
              {sub ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    Charged through <span className="text-[#00C3F7]">Paystack</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You are asked for your card each renewal. Nothing is stored
                    here.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    No payment method needed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You are on the free tier. Paystack handles payment when you
                    subscribe.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-base font-semibold text-foreground">Payment history</h2>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-muted-foreground">
                  No payments yet.
                </TableCell>
              </TableRow>
            ) : (
              history.map((h) => (
                <TableRow key={h.ref}>
                  <TableCell>{h.date}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{h.ref}</TableCell>
                  <TableCell>{formatNgn(h.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-sky-500/25 text-sky-100">
                      Paid
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
