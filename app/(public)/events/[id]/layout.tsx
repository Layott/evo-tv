import { getEventById, getEventBySlug } from "@/lib/api/events";
import { JsonLd, breadcrumbs, sportsEvent } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * An event's title, description and structured data.
 *
 * `SportsEvent` is what lets a tournament show up with its dates attached, and
 * it is the markup an assistant reads when somebody asks what is on this
 * weekend. Every field comes off the row; a prize pool or an end date that is
 * not set is left out rather than guessed.
 */

type Props = { params: Promise<{ id: string }> };

/** The route takes either shape, so both are tried before giving up. */
async function load(idOrSlug: string) {
  const byId = await getEventById(idOrSlug).catch(() => null);
  if (byId) return byId;
  return getEventBySlug(idOrSlug).catch(() => null);
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const event = await load(id);
  if (!event) {
    return pageMetadata({
      title: "Event",
      description: "An esports event on EVO TV.",
      path: `/events/${id}`,
      noIndex: true,
    });
  }

  const description =
    event.description?.trim() ||
    `${event.title} on EVO TV. Fixtures, results and where to watch.`;

  return pageMetadata({
    title: event.title,
    description,
    path: `/events/${event.slug ?? event.id}`,
    image: event.bannerUrl ?? event.thumbnailUrl,
  });
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await load(id);
  if (!event) return <>{children}</>;

  const path = `/events/${event.slug ?? event.id}`;

  return (
    <>
      <JsonLd
        data={[
          sportsEvent({
            name: event.title,
            description: event.description,
            path,
            image: event.bannerUrl ?? event.thumbnailUrl,
            startDate: event.startsAt,
            endDate: event.endsAt,
            // EVO TV covers events rather than hosting them, so the venue is
            // somebody else's and the only location we can honestly claim is
            // the one we broadcast to.
            online: true,
          }),
          breadcrumbs([
            { name: "EVO TV", path: "/" },
            { name: "Events", path: "/events" },
            { name: event.title, path },
          ]),
        ]}
      />
      {children}
    </>
  );
}
