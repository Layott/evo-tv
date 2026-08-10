import Image from "next/image";
import Link from "next/link";

/**
 * Only links that resolve today. A footer full of dead legal links is worse
 * than a short one.
 */
const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Watch",
    links: [
      // `#week` rather than `/schedule`: that route does not exist, only the API does.
      { label: "Schedule", href: "#week" },
      { label: "Discover", href: "/discover" },
      { label: "Events", href: "/events" },
      { label: "Clips", href: "/clips" },
    ],
  },
  {
    heading: "Apps",
    links: [
      { label: "Get the app", href: "/apps" },
      { label: "Partners", href: "/partners" },
      { label: "Shop", href: "/shop" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create an account", href: "/signup" },
      { label: "Go premium", href: "/upgrade" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/evo-logo/evo-tv-152.png"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span className="font-black tracking-tight text-white">EVO TV</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Africa&apos;s home for esports, anime and lifestyle.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                {col.heading}
              </h2>
              <ul className="mt-3.5 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-6 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} EVO TV</p>
          <p>Lagos, Nigeria · All times West Africa Time</p>
        </div>
      </div>
    </footer>
  );
}
