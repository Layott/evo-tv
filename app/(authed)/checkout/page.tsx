"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers";
import { getProductById } from "@/lib/client";
import type { Order, OrderItem, Product } from "@/lib/types";
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
import {
  CART_KEY,
  ORDERS_KEY,
  CartLine,
  clearCart,
  getCart,
} from "@/components/shop/cart-store";
import { formatNgn } from "@/components/profile/ngn";

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

function newId() {
  return `order_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const search = useSearchParams();
  const plan = search.get("plan");
  const isSubscription = plan === "premium";
  const { user } = useMockAuth();

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
  const subtotal = isSubscription ? 4_500 : cartSubtotal;
  const shipping = isSubscription
    ? 0
    : cartSubtotal >= FREE_SHIPPING_MIN
    ? 0
    : SHIPPING_FEE;
  const total = subtotal + shipping;

  async function finishOrder(shippingValues: ShippingValues | null) {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1_200));

    const id = newId();
    const items: OrderItem[] = isSubscription
      ? [
          {
            productId: "sub_premium",
            productName: "Premium Subscription — Monthly",
            variantId: null,
            variantLabel: "Monthly",
            qty: 1,
            unitPriceNgn: 4_500,
            thumbnailUrl: "/premium-sub.jpg",
          },
        ]
      : resolved.map<OrderItem>((r) => ({
          productId: r.product.id,
          productName: r.product.name,
          variantId: r.variantId,
          variantLabel: r.variantLabel,
          qty: r.qty,
          unitPriceNgn: r.unit,
          thumbnailUrl: r.product.images[0] ?? "/placeholder.svg",
        }));

    const order: Order = {
      id,
      userId: user?.id ?? "user_current",
      status: "paid",
      items,
      subtotalNgn: subtotal,
      shippingNgn: shipping,
      totalNgn: total,
      shipping: {
        fullName: shippingValues?.fullName ?? user?.displayName ?? "Customer",
        phone: shippingValues?.phone ?? "",
        address1: shippingValues?.address1 ?? "",
        address2: shippingValues?.address2 ?? "",
        city: shippingValues?.city ?? "",
        state: shippingValues?.state ?? "",
        country: shippingValues?.country ?? "Nigeria",
      },
      paymentProvider: "paystack",
      paymentRef: `PS_${id.slice(-8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      trackingNumber: null,
    };

    try {
      const existing = JSON.parse(window.localStorage.getItem(ORDERS_KEY) || "[]");
      const arr = Array.isArray(existing) ? existing : [];
      arr.unshift(order);
      window.localStorage.setItem(ORDERS_KEY, JSON.stringify(arr));
      if (!isSubscription) {
        clearCart();
        window.localStorage.removeItem(CART_KEY);
      }
    } catch {
      /* noop */
    }

    toast.success(isSubscription ? "Premium activated" : "Payment successful");
    router.push(`/order/${id}`);
  }

  function onShippingSubmit(values: ShippingValues) {
    void finishOrder(values);
  }

  function mockSimulate() {
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
        <h1 className="text-xl font-bold text-neutral-50">Your cart is empty</h1>
        <p className="mt-1 text-sm text-neutral-400">Add items before checking out.</p>
        <Button asChild className="mt-5 bg-sky-500 text-black hover:bg-sky-500/90">
          <Link href="/shop">Go to shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <Link
        href={isSubscription ? "/upgrade" : "/cart"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft className="size-4" />
        {isSubscription ? "Back to upgrade" : "Back to cart"}
      </Link>
      <h1 className="mb-6 text-xl font-bold text-neutral-50">
        {isSubscription ? "Confirm Premium" : "Checkout"}
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!isSubscription ? (
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-4 text-base font-semibold text-neutral-50">
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

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
            <h2 className="mb-4 text-base font-semibold text-neutral-50">Payment</h2>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center gap-3">
                <PaystackMark />
                <div>
                  <p className="text-sm font-semibold">Pay with Paystack</p>
                  <p className="text-xs text-neutral-400">Cards, bank transfer, USSD, Opay.</p>
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
                className="w-full border-neutral-800"
                disabled={processing}
                onClick={mockSimulate}
              >
                {processing ? <Loader2 className="size-4 animate-spin" /> : null}
                Mock simulate
              </Button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-neutral-500">
              <ShieldCheck className="size-3 text-sky-400" />
              256-bit secure. No card data leaves Paystack.
            </p>
          </section>
        </div>

        <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="text-base font-semibold text-neutral-50">Order summary</h2>
          <div className="mt-3 divide-y divide-neutral-800">
            {isSubscription ? (
              <div className="flex items-center gap-3 py-3">
                <div className="relative size-14 overflow-hidden rounded-lg bg-amber-500/20">
                  <Image src="/premium-sub.jpg" alt="" fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">EVO TV Premium</p>
                  <p className="text-xs text-neutral-400">Billed monthly</p>
                </div>
                <div className="text-sm font-semibold">{formatNgn(4500)}</div>
              </div>
            ) : (
              resolved.map((r) => (
                <div
                  key={`${r.productId}-${r.variantId ?? ""}`}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                    <Image
                      src={r.product.images[0] ?? "/placeholder.svg"}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{r.product.name}</p>
                    <p className="text-xs text-neutral-500">
                      {r.variantLabel ? `${r.variantLabel} · ` : ""}Qty {r.qty}
                    </p>
                  </div>
                  <div className="text-sm font-semibold">{formatNgn(r.subtotal)}</div>
                </div>
              ))
            )}
          </div>
          <dl className="mt-3 space-y-2 border-t border-neutral-800 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-400">Subtotal</dt>
              <dd>{formatNgn(subtotal)}</dd>
            </div>
            {!isSubscription ? (
              <div className="flex justify-between">
                <dt className="text-neutral-400">Shipping</dt>
                <dd>{shipping === 0 ? <span className="text-sky-400">Free</span> : formatNgn(shipping)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-neutral-800 pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatNgn(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
