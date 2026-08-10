import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05091a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="EVO TV home">
          <Image
            src="/evo-logo/evo-tv-152.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 object-contain"
          />
          <span className="text-lg font-black tracking-tight text-white">EVO TV</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-3">
          {/* `/schedule` is not a route in this app, only `/api/schedule`. */}
          <a
            href="#week"
            className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white sm:block"
          >
            Schedule
          </a>
          <Link
            href="/login"
            className="rounded-full px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#05091a] transition-colors hover:bg-neutral-200"
          >
            Join free
          </Link>
        </nav>
      </div>
    </header>
  );
}
