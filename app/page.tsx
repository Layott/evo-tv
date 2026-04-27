"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMockAuth } from "@/components/providers";

const SPLASH_MS = 2500;

export default function SplashPage() {
  const router = useRouter();
  const { role } = useMockAuth();
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const start = performance.now();
    let rafId = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / SPLASH_MS);
      setProgress(p);
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);

    const redirectId = window.setTimeout(() => {
      const next = role !== "guest" ? "/home" : "/login";
      router.replace(next);
    }, SPLASH_MS);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(redirectId);
    };
  }, [role, router]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#05091a] text-neutral-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.22),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.7)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400/15 to-cyan-400/10 p-3 shadow-lg shadow-sky-500/30 ring-1 ring-sky-400/30">
            <Image
              src="/evo-logo/evo-tv-152.png"
              alt="EVO TV"
              width={72}
              height={72}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tight">EVO TV</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-sky-400">
              esports live
            </span>
          </div>
        </div>

        <p className="mt-8 text-center text-base font-medium text-neutral-400">
          African esports, live.
        </p>

        <div className="mt-12 w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-900">
            <div
              className="h-full bg-gradient-to-r from-sky-400 via-sky-500 to-cyan-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            loading arena…
          </p>
        </div>
      </div>

      <footer className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-neutral-600">
        © {new Date().getFullYear()} EVO TV — Africa&apos;s home of mobile esports
      </footer>
    </div>
  );
}
