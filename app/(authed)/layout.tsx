import { TopNav } from "@/components/shell/top-nav";
import { BottomNav } from "@/components/shell/bottom-nav";
import { LiteModeBanner } from "@/components/shell/lite-mode-banner";
import { AppFooter } from "@/components/shell/app-footer";

import type { Metadata } from "next";

/**
 * Everything under here needs a session, so a crawler sees a redirect or an
 * empty shell.
 *
 * Indexing a page whose content only exists for one signed-in person promises
 * a searcher something the page cannot give them.
 *
 * A layout's metadata applies to every page under it, so this one line covers
 * the whole group and cannot be forgotten on the next page added to it.
 * `follow` stays on: a crawler that lands here should still walk the links out
 * to the pages that are worth indexing.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};


export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LiteModeBanner />
      <TopNav />
      <main className="flex-1">{children}</main>
      <AppFooter />
      <BottomNav />
    </div>
  );
}
