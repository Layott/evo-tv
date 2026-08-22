import Link from "next/link";
import { BrandMark } from "@/components/shell/brand-mark";

import type { Metadata } from "next";

/**
 * A sign-in form is not a useful search result.
 *
 * It competes with the pages that are, and "log in to EVO TV" ranking above
 * the channel itself is a worse outcome than not ranking at all.
 *
 * A layout's metadata applies to every page under it, so this one line covers
 * the whole group and cannot be forgotten on the next page added to it.
 * `follow` stays on: a crawler that lands here should still walk the links out
 * to the pages that are worth indexing.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};


export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05091a] text-foreground">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={32} />
          </Link>
          <Link href="/home" className="text-xs text-muted-foreground hover:text-foreground">
            Skip for now →
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        {/* Signing up is the moment the terms start applying, so both links
            belong on this page rather than only in the landing footer. */}
        <footer className="flex flex-col gap-2 px-6 py-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} EVO TV, Africa&apos;s home for esports, anime and lifestyle</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
