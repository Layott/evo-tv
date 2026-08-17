import {
  BarChart3,
  Bell,
  CalendarRange,
  CreditCard,
  FileText,
  Film,
  Fingerprint,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Radio,
  Settings,
  Store,
  Shield,
  ShoppingBag,
  Tv,
  Users,
  Vote,
  type Icon,
} from "@/components/icons";

import { hasMinRole, type PlatformRole } from "@/lib/auth/role-catalog";

export interface AdminNavItem {
  href: string;
  label: string;
  Icon: Icon;
  /** Only `/admin` itself needs an exact match, or it lights up on every page. */
  exact?: boolean;
  /**
   * The weakest role that may open this section. Defaults to `admin`.
   *
   * Filtering the nav is a courtesy, not a control: the API checks the same
   * ladder on every route. What it prevents is a moderator clicking Ads and
   * being told off for it.
   */
  minRole?: PlatformRole;
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
  { href: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/admin/shows", label: "Shows", Icon: Tv },
  { href: "/admin/schedule", label: "Schedule", Icon: CalendarRange },
  { href: "/admin/library", label: "Library", Icon: Film, minRole: "moderator" },
  { href: "/admin/streams", label: "Streams", Icon: Radio },
  { href: "/admin/content", label: "Content", Icon: FileText },
  { href: "/admin/polls", label: "Polls", Icon: Vote },
  { href: "/admin/announcements", label: "Announcements", Icon: Bell },
  { href: "/admin/ads", label: "Ads", Icon: Megaphone },
  { href: "/admin/users", label: "Users & roles", Icon: Users, minRole: "support_admin" },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/admin/shop", label: "Shop", Icon: Store, minRole: "support_admin" },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingBag, minRole: "support_admin" },
  { href: "/admin/subscriptions", label: "Subscriptions", Icon: CreditCard, minRole: "finance_admin" },
  { href: "/admin/moderation", label: "Moderation", Icon: Shield, minRole: "moderator" },
  { href: "/admin/billing", label: "Billing & USSD", Icon: Landmark, minRole: "finance_admin" },
  { href: "/admin/forensic", label: "Forensic", Icon: Fingerprint },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

/** The sections a role may open, in nav order. */
export function adminNavFor(role: string | null | undefined): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => hasMinRole(role, item.minRole ?? "admin"));
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
