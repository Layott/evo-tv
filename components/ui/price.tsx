"use client";

import * as React from "react";

/**
 * A naira price, shown in the viewer's own money.
 *
 * The figure is approximate and says so, because the charge is still taken in
 * naira. A converted price presented as exact is a promise the checkout cannot
 * keep.
 *
 * The rate is fetched once per page and shared through a module-level promise,
 * so twenty prices on a shop page make one request between them.
 */

interface Fx {
  base: string;
  currency: string;
  rate: number;
  isBase: boolean;
}

let inflight: Promise<Fx | null> | null = null;

function loadFx(): Promise<Fx | null> {
  inflight ??= fetch("/api/fx")
    .then((r) => (r.ok ? (r.json() as Promise<Fx>) : null))
    .catch(() => null);
  return inflight;
}

export function formatNgn(ngn: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(ngn);
}

export function Price({
  ngn,
  className,
}: {
  ngn: number;
  className?: string;
}) {
  const [fx, setFx] = React.useState<Fx | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void loadFx().then((f) => {
      if (!cancelled) setFx(f);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const naira = formatNgn(ngn);

  // Server-rendered and pre-rate, everyone sees naira. That is the real price,
  // so there is nothing misleading about the first paint.
  if (!fx || fx.isBase || fx.currency === fx.base) {
    return <span className={className}>{naira}</span>;
  }

  const converted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: fx.currency,
    maximumFractionDigits: ngn * fx.rate < 100 ? 2 : 0,
  }).format(ngn * fx.rate);

  return (
    <span className={className} title={`Charged as ${naira}`}>
      ≈ {converted}{" "}
      <span className="text-[0.85em] opacity-60">({naira})</span>
    </span>
  );
}
