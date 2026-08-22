import type { Metadata } from "next";
import { BRANDING_DEFAULT, readBranding } from "@/lib/api/branding";
import { Archivo, Martian_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { JsonLd, organization, website } from "@/lib/seo/json-ld";
import "./globals.css";

/**
 * One family, headings and body both.
 *
 * The product used to run Geist for UI and Bricolage Grotesque for headings.
 * Geist is banned outright by the no-vibecoded-look rule, and two unrelated
 * families was the wrong shape anyway: the admin CMS and the channel headline
 * had nothing in common.
 *
 * Archivo carries a real `wdth` axis, which is what earns it the job. A
 * broadcast headline is set wide, the way a scoreboard or a lower-third is,
 * and the same family runs at normal width for 12px table text without a
 * second download. `axes: ["wdth"]` is what makes that axis reach the browser;
 * without it next/font ships the weight axis alone and every
 * `font-variation-settings: "wdth"` silently does nothing.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/**
 * Stream keys, timecodes, bitrates, ingest URLs.
 *
 * Martian Mono is wide on purpose - it is drawn so a character cannot be
 * mistaken for a similar one, which is the only thing that matters when
 * somebody is copying a stream key off a screen.
 */
const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian-mono",
  display: "swap",
});

/**
 * The name and tagline an operator set, read on the server for every request.
 *
 * `generateMetadata` rather than a constant, because the Branding tab writes a
 * row and a constant would go on saying whatever was compiled in. A failed read
 * falls back to the shipped words rather than an empty title.
 */
export async function generateMetadata(): Promise<Metadata> {
  const branding = await readBranding().catch(() => BRANDING_DEFAULT);
  return {
    ...metadata,
    title: {
      default: `${branding.siteName}. ${branding.tagline}`,
      template: `%s | ${branding.siteName}`,
    },
    openGraph: { ...metadata.openGraph, siteName: branding.siteName },
  };
}

const metadata: Metadata = {
  // Required for Open Graph and canonical URLs to resolve to absolute
  // addresses. Without it Next emits relative og:image paths, which every
  // social scraper ignores, so shared links render with no preview.
  metadataBase: new URL("https://evotv.co"),
  title: {
    // `template` lets a page set its own title without repeating the brand.
    // All 94 pages currently share one title, which is fine behind a login
    // and actively harmful for a public site: search engines collapse
    // identically-titled pages and social shares all look the same.
    default: "EVO TV. Africa's home for esports, anime and lifestyle.",
    template: "%s | EVO TV",
  },
  description:
    "Live esports, anime and lifestyle, streaming 24/7 from Africa. Tournaments, shows, highlights and community.",
  generator: "EVO TV",
  openGraph: {
    type: "website",
    siteName: "EVO TV",
    locale: "en_NG",
    url: "https://evotv.co",
  },
  twitter: { card: "summary_large_image" },
  /*
   * No `images` here either. app/opengraph-image.png and app/twitter-image.png
   * are file conventions: Next hashes them, emits og:image and twitter:image
   * with absolute URLs off `metadataBase`, and adds the width, height and type
   * that scrapers need to render a card without fetching the file first.
   *
   * Any route can override the picture by dropping its own opengraph-image in
   * its folder, which is how a shared stream link can carry that stream's
   * thumbnail rather than the house image.
   */
  /*
   * No `icons` block on purpose.
   *
   * It pointed at four files in public/ that came from the Next starter
   * template, including an icon.svg still carrying its Figma export id. That
   * is the mark people were seeing in the tab: the template's, not ours.
   *
   * app/icon.png, app/apple-icon.png and app/favicon.ico are Next file
   * conventions. Next hashes them, emits the right <link> tags, and answers
   * the browser's implicit /favicon.ico request, which used to 404. Declaring
   * them here as well would produce duplicate tags pointing at unhashed paths.
   */
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * Who publishes this, and what "this" is, on every page.
   *
   * Both blocks carry an `@id`, and every other page references them rather
   * than repeating the publisher: a crawler reading a VOD page can follow
   * `publisher` to the same organisation it already knows from the home page,
   * which is how the pages get read as one site rather than a hundred
   * unrelated documents.
   *
   * Read from the branding row for the same reason the title is: an operator
   * who renames the site should not have to wait for a deploy to see the name
   * change in a search result.
   */
  const branding = await readBranding().catch(() => BRANDING_DEFAULT);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${archivo.variable} ${martianMono.variable} font-sans antialiased`}
      >
        <JsonLd
          data={[
            organization({ name: branding.siteName, logo: branding.logoUrl }),
            website({ name: branding.siteName }),
          ]}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
