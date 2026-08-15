"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  adminNavFor,
  isAdminNavItemActive,
} from "@/components/shell/admin-nav-items";
import { useAuth } from "@/components/providers";

/**
 * The desktop admin sidebar. Hidden below `md`, where `AdminMobileNav` takes
 * over; both render the same list filtered the same way, so neither can drift
 * from the other.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const items = React.useMemo(() => adminNavFor(role), [role]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        {}
        <img
          src="/evo-logo/evo-tv-152.png"
          alt="EVO TV"
          width={28}
          height={28}
          className="object-contain"
        />
        <div>
          <div className="text-sm font-semibold text-foreground">EVO TV</div>
          <div className="text-[10px] uppercase tracking-wider text-sky-400">Admin CMS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {items.map((item) => {
          const { href, label, Icon } = item;
          const active = isAdminNavItemActive(item, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  // `accent`, not `card`: the sidebar ground is `background`,
                  // and in the light theme a card is white, which on near-white
                  // leaves the active row invisible. Accent is a step away from
                  // the ground in both themes, which is the whole job here.
                  ? "bg-accent text-sky-300"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/home"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to app
        </Link>
      </div>
    </aside>
  );
}
