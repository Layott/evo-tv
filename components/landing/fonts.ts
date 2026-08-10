import { Bricolage_Grotesque } from "next/font/google";

/**
 * Display face for the landing page only.
 *
 * Declared here rather than in `app/layout.tsx` so it is scoped to this route's
 * bundle and the other 93 pages do not pay for it.
 *
 * Bricolage Grotesque is a variable editorial face with genuinely odd terminals
 * and very tight apertures at heavy weights. Geist — the app's UI font — is a
 * neutral tech grotesque, which is a large part of why the first version of this
 * page read as a dashboard rather than a channel.
 */
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  // Explicit weights rather than `axes`: next/font rejects the two together.
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
