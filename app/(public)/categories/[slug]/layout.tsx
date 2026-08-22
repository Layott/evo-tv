import { getGameBySlug } from "@/lib/api/games";
import { JsonLd, breadcrumbs } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * A game category's title, description and breadcrumbs.
 *
 * No `ItemList` here on purpose: the page fetches its streams and teams in the
 * browser, so a list built on the server would either be empty or describe
 * different content from the one the reader sees. Breadcrumbs describe the
 * page's place in the site, which is true regardless of what loads into it.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const game = await getGameBySlug(slug).catch(() => null);
  if (!game) {
    return pageMetadata({
      title: "Category",
      description: "Browse EVO TV by game.",
      path: `/categories/${slug}`,
      noIndex: true,
    });
  }

  return pageMetadata({
    title: game.name,
    description: `${game.name} on EVO TV. Live streams, events, teams and highlights.`,
    path: `/categories/${game.slug}`,
    image: game.coverUrl ?? game.iconUrl,
  });
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug).catch(() => null);
  if (!game) return <>{children}</>;

  return (
    <>
      <JsonLd
        data={breadcrumbs([
          { name: "EVO TV", path: "/" },
          { name: "Categories", path: "/categories" },
          { name: game.name, path: `/categories/${game.slug}` },
        ])}
      />
      {children}
    </>
  );
}
