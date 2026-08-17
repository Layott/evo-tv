import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <img
            src="/evo-logo/evo-tv-152.png"
            alt="EVO TV"
            width={56}
            height={56}
            className="object-contain"
          />
        </div>
        <div className="mb-2 text-[11px] font-semibold st text-sky-400">
          404 · Not found
        </div>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          This stream has ended
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          We couldn&apos;t find what you&apos;re looking for. The page may have moved or the
          event may have concluded.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/home"
            className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-ink hover:bg-sky-400"
          >
            Back to home
          </Link>
          <Link
            href="/discover"
            className="rounded-full  px-5 py-2 text-sm text-foreground hover:bg-card"
          >
            Discover
          </Link>
        </div>
      </div>
    </div>
  );
}
