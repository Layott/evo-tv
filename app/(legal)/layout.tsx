import SiteFooter from "@/components/landing/site-footer";
import SiteHeader from "@/components/landing/site-header";

/**
 * Legal pages share the landing surface, not the app shell.
 *
 * Someone reads a privacy policy before they have an account, often from a
 * link in an app store listing or an email footer. Putting them behind the
 * signed-in chrome would be wrong, and the landing theme is scoped to
 * `.landing-root`, so it has to be applied here too or these pages render in
 * the stock neutral shadcn theme and look like a different product.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-root landing-grain relative min-h-screen selection:bg-[var(--brand)] selection:text-[var(--ink)]">
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-[52rem] px-5 py-16 sm:px-10 sm:py-24">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
