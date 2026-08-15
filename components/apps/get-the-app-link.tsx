"use client";

import Link from "next/link";

import { useAppPlatform } from "@/hooks/use-app-platform";
import { downloadFor } from "@/lib/app-download";

/**
 * The "Get the app" entry that sits in both footers.
 *
 * A footer link has no room to explain anything, so when there is nothing to
 * download it points at /apps, where the honest per-platform state lives. Once
 * a store URL is configured, a phone visitor is sent straight to their store
 * rather than through an interstitial they do not need. The server always
 * renders the /apps form, because the platform is not known until after mount.
 */
export function GetTheAppLink({
  className,
  label = "Get the app",
}: {
  className?: string;
  label?: string;
}) {
  const platform = useAppPlatform();
  const download = downloadFor(platform);

  // A direct file download still goes through /apps: firing a download off a
  // footer link, with no page saying what it is, is not something a viewer asked
  // for.
  if (!download.href || download.isDirectFile) {
    return (
      <Link href="/apps" className={className}>
        {label}
      </Link>
    );
  }

  return (
    <a href={download.href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
