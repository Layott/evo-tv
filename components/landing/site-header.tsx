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

        {/* Every target here clears 44px. Set by the type alone, "Sign in" was
            a 15px-tall strip of text, which is not something a thumb can hit. */}
        <nav className="flex items-center gap-3 sm:gap-5">
          <a
            href="#week"
            className="landing-display hidden min-h-11 items-center px-2 text-[1.02rem] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)] sm:flex"
          >
            Schedule
          </a>
          <Link
            href="/login"
            className="landing-display flex min-h-11 items-center px-2 text-[1.02rem] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="landing-display flex min-h-11 items-center bg-[var(--paper)] px-4 text-[0.95rem] text-[var(--ink)] transition-colors hover:bg-[var(--brand)]"
          >
            Join free
          </Link>
        </nav>
      </div>
    </header>
  );
}
