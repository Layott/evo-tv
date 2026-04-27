"use client";

import * as React from "react";

const STORAGE_KEY = "evotv_lite-mode_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getLiteMode(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setLiteMode(enabled: boolean): void {
  if (!isBrowser()) return;
  try {
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // Notify listeners in the same tab — `storage` event only fires cross-tab.
    window.dispatchEvent(new CustomEvent("evotv:lite-mode", { detail: enabled }));
  } catch {
    /* noop */
  }
}

/**
 * React hook: returns `[enabled, setEnabled]` and stays in sync across tabs / components.
 * Hydration-safe — initial value is `false` on the server, rehydrates on mount.
 */
export function useLiteMode(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabledState] = React.useState<boolean>(false);

  React.useEffect(() => {
    setEnabledState(getLiteMode());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setEnabledState(event.newValue === "true");
    };
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setEnabledState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("evotv:lite-mode", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("evotv:lite-mode", onCustom);
    };
  }, []);

  const setEnabled = React.useCallback((next: boolean) => {
    setEnabledState(next);
    setLiteMode(next);
  }, []);

  return [enabled, setEnabled];
}
