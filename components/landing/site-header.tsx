import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-[92rem] items-center justify-between px-5 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="EVO TV home">
          <Image
            src="/evo-logo/evo-tv-152.png"
            alt=""
            width={34}
            height={34}
            priority
            className="h-[34px] w-[34px] object-contain"
          />
          <span className="landing-display text-[1.45rem] tracking-[-0.04em]">
            EVO TV
          </span>
        </Link>

        <nav className="flex items-center gap-6 sm:gap-8">
          <a
            href="#week"
            className="hidden text-[0.8rem] font-medium uppercase tracking-[0.16em] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)] sm:block"
          >
            Schedule
          </a>
          <Link
            href="/login"
            className="text-[0.8rem] font-medium uppercase tracking-[0.16em] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="landing-display bg-[var(--paper)] px-4 py-2 text-[0.95rem] text-[var(--ink)] transition-colors hover:bg-[var(--brand)]"
          >
            Join free
          </Link>
        </nav>
      </div>
    </header>
  );
}
