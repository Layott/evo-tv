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
        <footer className="border-t border-neutral-900 px-6 py-4 text-[11px] text-neutral-500">
          © {new Date().getFullYear()} EVO TV — Africa&apos;s home of mobile esports
        </footer>
      </div>
    </div>
  );
}
