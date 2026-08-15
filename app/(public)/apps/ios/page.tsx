import type { Metadata } from "next";

import { AppsView } from "@/components/apps/apps-view";

export const metadata: Metadata = {
  title: "EVO TV for iPhone and iPad",
  description: "Where to download the EVO TV iOS app.",
};

/**
 * Pinned to iOS for the same reason as the Android route: the page has to be
 * about the platform in the URL, not the device that happens to open it.
 */
export default function Page() {
  return <AppsView pinned="ios" />;
}
