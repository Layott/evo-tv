import Image from "next/image";
import Link from "next/link";

/**
 * Only links that resolve today. A footer full of dead legal links is worse than
 * a short one. `#week` rather than `/schedule`: that route does not exist, only
 * the API does.
 */
const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Watch",
    links: [
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
    <footer className="relative">
      <div className="mx-auto max-w-[92rem] px-5 py-16 sm:px-10 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/evo-logo/evo-tv-152.png"
                alt=""
                width={30}
                height={30}
                className="h-[30px] w-[30px] object-contain"
              />
              <span className="landing-display text-[1.3rem]">EVO TV</span>
            </div>
            <p className="landing-display mt-5 max-w-[16ch] text-[1.5rem] text-[var(--paper-dim)]">
              Africa&apos;s home for esports, anime and lifestyle.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--brand)]">
                {col.heading}
              </h2>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.95rem] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[var(--paper-faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} EVO TV</p>
          <p>Lagos, Nigeria · All times West Africa Time</p>
        </div>
      </div>
    </footer>
  );
}
