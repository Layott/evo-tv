import Link from "next/link";
import { BrandMark } from "@/components/shell/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05091a] text-neutral-100">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={32} />
          </Link>
          <Link href="/home" className="text-xs text-neutral-400 hover:text-neutral-100">
            Skip for now →
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        {/* Signing up is the moment the terms start applying, so both links
            belong on this page rather than only in the landing footer. */}
        <footer className="flex flex-col gap-2 px-6 py-4 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} EVO TV, Africa&apos;s home for esports, anime and lifestyle</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="transition-colors hover:text-neutral-200">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-neutral-200">
              Terms
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
