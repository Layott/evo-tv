"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { useAuth } from "@/components/providers";

/**
 * The site header, which now stays put.
 *
 * It used to scroll away with the hero, so the way back to sign-in from the
 * bottom of the page was to scroll all the way up again.
 *
 * `fixed`, not `sticky`. The hero is a `min-h-svh` section with
 * `overflow-hidden`, and an ancestor with hidden overflow is a scroll container
 * that a sticky child sticks *inside*: it would have stuck to the top of the
 * hero and left with it, which looks exactly like the bug it was meant to fix.
 * Fixed positioning is safe here because nothing above it carries a transform
 * or a filter, either of which would quietly turn it back into a scrolling box.
 *
 * Over the video it is transparent, because the reel is the first thing anybody
 * should see. Past the fold it takes a dark ground so the type stays legible
 * over whatever section is behind it. No border on the edge: hairlines are out
 * across this design.
 */
export default function SiteHeader({
  /** True on the landing page, where the hero is meant to run under the bar. */
  overlay = false,
}: {
  overlay?: boolean;
}) {
  const { role } = useAuth();
  const signedIn = role !== "guest";

  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    // Threshold rather than a per-pixel value: this only ever flips a boolean,
    // so there is no reason to re-render on every frame of a scroll.
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
          scrolled ? "bg-[var(--ink)]" : "bg-transparent"
        }`}
      >
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
            <Link
              href="/#week"
              className="landing-display hidden min-h-11 items-center px-2 text-[1.02rem] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)] sm:flex"
            >
              Schedule
            </Link>
            <Link
              href="/shows"
              className="landing-display hidden min-h-11 items-center px-2 text-[1.02rem] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)] sm:flex"
            >
              Shows
            </Link>
            {/* Offering "Sign in" and "Join free" to somebody who is already
                signed in is the header telling them they are a stranger. These
                pages are reached from inside the app as well as from a shared
                link, so the bar has to know which it is. */}
            {signedIn ? (
              <Link
                href="/home"
                className="landing-display flex min-h-11 items-center bg-[var(--paper)] px-4 text-[0.95rem] text-[var(--ink)] transition-colors hover:bg-[var(--brand)]"
              >
                Watch now
              </Link>
            ) : (
              <>
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
              </>
            )}
          </nav>
        </div>
      </header>

      {/* A fixed bar is out of the flow, so on pages that are not the landing
          hero the first paragraph would start underneath it. */}
      {overlay ? null : <div aria-hidden className="h-[5.375rem]" />}
    </>
  );
}
