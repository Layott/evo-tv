import type { Metadata } from "next";

import { AppsView } from "@/components/apps/apps-view";

/**
 * Rendered per request, not prerendered.
 *
 * This page reads the current app release from the database, and the image is
 * built in Docker with no database reachable. Without this, `next build`
 * tries to prerender it, the query throws, and the whole build fails - which is
 * exactly what happened on the first attempt to deploy this. Same reason
 * /shows and the show pages carry it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EVO TV for iPhone and iPad",
  description: "Where to download the EVO TV iOS app.",
  /*
   * Without this the page has no canonical, so a crawler arriving with a
   * tracking parameter on the URL treats `?utm_source=x` as a separate page
   * and splits the ranking between them.
   */
  alternates: { canonical: "/apps/ios" },
  openGraph: {
    title: "EVO TV for iPhone and iPad",
    description: "Where to download the EVO TV iOS app.",
    url: "/apps/ios",
  },
};

/**
 * Pinned to iOS for the same reason as the Android route: the page has to be
 * about the platform in the URL, not the device that happens to open it.
 */
export default function Page() {
  return <AppsView pinned="ios" />;
}
