import { getStreamById } from "@/lib/api/streams";
import { JsonLd, breadcrumbs, videoObject } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * A stream's title, description and structured data.
 *
 * The page is a client component, so it cannot carry any of this itself. The
 * layout reads the same record the page will and describes it to a crawler
 * before the player has loaded.
 *
 * This is the page most worth getting right. A live broadcast marked up as a
 * `VideoObject` with a `BroadcastEvent` is what puts a thumbnail and a LIVE
 * badge on the result while it is on air, and a stream that is over still
 * carries a duration and a date. Without it the whole channel is a set of
 * pages a crawler can see moving and cannot name.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const stream = await getStreamById(id).catch(() => null);

  // No `notFound()` here. The page decides what a missing stream looks like,
  // and a layout that throws would take the whole segment down with it.
  if (!stream) {
    return pageMetadata({
      title: "Stream",
      description: "Live on EVO TV.",
      path: `/stream/${id}`,
      noIndex: true,
    });
  }

  const description =
    stream.description?.trim() ||
    `${stream.title}, live on EVO TV from ${stream.streamerName}.`;

  return pageMetadata({
    title: stream.title,
    description,
    path: `/stream/${stream.id}`,
    image: stream.thumbnailUrl,
    ogType: "video.other",
  });
}

export default async function StreamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stream = await getStreamById(id).catch(() => null);
  if (!stream) return <>{children}</>;

  return (
    <>
      <JsonLd
        data={[
          videoObject({
            name: stream.title,
            description: stream.description,
            path: `/stream/${stream.id}`,
            thumbnail: stream.thumbnailUrl,
            // What a viewer would call the publication date. A stream that has
            // never gone live has neither, and the field is dropped rather
            // than filled with today.
            uploadDate: stream.startedAt ?? stream.scheduledStartAt,
            embedUrl: `/embed/player/${stream.id}`,
            live: stream.isLive
              ? { startDate: stream.startedAt, endDate: null }
              : null,
          }),
          breadcrumbs([
            { name: "EVO TV", path: "/" },
            { name: "Channel", path: "/channel" },
            { name: stream.title, path: `/stream/${stream.id}` },
          ]),
        ]}
      />
      {children}
    </>
  );
}
