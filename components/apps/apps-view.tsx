import { AppDownloadCta } from "@/components/apps/app-download-cta";
import { BackButton } from "@/components/shell/back-button";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  type AppPlatform,
} from "@/lib/app-download";
import { formatSize, getLatestRelease } from "@/lib/api/app-releases";

/**
 * The page behind every "Get the app" link.
 *
 * It used to be a ComingSoon card naming four platforms that have never
 * shipped. Then it became honest but static: the Android link could only be
 * whatever `NEXT_PUBLIC_ANDROID_APK_URL` was inlined with at image build time,
 * so a new APK needed a website redeploy to be downloadable, and the page could
 * not say which version it was offering. Every build up to 0.1.0 build 197
 * therefore sat on one laptop and reached nobody.
 *
 * The current build is read from the database on each request, so publishing a
 * release makes it downloadable immediately, with its version and size on the
 * page. No cache to bust, no redeploy.
 */
export async function AppsView({ pinned }: { pinned?: AppPlatform }) {
  // A store listing still wins over a hosted APK when one exists, for the
  // reason lib/app-download.ts gives: a sideloaded build never updates itself.
  const androidRelease = PLAY_STORE_URL ? null : await getLatestRelease("android");
  const androidHref = PLAY_STORE_URL ?? androidRelease?.fileUrl ?? null;

  const rows: Array<{ name: string; href: string | null; detail?: string }> = [
    {
      name: "Android",
      href: androidHref,
      detail: androidRelease
        ? `Version ${androidRelease.version}, build ${androidRelease.buildNumber}, ${formatSize(androidRelease.sizeBytes)}`
        : undefined,
    },
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

      <div className="mt-8 flex flex-col items-center rounded-2xl bg-card p-6 text-center">
        <AppDownloadCta pinned={pinned} androidHref={androidHref} />
        {androidRelease && !PLAY_STORE_URL ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Version {androidRelease.version}, build {androidRelease.buildNumber},{" "}
            {formatSize(androidRelease.sizeBytes)}. Android will ask you to allow
            an app from an unknown source.
          </p>
        ) : null}
      </div>

      <ul className="mt-8 rounded-2xl bg-card">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4"
          >
            <span className="text-sm font-medium text-foreground">
              {row.name}
              {row.detail ? (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {row.detail}
                </span>
              ) : null}
            </span>
            {row.href ? (
              <a
                href={row.href}
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
