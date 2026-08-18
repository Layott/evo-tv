/**
 * The languages EVO TV speaks.
 *
 * These are the seven the settings screen has always offered. It offered them
 * before any of them did anything: choosing Yoruba changed a toast and nothing
 * else. The list stays as it was so nobody loses an option they had.
 *
 * Ordered by who the platform is actually for. English first because it is the
 * working language and the fallback for every missing key; then the three
 * Nigerian languages, because this is a Nigerian platform and putting French
 * above Hausa on a Lagos product would be a decision nobody made on purpose;
 * then the two that open the rest of the continent.
 */
export const LOCALES = [
  { code: "en", label: "English", english: "English" },
  { code: "yo", label: "Yorùbá", english: "Yoruba" },
  { code: "ig", label: "Igbo", english: "Igbo" },
  { code: "ha", label: "Hausa", english: "Hausa" },
  { code: "fr", label: "Français", english: "French" },
  { code: "pt", label: "Português", english: "Portuguese" },
  { code: "sw", label: "Kiswahili", english: "Swahili" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/**
 * The locale to use when nothing has been chosen.
 *
 * Reads the browser's own preference rather than assuming English, so a visitor
 * whose phone is already in French gets French before they have an account. An
 * unknown language falls back rather than guessing at a near match: "pt-BR" is
 * Portuguese, but "pt-PT" wording differences are not worth pretending about,
 * and neither is mapping "sw-KE" onto something we have not written.
 */
export function localeFromNavigator(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
