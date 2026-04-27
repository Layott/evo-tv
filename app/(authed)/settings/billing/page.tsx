"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, CreditCard, ArrowLeft, Crown } from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers";
import { getActiveSubscription } from "@/lib/mock";
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
  const { user } = useMockAuth();
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
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const history = sub
    ? [
        { date: new Date(sub.createdAt).toLocaleDateString(), amount: sub.priceNgn, ref: "PS_2026_02" },
        { date: new Date(Date.now() - 31 * 86400000).toLocaleDateString(), amount: sub.priceNgn, ref: "PS_2026_01" },
        { date: new Date(Date.now() - 62 * 86400000).toLocaleDateString(), amount: sub.priceNgn, ref: "PS_2025_12" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft className="size-4" /> Back to settings
      </Link>
      <h1 className="text-xl font-bold text-neutral-50">Billing</h1>
      <p className="text-sm text-neutral-400">Subscription, payment method, and receipts.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-start gap-3">
            <Crown className={sub ? "size-6 text-amber-400" : "size-6 text-neutral-600"} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-50">
                  {sub ? "Premium" : "Free plan"}
                </h2>
                {sub ? (
                  <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-300">
                    Active
                  </Badge>
                ) : null}
              </div>
              {sub ? (
                <>
                  <p className="mt-1 text-sm text-neutral-300">
                    {formatNgn(sub.priceNgn)}/mo
                  </p>
                  <p className="text-xs text-neutral-500">
                    Next charge {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-neutral-300">
                  Upgrade for ad-free, 1080p and early VOD access.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="bg-sky-500 text-black hover:bg-sky-500/90">
                  <Link href="/upgrade">{sub ? "Change plan" : "Upgrade"}</Link>
                </Button>
                {sub ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="border-neutral-800">
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
                        <AlertDialogAction
                          className="bg-red-500 text-white hover:bg-red-500/90"
                          onClick={() => toast.success("Subscription cancelled")}
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

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="text-base font-semibold text-neutral-50">Payment method</h2>
          <p className="text-sm text-neutral-400">Managed securely via Paystack.</p>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <CreditCard className="size-6 text-[#00C3F7]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-100">
                <span className="text-[#00C3F7]">Paystack</span> &middot; Visa
                &bull;&bull;&bull;&bull; 4242
              </p>
              <p className="text-xs text-neutral-500">Expires 09 / 27</p>
            </div>
            <Button
              variant="outline"
              className="border-neutral-800"
              onClick={() => toast.info("Paystack portal coming soon")}
            >
              Update
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="text-base font-semibold text-neutral-50">Payment history</h2>
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
                <TableCell colSpan={4} className="text-sm text-neutral-500">
                  No payments yet.
                </TableCell>
              </TableRow>
            ) : (
              history.map((h) => (
                <TableRow key={h.ref}>
                  <TableCell>{h.date}</TableCell>
                  <TableCell className="font-mono text-xs text-neutral-400">{h.ref}</TableCell>
                  <TableCell>{formatNgn(h.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-300">
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
