"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, CalendarDays, Radio, User } from "@/components/icons";

/**
 * `/calendar` was a mock match calendar and now renders ComingSoon, so the
 * phone nav pointed a fifth of its taps at a dead end. `/schedule` is the real
 * programme guide and is one of the three things the MVP has to do.
 */
const items = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/schedule", label: "Schedule", Icon: CalendarDays },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/events", label: "Events", Icon: Radio },
  { href: "/profile", label: "Profile", Icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="flex items-stretch">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${
                active ? "text-sky-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
