"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu } from "@/components/icons";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  adminNavFor,
  adminNavTitle,
  isAdminNavItemActive,
} from "@/components/shell/admin-nav-items";
import { useAuth } from "@/components/providers";

/**
 * The admin navigation on a phone.
 *
 * A sticky bar carrying the current section's name, and a drawer holding the
 * same list the desktop sidebar shows. It replaces nothing: below `md` there
 * was previously no navigation on any admin page at all.
 *
 * The bar shows the section name rather than just "Admin" because the sidebar
 * is what told you where you were, and losing it on a small screen also lost
 * that.
 */
export function AdminMobileNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const [open, setOpen] = React.useState(false);
  // Only the sections this role can actually open. A moderator seeing Ads and
  // Settings in the menu is a list of doors that answer 403.
  const items = React.useMemo(() => adminNavFor(role), [role]);

  // Navigating from inside the drawer has to close it. Radix keeps the sheet
  // mounted across a client-side route change, so without this the menu stays
  // over the page you just asked for.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            // 44px, which is the smallest target Apple and Google both consider
            // reliably tappable. The desktop rows are 36px and too small here.
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>

        <SheetContent
          side="left"
          className="w-[17rem] border-border bg-background p-0 text-foreground"
        >
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle className="flex items-center gap-2 text-left text-foreground">
              {}
              <img
                src="/evo-logo/evo-tv-152.png"
                alt=""
                width={28}
                height={28}
                className="object-contain"
              />
              <span>
                <span className="block text-sm font-semibold">EVO TV</span>
                <span className="block text-[10px] uppercase tracking-wider text-sky-400">
                  Admin CMS
                </span>
              </span>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {items.map(({ href, label, Icon, exact }) => {
              const active = isAdminNavItemActive({ href, label, Icon, exact }, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`mb-0.5 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                    active
                      ? "bg-accent text-sky-300"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            <Link
              href="/home"
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to app
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-sky-400">
          Admin CMS
        </div>
        <div className="truncate text-sm font-semibold text-foreground">
          {adminNavTitle(pathname)}
        </div>
      </div>
    </div>
  );
}
