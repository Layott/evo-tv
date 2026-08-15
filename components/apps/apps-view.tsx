import { AppDownloadCta } from "@/components/apps/app-download-cta";
import { BackButton } from "@/components/shell/back-button";
import {
  ANDROID_APK_URL,
  APP_STORE_URL,
  PLAY_STORE_URL,
  type AppPlatform,
} from "@/lib/app-download";

/**
 * The page behind every "Get the app" link.
 *
 * It used to be a ComingSoon card that named four platforms we have never
 * shipped. This says what is true per platform and, the moment a store URL or a
 * hosted build is configured, becomes a working download page without another
 * edit. The status rows are rendered on the server because the URLs are inlined
 * at build time, so only the button that depends on the visitor's device is a
 * client island.
 */
export function AppsView({ pinned }: { pinned?: AppPlatform }) {
  const rows: Array<{ name: string; href: string | null }> = [
    // The Play listing wins over a hosted APK for the same reason it does in
    // lib/app-download.ts: a sideloaded build never updates itself.
    { name: "Android", href: PLAY_STORE_URL ?? ANDROID_APK_URL },
    { name: "iPhone and iPad", href: APP_STORE_URL },
  ];

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6 sm:py-14">
      <BackButton fallbackHref="/home" />

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Get EVO TV
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We are building a native app. Until it is in the stores, this page will
        only ever offer you something that exists.
      </p>

      <div className="mt-8 flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center">
        <AppDownloadCta pinned={pinned} />
      </div>

      <ul className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4"
          >
            <span className="text-sm font-medium text-foreground">{row.name}</span>
            {row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
              >
                Download
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Not out yet</span>
            )}
          </li>
        ))}
        <li className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-sm font-medium text-foreground">Web</span>
          <span className="text-sm text-muted-foreground">Available now</span>
        </li>
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        There is no smart TV or desktop build, and we are not going to list one
        here until there is.
      </p>
    </div>
  );
}
