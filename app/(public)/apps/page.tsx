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
  title: "Get EVO TV",
  description: "Where to download the EVO TV app, and what runs in a browser today.",
  /*
   * Without this the page has no canonical, so a crawler arriving with a
   * tracking parameter on the URL treats `?utm_source=x` as a separate page
   * and splits the ranking between them.
   */
  alternates: { canonical: "/apps" },
  openGraph: {
    title: "Get EVO TV",
    description: "Where to download the EVO TV app, and what runs in a browser today.",
    url: "/apps",
  },
};

export default function Page() {
  return <AppsView />;
}
