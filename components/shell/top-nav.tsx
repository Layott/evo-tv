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
} from "lucide-react";
import { useAuth } from "@/components/providers";
import { countUnread } from "@/lib/client";
import { BrandMark } from "@/components/shell/brand-mark";

/**
 * The nav only lists what exists.
 *
 * It advertised twenty destinations, sixteen of them behind a "More" mega menu:
 * predictions, pick'em, fantasy, watch parties, multi-stream, rewards, tips,
 * creator program, auto-clipper, API access, embed, apps, integrations,
 * partners. Every one of those was a UI shell over `lib/mock` and now renders
 * ComingSoon, so the menu was a list of dead ends. Shipping it that way makes
 * the whole product read as broken rather than as young.
 *
 * These six are real: they read the database and show what an operator has
 * actually put in. Restore an entry here when its backend lands, not before.
 */
const links = [
  { href: "/home", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/channel", label: "Channel" },
  { href: "/discover", label: "Discover" },
  { href: "/events", label: "Events" },
  { href: "/shop", label: "Shop" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const [menu, setMenu] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

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
