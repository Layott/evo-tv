import type { Metadata } from "next";

import { AppsView } from "@/components/apps/apps-view";

export const metadata: Metadata = {
  title: "Get EVO TV",
  description: "Where to download the EVO TV app, and what runs in a browser today.",
};

export default function Page() {
  return <AppsView />;
}
