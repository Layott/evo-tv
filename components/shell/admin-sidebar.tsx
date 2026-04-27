"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  FileText,
  Vote,
  Megaphone,
  Users,
  BarChart3,
  Settings,
  ShoppingBag,
  Shield,
  ChevronLeft,
  Fingerprint,
  CreditCard,
} from "lucide-react";

const items = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/admin/streams", label: "Streams", Icon: Radio },
  { href: "/admin/content", label: "Content", Icon: FileText },
  { href: "/admin/polls", label: "Polls", Icon: Vote },
  { href: "/admin/ads", label: "Ads", Icon: Megaphone },
  { href: "/admin/users", label: "Users & roles", Icon: Users },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingBag },
  { href: "/admin/billing", label: "Billing & USSD", Icon: CreditCard },
  { href: "/admin/moderation", label: "Moderation", Icon: Shield },
  { href: "/admin/forensic", label: "Forensic", Icon: Fingerprint },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-900 bg-neutral-950 md:flex">
      <div className="flex items-center gap-2 border-b border-neutral-900 px-4 py-4">
        <img
          src="/evo-logo/evo-tv-152.png"
          alt="EVO TV"
          width={28}
          height={28}
          className="object-contain"
        />
        <div>
          <div className="text-sm font-semibold text-neutral-100">EVO TV</div>
          <div className="text-[10px] uppercase tracking-wider text-sky-400">Admin CMS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {items.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-neutral-900 text-sky-300"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-900 p-3">
        <Link
          href="/home"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-100"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to app
        </Link>
      </div>
    </aside>
  );
}
