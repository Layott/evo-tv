import type { Metadata } from "next";
import { JsonLd, breadcrumbs, videoObject } from "@/lib/seo/json-ld";
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
  /*
   * A description is never left empty.
   *
   * Plenty of rows have no synopsis, and a page with no meta description hands
   * the search engine the job of inventing one out of whatever text it finds,
   * which on a player page is the navigation. One written sentence about the
   * video beats a scrape of the menu.
   */
  const description =
    vod.description?.trim() || `${vod.title}, on demand at EVO TV.`;

  return {
    title: vod.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: vod.title,
      description,
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
  const vod = await getVodBySlugOrId(id);

  if (looksLikeId(id) && vod?.slug) permanentRedirect(`/vod/${vod.slug}`);

  return (
    <>
      {/*
        The video, described for a machine.

        This record carries both fields Google treats as required for a video
        result, `thumbnailUrl` and `uploadDate`, plus a real duration, which is
        what earns a thumbnail and a runtime beside the link rather than a
        plain one. The player itself is a client component and could never
        emit this.
      */}
      {vod ? (
        <JsonLd
          data={[
            videoObject({
              name: vod.title,
              description: vod.description,
              path: `/vod/${vod.slug ?? vod.id}`,
              thumbnail: vod.thumbnailUrl,
              uploadDate: vod.publishedAt,
              duration: vod.durationSec,
            }),
            breadcrumbs([
              { name: "EVO TV", path: "/" },
              { name: "Library", path: "/shows" },
              { name: vod.title, path: `/vod/${vod.slug ?? vod.id}` },
            ]),
          ]}
        />
      ) : null}
      <VodView />
    </>
  );
}
