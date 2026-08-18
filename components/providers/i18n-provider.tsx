"use client";

import * as React from "react";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import {
  DEFAULT_LOCALE,
  isLocale,
  localeFromNavigator,
  type Locale,
} from "@/lib/i18n/locales";
import { getUserPrefs, updateUserPrefs } from "@/lib/client";

/**
 * Language, applied rather than merely offered.
 *
 * Settings has listed seven languages since before any of them did anything:
 * choosing Yoruba produced a toast and left the product in English. The
 * preference is now read here and every translated string follows it.
 *
 * **Driven by preference, not by URL.** The obvious alternative is a `[locale]`
 * segment, which is better for search engines and would mean restructuring
 * every route in the app plus every link that points at one. This platform
 * already stores `language` per account, so reading that costs one request and
 * touches no routing. If localised URLs are wanted later, this provider is the
 * thing that changes, not four hundred call sites.
 *
 * Order of preference: what the account chose, then what was chosen on this
 * device before signing in, then what the browser asks for, then English.
 */

const STORAGE_KEY = "evotv:locale";

interface I18nValue {
  locale: Locale;
  /** Look up a key. The English string is the fallback, and so is the key. */
  t: (key: string, fallback?: string) => string;
  setLocale: (next: Locale) => void;
}

const I18nContext = React.createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  // Device first, so the page does not flash English before the account's
  // preference arrives over the network.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) {
        setLocaleState(stored);
        return;
      }
      setLocaleState(localeFromNavigator(navigator.languages ?? [navigator.language]));
    } catch {
      /* private mode, or no storage. English it is. */
    }
  }, []);

  // Then the account, which wins: it is the choice made deliberately.
  React.useEffect(() => {
    let cancelled = false;
    getUserPrefs()
      .then((p) => {
        if (cancelled || !p?.language || !isLocale(p.language)) return;
        setLocaleState(p.language);
        try {
          window.localStorage.setItem(STORAGE_KEY, p.language);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* signed out, which is not an error */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    // Persist for signed-in users. A failure here is silent on purpose: the
    // language has already changed on screen, and a toast about preferences
    // would be about the wrong thing.
    void updateUserPrefs({ language: next }).catch(() => {});
  }, []);

  const value = React.useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[locale] ?? {};
    const english = DICTIONARIES.en;
    return {
      locale,
      setLocale,
      t: (key, fallback) => dict[key] ?? english[key] ?? fallback ?? key,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Translate.
 *
 * Safe outside the provider: it returns the English dictionary rather than
 * throwing, so a component rendered in isolation (a test, a story, an email
 * preview) still produces readable text instead of blowing up.
 */
export function useT(): I18nValue {
  const ctx = React.useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key, fallback) => DICTIONARIES.en[key] ?? fallback ?? key,
  };
}
