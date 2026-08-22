import { getClipById } from "@/lib/api/vods";
import { JsonLd, breadcrumbs, videoObject } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * A clip's title, description and structured data.
 *
 * Clips are the pages most likely to be shared, so the video markup earns more
 * here than anywhere else: `durationSec` and `createdAt` are both real columns,
 * which means these blocks carry the two fields Google wants for a video
 * result rather than the partial ones a stream can offer.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const clip = await getClipById(id).catch(() => null);
  if (!clip) {
    return pageMetadata({
      title: "Clip",
      description: "A highlight from EVO TV.",
      path: `/clips/${id}`,
      noIndex: true,
    });
  }

  const by = clip.creatorHandle ? ` Clipped by @${clip.creatorHandle}.` : "";
  return pageMetadata({
    title: clip.title,
    description: `${clip.title}, a highlight from EVO TV.${by}`,
    path: `/clips/${clip.id}`,
    image: clip.thumbnailUrl,
    ogType: "video.other",
  });
}

export default async function ClipLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clip = await getClipById(id).catch(() => null);
  if (!clip) return <>{children}</>;

  return (
    <>
      <JsonLd
        data={[
          videoObject({
            name: clip.title,
            description: clip.title,
            path: `/clips/${clip.id}`,
            thumbnail: clip.thumbnailUrl,
            uploadDate: clip.createdAt,
            duration: clip.durationSec,
          }),
          breadcrumbs([
            { name: "EVO TV", path: "/" },
            { name: "Clips", path: "/clips" },
            { name: clip.title, path: `/clips/${clip.id}` },
          ]),
        ]}
      />
      {children}
    </>
  );
}
