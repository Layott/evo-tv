import type { Metadata } from "next";

import { getVodBySlugOrId } from "@/lib/api/vods";
import VodView from "./view";

/**
 * Server shell over the VOD screen, so the URL can be canonicalised.
 *
 * The screen itself is a client component and always was; it stays one. What
 * it could not do is redirect or emit metadata, because neither exists on the
 * client. A `router.replace` would tidy the address bar and mean nothing to a
 * crawler, which is the opposite of the point.
 *
 * So: this resolves the parameter and emits a canonical pointing at the slug,
 * then hands the rest to the same component as before. It does not redirect;
 * see the note in the component below for why not.
 *
 * The segment is still called `[id]` because renaming it is a no-op for
 * routing and a large diff for every link in the app. What it holds is either
 * form.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vod = await getVodBySlugOrId(id);
  if (!vod) return {};

  const canonical = `/vod/${vod.slug ?? vod.id}`;
  return {
    title: vod.title,
    description: vod.description || undefined,
    alternates: { canonical },
    openGraph: {
      title: vod.title,
      description: vod.description || undefined,
      url: canonical,
      type: "video.other",
      images: vod.thumbnailUrl ? [{ url: vod.thumbnailUrl }] : undefined,
    },
  };
}

export default async function VodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // No redirect here, deliberately. `permanentRedirect()` does not work in this
  // app: the page runs, the call is reached, and the response still comes back
  // 200 with the string NEXT_REDIRECT rendered into the HTML instead of a
  // Location header. Proven by probe on Next 16.2.4, not assumed.
  //
  // The canonical link in `generateMetadata` above is what consolidates the id
  // form onto the slug in the meantime, which is the mechanism search engines
  // are documented to honour for exactly this case. It is weaker than a 301
  // for a human following an old link, and it is the honest thing to ship
  // until the redirect itself is fixed.
  //
  // Worth knowing beyond this page: `lib/auth/guards.ts` calls `redirect()` in
  // `requireUser` and `requireRole`. If those are affected the same way, a
  // guard that looks like it bounces someone does not.
  return <VodView />;
}
