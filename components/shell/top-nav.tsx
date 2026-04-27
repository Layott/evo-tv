"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  Bell,
  Search,
  LogOut,
  Settings,
  User,
  ChevronDown,
  Trophy,
  Users as UsersIcon,
  Calendar,
  Tv,
  Coins,
  Code,
  Zap,
  Smartphone,
  Headphones,
  Plug,
} from "lucide-react";
import { useMockAuth } from "@/components/providers";
import { countUnread } from "@/lib/mock/notifications";
import { BrandMark } from "@/components/shell/brand-mark";

const links = [
  { href: "/home", label: "Home" },
  { href: "/channel", label: "Channel" },
  { href: "/discover", label: "Discover" },
  { href: "/events", label: "Events" },
  { href: "/calendar", label: "Calendar" },
  { href: "/shop", label: "Shop" },
];

interface MoreLink { href: string; label: string; Icon: typeof Trophy }

const moreLinks: { group: string; items: MoreLink[] }[] = [
  {
    group: "Play",
    items: [
      { href: "/predictions", label: "Predictions", Icon: Trophy },
      { href: "/pickem", label: "Pick'em brackets", Icon: Trophy },
      { href: "/fantasy", label: "Fantasy", Icon: UsersIcon },
      { href: "/watch-parties", label: "Watch parties", Icon: UsersIcon },
      { href: "/multi-stream", label: "Multi-stream", Icon: Tv },
    ],
  },
  {
    group: "Earn & save",
    items: [
      { href: "/rewards", label: "Rewards & drops", Icon: Coins },
      { href: "/tips", label: "Tips & cheers", Icon: Coins },
    ],
  },
  {
    group: "Creator",
    items: [
      { href: "/creator-program", label: "Creator program", Icon: UsersIcon },
      { href: "/creator-dashboard", label: "Creator dashboard", Icon: Zap },
      { href: "/auto-clipper", label: "Auto-clipper", Icon: Zap },
      { href: "/api-access", label: "API access", Icon: Code },
      { href: "/embed", label: "Embed player", Icon: Code },
    ],
  },
  {
    group: "Get the app",
    items: [
      { href: "/apps", label: "Apps & devices", Icon: Smartphone },
      { href: "/apps/tv", label: "Smart TV", Icon: Tv },
      { href: "/integrations", label: "Discord & Telegram", Icon: Plug },
      { href: "/partners", label: "Partners", Icon: Headphones },
    ],
  },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, logout } = useMockAuth();
  const [menu, setMenu] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [moreOpen, setMoreOpen] = React.useState(false);

  React.useEffect(() => {
    if (user) countUnread(user.id).then(setUnread);
  }, [user]);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/home" className="flex shrink-0 items-center gap-2">
          <BrandMark size={28} withWordmark={false} />
          <span className="hidden text-sm font-semibold tracking-tight text-neutral-100 sm:inline">
            EVO TV
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-neutral-900 text-neutral-100"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                moreOpen
                  ? "bg-neutral-900 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
              aria-expanded={moreOpen}
            >
              More
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div
                className="absolute left-0 top-full mt-2 w-[640px] grid grid-cols-2 gap-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-3 shadow-2xl"
                onMouseLeave={() => setMoreOpen(false)}
              >
                {moreLinks.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      {group.group}
                    </div>
                    {group.items.map(({ href, label, Icon }) => {
                      const active = pathname === href || pathname?.startsWith(href + "/");
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            active
                              ? "bg-neutral-900 text-sky-300"
                              : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-neutral-500" />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <button
          type="button"
          onClick={() => router.push("/discover")}
          className="ml-auto flex h-9 w-full max-w-xs items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 text-left text-xs text-neutral-500 transition-colors hover:border-neutral-700 hover:text-neutral-300"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search streams, teams, players…</span>
          <kbd className="ml-auto hidden rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500 sm:inline">
            /
          </kbd>
        </button>

        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 py-1 pl-1 pr-3 transition-colors hover:border-neutral-700"
            >
              <img
                src={user.avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full border border-neutral-800 object-cover"
              />
              <span className="hidden text-xs text-neutral-200 sm:inline">{user.handle}</span>
              {role === "premium" && (
                <span className="rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                  Premium
                </span>
              )}
              {role === "admin" && (
                <span className="rounded-sm bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300">
                  Admin
                </span>
              )}
            </button>
            {menu && (
              <div
                className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl"
                onMouseLeave={() => setMenu(false)}
              >
                <Link
                  href="/profile"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                  {unread > 0 && (
                    <span className="ml-auto rounded-full bg-sky-500 px-1.5 text-[10px] font-semibold text-neutral-950">
                      {unread}
                    </span>
                  )}
                </Link>
                <Link
                  href="/library"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
                >
                  <Tv className="h-4 w-4" /> Library
                </Link>
                <Link
                  href="/integrations"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
                >
                  <Plug className="h-4 w-4" /> Integrations
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                {role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 border-t border-neutral-800 px-3 py-2 text-sm text-sky-300 hover:bg-neutral-900"
                  >
                    Admin dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenu(false);
                    router.push("/");
                  }}
                  className="flex w-full items-center gap-2 border-t border-neutral-800 px-3 py-2 text-left text-sm text-rose-300 hover:bg-neutral-900"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-sky-400"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
