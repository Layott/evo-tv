import { getTeamBySlug } from "@/lib/api/teams";
import { JsonLd, breadcrumbs, sportsTeam } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/** A team's title, description and structured data. */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug).catch(() => null);
  if (!team) {
    return pageMetadata({
      title: "Team",
      description: "An esports team on EVO TV.",
      path: `/team/${slug}`,
      noIndex: true,
    });
  }

  // Built from the fields the row actually has. A team with no country reads
  // "Roster, results and upcoming matches", which is still true.
  const where = team.country ? ` from ${team.country}` : "";
  return pageMetadata({
    title: team.name,
    description: `${team.name}${where}. Roster, results and upcoming matches on EVO TV.`,
    path: `/team/${team.slug}`,
    image: team.logoUrl,
  });
}

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug).catch(() => null);
  if (!team) return <>{children}</>;

  return (
    <>
      <JsonLd
        data={[
          sportsTeam({
            name: team.name,
            path: `/team/${team.slug}`,
            logo: team.logoUrl,
            country: team.country,
          }),
          breadcrumbs([
            { name: "EVO TV", path: "/" },
            { name: "Teams", path: "/team" },
            { name: team.name, path: `/team/${team.slug}` },
          ]),
        ]}
      />
      {children}
    </>
  );
}
