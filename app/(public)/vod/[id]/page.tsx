import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { getVodBySlugOrId } from "@/lib/api/vods";
import { looksLikeId } from "@/lib/slug";
import VodView from "./view";

/**
 * Server shell over the VOD screen, so the URL can be canonicalised.
 *
 * The screen itself is a client component and always was; it stays one. What
 * it could not do is redirect or emit metadata, because neither exists on the
 * client. A `router.replace` would tidy the address bar and mean nothing to a
 * crawler, which is the opposite of the point.
 *
 * So: this resolves the parameter, sends the id form to the slug, and emits a
 * canonical, then hands the rest to the same component as before.
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
  const { id } = await params;

  // Send the id form to the slug. Only when there is somewhere better to go: a
  // row from before slugs existed has no slug, and bouncing it would turn a
  // working link into a 404 to satisfy a rule.
  //
  // Do not be alarmed by `curl` reporting 200 here with no Location header.
  // Next serves a redirect from a streamed render as a client-side navigation,
  // so the browser does land on the slug and a tool that does not run
  // JavaScript does not see a 3xx. Verified in a real browser, because a curl
  // check alone says the opposite and is wrong.
  //
  // That is also why the canonical above matters: it is what tells a crawler,
  // which is exactly the client that cannot follow this, which URL is the real
  // one.
  if (looksLikeId(id)) {
    const vod = await getVodBySlugOrId(id);
    if (vod?.slug) permanentRedirect(`/vod/${vod.slug}`);
  }

  return <VodView />;
}
