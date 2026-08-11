export const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNgn(value: number): string {
  return ngn.format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) {
    const ahead = Math.abs(diffMs);
    if (ahead < 60_000) return "in <1m";
    if (ahead < 3_600_000) return `in ${Math.round(ahead / 60_000)}m`;
    if (ahead < 86_400_000) return `in ${Math.round(ahead / 3_600_000)}h`;
    return `in ${Math.round(ahead / 86_400_000)}d`;
  }
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`;
  if (diffMs < 7 * 86_400_000) return `${Math.round(diffMs / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hashStreamKey(key: string): string {
  if (!key) return "";
  const prefix = key.slice(0, 8);
  return `${prefix}${"•".repeat(Math.max(0, key.length - 12))}${key.slice(-4)}`;
}

/*
 * `seededRandom` lived here and is deliberately gone.
 *
 * It generated the admin overview's trend badges ("+12.4% vs last hour" beside
 * zero streams), the ads 30-day impression chart (~8,000 impressions above
 * "0 campaigns") and every figure on the analytics page. Seeded from a fixed
 * number, so the numbers were stable across reloads and looked like real
 * measurements. An operator would have made decisions on them.
 *
 * If a panel has no data, render the empty state. Do not synthesise a curve.
 */
