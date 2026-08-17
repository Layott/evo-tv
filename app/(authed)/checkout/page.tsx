"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, ShieldCheck } from "@/components/icons";
import { toast } from "sonner";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers";
import { createOrder, getProductById, listTiers, startSubscription } from "@/lib/client";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaystackButton, PaystackMark } from "@/components/shop/paystack-button";
import { CartLine, clearCart, getCart } from "@/components/shop/cart-store";
import { formatNgn } from "@/components/profile/ngn";
import { MediaImage } from "@/components/ui/media-image";

const NG_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara","FCT Abuja"
];

const shippingSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  phone: z
    .string()
    .regex(/^\+234[0-9\s-]{7,}$/, "Format: +234 8XX XXX XXXX"),
  address1: z.string().min(3, "Address required"),
  address2: z.string().optional(),
  city: z.string().min(2, "City required"),
  state: z.string().min(2, "State required"),
  country: z.string().min(2),
});
type ShippingValues = z.infer<typeof shippingSchema>;

const SHIPPING_FEE = 2500;
const FREE_SHIPPING_MIN = 50_000;

interface ResolvedLine extends CartLine {
  product: Product;
  unit: number;
  subtotal: number;
  variantLabel: string | null;
}

export default function CheckoutPage() {
  const search = useSearchParams();
  const plan = search.get("plan");

  /**
   * Which plan is being bought, resolved against the real ladder.
   *
   * This used to be `plan === "premium"` with the price written into the page
   * as `4_500`. Two things were wrong with that. Any other tier id fell through
   * to the shop checkout and asked for a shipping address for a subscription.
   * And the price was a copy: changing Premium in the database would have left
   * this page charging the old number, silently, with no error anywhere.
   */
  const { data: tiers = [] } = useQuery({
    queryKey: ["tiers"],
    queryFn: () => listTiers(),
  });
  const planTier = React.useMemo(
    () => tiers.find((t) => t.id === plan && t.priceNgn > 0) ?? null,
    [tiers, plan],
  );
  // `plan` present means the intent is a subscription, even before the ladder
  // has loaded. Deciding on `planTier` alone would flash the shop checkout,
  // shipping form and all, on every subscription visit.
  const isSubscription = Boolean(plan);
  const { user } = useAuth();

  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [products, setProducts] = React.useState<Record<string, Product>>({});
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShippingValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      fullName: user?.displayName ?? "",
      phone: "+234 ",
      address1: "",
      address2: "",
      city: "",
      state: "Lagos",
      country: "Nigeria",
    },
  });
  const watchedState = watch("state");

  React.useEffect(() => {
    const l = getCart();
    setLines(l);
    (async () => {
      const entries = await Promise.all(
        l.map(async (x) => {
          const p = await getProductById(x.productId);
          return p ? ([x.productId, p] as const) : null;
        })
      );
      const map: Record<string, Product> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setProducts(map);
      setLoading(false);
    })();
  }, []);

  const resolved: ResolvedLine[] = lines
    .map((l) => {
      const p = products[l.productId];
      if (!p) return null;
      const variant = l.variantId ? p.variants.find((v) => v.id === l.variantId) : null;
      const unit = variant?.priceNgn ?? p.priceNgn;
      return {
        ...l,
        product: p,
        unit,
        subtotal: unit * l.qty,
        variantLabel: variant?.label ?? null,
      };
    })
    .filter((r): r is ResolvedLine => r !== null);

  const cartSubtotal = resolved.reduce((s, r) => s + r.subtotal, 0);
  const subtotal = isSubscription ? planTier?.priceNgn ?? 0 : cartSubtotal;
  const shipping = isSubscription
    ? 0
    : cartSubtotal >= FREE_SHIPPING_MIN
    ? 0
    : SHIPPING_FEE;
  const total = subtotal + shipping;

  /**
   * Hand off to the payment provider.
   *
   * This function used to be the whole checkout: it waited 1.2 seconds, built
   * an `Order` object in the browser with a `paymentRef` of `PS_` plus eight
   * random characters, wrote it to localStorage, and said "Payment successful".
   * No money moved, no row was written, and the order existed only in that one
   * browser. The server has had `/api/orders` and `/api/payments/init` the
   * whole time.
   *
   * The client now sends ids and quantities and lets the server price it. That
   * matters beyond tidiness: the old page computed the total itself, so the
   * amount charged was whatever the page decided.
   */
  async function finishOrder(shippingValues: ShippingValues | null) {
    setProcessing(true);
    try {
      if (isSubscription) {
        if (!planTier) {
          toast.error("That plan is not available");
          return;
        }
        const { redirectUrl } = await startSubscription(planTier.id);
        // Leave the SPA entirely: this is the provider's hosted page.
        window.location.href = redirectUrl;
        return;
      }

      if (!shippingValues) {
        toast.error("Fill shipping details first");
        return;
      }

      const { redirectUrl } = await createOrder({
        items: resolved.map((r) => ({
          productId: r.productId,
          variantId: r.variantId,
          qty: r.qty,
        })),
        shipping: {
          fullName: shippingValues.fullName,
          phone: shippingValues.phone,
          address1: shippingValues.address1,
          address2: shippingValues.address2,
          city: shippingValues.city,
          state: shippingValues.state,
          country: shippingValues.country,
        },
      });

      // The cart is only cleared once the server has the order. Clearing it
      // first would lose the basket if the request failed.
      clearCart();
      window.location.href = redirectUrl;
    } catch (err) {
      // A refused payment provider, an out-of-stock line, an expired session.
      // All of them used to be impossible, because nothing was contacted.
      const message =
        err instanceof Error ? err.message : "Checkout could not be started";
      toast.error(message);
      setProcessing(false);
    }
  }

  function onShippingSubmit(values: ShippingValues) {
    void finishOrder(values);
  }

  /**
   * The pay button. Named `startPayment` when it faked a payment; it now starts
   * a real one, which is why the shipping form has to validate first.
   */
  function startPayment() {
    if (isSubscription) {
      void finishOrder(null);
      return;
    }
    handleSubmit(
      (values) => finishOrder(values),
      () => toast.error("Fill shipping details first")
    )();
  }

  if (!isSubscription && !loading && resolved.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-foreground">Your cart is empty</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add items before checking out.</p>
        <Button asChild className="mt-5 bg-sky-500 text-ink hover:bg-sky-500/90">
          <Link href="/shop">Go to shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <Link
        href={isSubscription ? "/upgrade" : "/cart"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {isSubscription ? "Back to upgrade" : "Back to cart"}
      </Link>
      <h1 className="mb-6 text-xl font-bold text-foreground">
        {isSubscription ? `Confirm ${planTier?.name ?? "plan"}` : "Checkout"}
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!isSubscription ? (
            <section className="rounded-2xl border border-border bg-card/40 p-5">
              <h2 className="mb-4 text-base font-semibold text-foreground">
                Shipping address
              </h2>
              <form
                onSubmit={handleSubmit(onShippingSubmit)}
                className="grid gap-3 sm:grid-cols-2"
                noValidate
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" {...register("fullName")} />
                  {errors.fullName ? (
                    <p className="text-xs text-red-400">{errors.fullName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+234 8XX XXX XXXX" {...register("phone")} />
                  {errors.phone ? (
                    <p className="text-xs text-red-400">{errors.phone.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address1">Address line 1</Label>
                  <Input id="address1" {...register("address1")} />
                  {errors.address1 ? (
                    <p className="text-xs text-red-400">{errors.address1.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address2">Address line 2 (optional)</Label>
                  <Input id="address2" {...register("address2")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...register("city")} />
                  {errors.city ? (
                    <p className="text-xs text-red-400">{errors.city.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={watchedState}
                    onValueChange={(v) => setValue("state", v, { shouldValidate: true })}
                  >
                    <SelectTrigger id="state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NG_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state ? (
                    <p className="text-xs text-red-400">{errors.state.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" readOnly {...register("country")} />
                </div>
              </form>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Payment</h2>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <PaystackMark />
                <div>
                  <p className="text-sm font-semibold">Pay with Paystack</p>
                  <p className="text-xs text-muted-foreground">Cards, bank transfer, USSD, Opay.</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <PaystackButton
                loading={processing}
                onClick={
                  isSubscription
                    ? () => finishOrder(null)
                    : handleSubmit(onShippingSubmit, () => toast.error("Fix shipping details"))
                }
              >
                {processing
                  ? "Processing…"
                  : `Pay ${formatNgn(total)} with Paystack`}
              </PaystackButton>
              <Button
                type="button"
                variant="outline"
                className="w-full border-border"
                disabled={processing}
                onClick={startPayment}
              >
                {processing ? <Loader2 className="size-4 animate-spin" /> : null}
                Mock simulate
              </Button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3 text-sky-400" />
              256-bit secure. No card data leaves Paystack.
            </p>
          </section>
        </div>

        <aside className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-base font-semibold text-foreground">Order summary</h2>
          <div className="mt-3 divide-y divide-border">
            {isSubscription ? (
              <div className="flex items-center gap-3 py-3">
                <div className="relative size-14 overflow-hidden rounded-lg bg-amber-500/20">
                  <Image src="/premium-sub.jpg" alt="" fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">EVO TV Premium</p>
                  <p className="text-xs text-muted-foreground">Billed monthly</p>
                </div>
                <div className="text-sm font-semibold">{formatNgn(4500)}</div>
              </div>
            ) : (
              resolved.map((r) => (
                <div
                  key={`${r.productId}-${r.variantId ?? ""}`}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {/* MediaImage rather than next/image with a placeholder
                        fallback: the stock placeholder is a near-white
                        rectangle, and a product with no photo should get the
                        branded tile like it does everywhere else. */}
                    <MediaImage
                      src={r.product.images[0]}
                      alt={r.product.name}
                      seed={r.product.id}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{r.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.variantLabel ? `${r.variantLabel} · ` : ""}Qty {r.qty}
                    </p>
                  </div>
                  <div className="text-sm font-semibold">{formatNgn(r.subtotal)}</div>
                </div>
              ))
            )}
          </div>
          <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatNgn(subtotal)}</dd>
            </div>
            {!isSubscription ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{shipping === 0 ? <span className="text-sky-400">Free</span> : formatNgn(shipping)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatNgn(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
