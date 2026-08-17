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
  title: "EVO TV for Android",
  description: "Where to download the EVO TV Android app.",
};

/**
 * Pinned to Android so a link shared into a group chat still speaks about
 * Android when it is opened on a laptop.
 */
export default function Page() {
  return <AppsView pinned="android" />;
}
