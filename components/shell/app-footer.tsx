import Link from "next/link";

import { GetTheAppLink } from "@/components/apps/get-the-app-link";

/**
 * The legal line that has to be reachable from every page, not only the
 * landing page.
 *
 * Privacy and terms lived in the landing footer and in Settings, so a signed-in
 * viewer on `/stream/<id>` or a guest on `/discover` had no way to reach either
 * without going home first. App stores, ad networks and NDPA all expect the
 * link to be present wherever the user is.
 *
 * Deliberately plain: no rule above it, no icons. On phones it sits directly
 * above the bottom nav, so it carries its own bottom padding rather than
 * hiding under it.
 */
const LINKS: Array<{ label: string; href: string }> = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Schedule", href: "/schedule" },
  { label: "Get the app", href: "/apps" },
];

export function AppFooter() {
  return (
    <footer className="px-5 pb-8 pt-12 text-[11px] text-muted-foreground sm:px-8">
      <div className="mx-auto flex max-w-[92rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Legal and site links" className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p>© {new Date().getFullYear()} EVO TV, Lagos. All times West Africa Time.</p>
      </div>
    </footer>
  );
}
