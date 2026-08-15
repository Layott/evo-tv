"use client";

import * as React from "react";

import { detectPlatform, type AppPlatform } from "@/lib/app-download";

/**
 * The visitor's platform, resolved after mount.
 *
 * It cannot be resolved on the server. Rendering an Android button server-side
 * and an iOS one in the browser is a hydration mismatch, and reading the user
 * agent during a request would also make every page containing this component
 * uncacheable. So the first paint is always "other", which is both the safe
 * neutral state and the correct answer for every desktop visitor.
 */
export function useAppPlatform(): AppPlatform {
  const [platform, setPlatform] = React.useState<AppPlatform>("other");

  React.useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  return platform;
}
