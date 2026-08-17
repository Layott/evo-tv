"use client";

import Link from "next/link";
import { Download, Globe } from "@/components/icons";

import { Button } from "@/components/ui/button";
import { useAppPlatform } from "@/hooks/use-app-platform";
import { downloadFor, type AppPlatform } from "@/lib/app-download";

/**
 * The primary "get the app" action, which only ever offers something that
 * exists.
 *
 * When a store listing or a hosted build is configured for the platform the
 * visitor is on, this is a real download button pointed at it. When there is
 * nothing, it says so in plain words and hands them the web app instead of
 * bouncing them to a store search that will not find us.
 *
 * `pinned` overrides detection so /apps/android and /apps/ios can each speak
 * about one platform regardless of the device reading the page.
 *
 * `androidHref` comes from the server, which reads the current release from the
 * database. It is passed in rather than read here because this is a client
 * component: the environment variable it used to rely on is inlined at image
 * build time, so a newly published APK could not appear without a redeploy.
 */
export function AppDownloadCta({
  pinned,
  androidHref,
}: {
  pinned?: AppPlatform;
  androidHref?: string | null;
}) {
  const detected = useAppPlatform();
  const platform = pinned ?? detected;
  const download = downloadFor(platform, androidHref ?? null);

  if (download.href) {
    return (
      <Button asChild className="min-h-11 bg-sky-600 px-5 text-ink hover:bg-sky-500">
        <a
          href={download.href}
          // A store page is somewhere the viewer comes back from, so it opens in
          // its own tab. A file we host is not: sending that to a new tab leaves
          // them staring at a blank one once the download starts.
          {...(download.isDirectFile
            ? { download: "" }
            : { target: "_blank", rel: "noopener noreferrer" })}
        >
          <Download className="size-4" />
          {download.label}
        </a>
      </Button>
    );
  }

  const missing =
    platform === "android"
      ? "The EVO TV app is not out on Android yet."
      : platform === "ios"
        ? "The EVO TV app is not out on iPhone or iPad yet."
        : "There is no desktop app for EVO TV.";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {missing} Everything on EVO TV works in a browser today, on a phone or a laptop.
      </p>
      <Button asChild className="min-h-11 bg-sky-600 px-5 text-ink hover:bg-sky-500">
        <Link href="/home">
          <Globe className="size-4" />
          Watch in your browser
        </Link>
      </Button>
    </div>
  );
}
