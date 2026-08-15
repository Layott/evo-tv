import type { Metadata } from "next";

import { AppsView } from "@/components/apps/apps-view";

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
