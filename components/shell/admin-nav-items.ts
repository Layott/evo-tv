import {
  BarChart3,
  Bell,
  Calendar,
  CalendarRange,
  CreditCard,
  FileText,
  Film,
  Fingerprint,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Radio,
  ClipboardText,
  Settings,
  Store,
  Shield,
  ShoppingBag,
  Tv,
  Users,
  Vote,
  type Icon,
} from "@/components/icons";

import { hasCapability, type Capability } from "@/lib/auth/capabilities";

export interface AdminNavItem {
  href: string;
  label: string;
  Icon: Icon;
  /** Only `/admin` itself needs an exact match, or it lights up on every page. */
  exact?: boolean;
  /**
   * The room this section belongs to. Defaults to `roster`, which only admins
   * and above hold, so a new entry is private until somebody says otherwise.
   *
   * Filtering the nav is a courtesy, not a control: the API checks the same
   * table on every route. What it prevents is a programmer clicking Orders and
   * being told off for it.
   */
  capability?: Capability;
}

/**
 * The admin navigation, in one list.
 *
 * It used to live inside the desktop sidebar, which is `hidden md:flex`. That
 * meant a phone got no navigation at all: not a collapsed one, not a hamburger,
 * nothing. Every /admin page below the md breakpoint was a dead end you could
 * only leave by editing the URL. Two components now render this same list, one
 * for each viewport, so a route added here appears in both.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // Overview is the analytics dashboard, and every analytics endpoint behind it
  // is admin-gated. Listing it for support would be listing a page of errors.
  // Overview is the analytics dashboard and every endpoint behind it is
  // admin-gated, so it stays in the roster room rather than being a page of
  // errors for everybody else.
  { href: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/admin/shows", label: "Shows", Icon: Tv, capability: "editorial" },
  { href: "/admin/schedule", label: "Schedule", Icon: CalendarRange, capability: "editorial" },
  { href: "/admin/calendar", label: "Calendar", Icon: Calendar, capability: "editorial" },
  { href: "/admin/library", label: "Library", Icon: Film, capability: "editorial" },
  { href: "/admin/streams", label: "Streams", Icon: Radio, capability: "broadcast" },
  { href: "/admin/content", label: "Content", Icon: FileText, capability: "editorial" },
  { href: "/admin/polls", label: "Polls", Icon: Vote, capability: "editorial" },
  { href: "/admin/announcements", label: "Announcements", Icon: Bell, capability: "editorial" },
  { href: "/admin/ads", label: "Ads", Icon: Megaphone, capability: "commerce" },
  { href: "/admin/users", label: "Users & roles", Icon: Users, capability: "support" },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/admin/shop", label: "Shop", Icon: Store, capability: "commerce" },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingBag, capability: "support" },
  { href: "/admin/subscriptions", label: "Subscriptions", Icon: CreditCard, capability: "commerce" },
  { href: "/admin/moderation", label: "Moderation", Icon: Shield, capability: "community" },
  { href: "/admin/billing", label: "Billing & USSD", Icon: Landmark, capability: "commerce" },
  { href: "/admin/forensic", label: "Forensic", Icon: Fingerprint, capability: "broadcast" },
  { href: "/admin/audit", label: "Audit log", Icon: ClipboardText, capability: "roster" },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

/** The sections a role may open, in nav order. */
export function adminNavFor(role: string | null | undefined): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) =>
    hasCapability(role, item.capability ?? "roster"),
  );
}

/** Shared so the sidebar and the drawer cannot disagree about what is active. */
export function isAdminNavItemActive(
  item: AdminNavItem,
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/** The label for the current route, used as the mobile bar's title. */
export function adminNavTitle(pathname: string | null): string {
  // Longest href first, so /admin/users/roles prefers "Users & roles" over the
  // exact-match Overview entry.
  const match = [...ADMIN_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isAdminNavItemActive(item, pathname));
  return match?.label ?? "Admin";
}
