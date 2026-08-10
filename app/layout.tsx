import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
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
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
