import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * GET /api/partner/me - list publishers the caller is a member of, with
 * caller's role on each + the channels each publisher owns.
 *
 * EVO TV admins (`user.role === "admin"`) are implicitly granted "owner" on
 * the EVO TV publisher even without an explicit membership row.
 *
 * Used by the RN client on boot to populate `publisherMemberships` on the
 * auth context. Empty array = caller has no partner access; RN hides the
 * (partner) route group.
 */

interface PublisherMembership {
  publisher: {
    id: string;
    slug: string;
    name: string;
    isEvotvOwned: boolean;
    kycState: string;
    revenueSharePct: number;
  };
  role: "owner" | "admin" | "editor" | "viewer";
  channels: Array<{
    id: string;
    slug: string;
    name: string;
    logoUrl: string;
    category: string;
    isVerified: boolean;
    followerCount: number;
  }>;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const memberRows = await db
    .select({
      publisherId: schema.publisherMembers.publisherId,
      role: schema.publisherMembers.role,
      pubSlug: schema.publishers.slug,
      pubName: schema.publishers.name,
      isEvotvOwned: schema.publishers.isEvotvOwned,
      kycState: schema.publishers.kycState,
      revenueSharePct: schema.publishers.revenueSharePct,
    })
    .from(schema.publisherMembers)
    .innerJoin(
      schema.publishers,
      eq(schema.publishers.id, schema.publisherMembers.publisherId),
    )
    .where(eq(schema.publisherMembers.userId, user.id));

  const appRole = (user as { role?: string }).role ?? "user";
  const memberPubIds = new Set(memberRows.map((m) => m.publisherId));

  if (appRole === "admin" && !memberPubIds.has("pub_evotv")) {
    const evotv = (
      await db
        .select()
        .from(schema.publishers)
        .where(eq(schema.publishers.id, "pub_evotv"))
        .limit(1)
    )[0];
    if (evotv) {
      memberRows.push({
        publisherId: evotv.id,
        role: "owner",
        pubSlug: evotv.slug,
        pubName: evotv.name,
        isEvotvOwned: evotv.isEvotvOwned,
        kycState: evotv.kycState,
        revenueSharePct: evotv.revenueSharePct,
      });
    }
  }

  if (memberRows.length === 0) return NextResponse.json([]);

  const publisherIds = memberRows.map((m) => m.publisherId);
  const channels = await db
    .select({
      id: schema.channels.id,
      publisherId: schema.channels.publisherId,
      slug: schema.channels.slug,
      name: schema.channels.name,
      logoUrl: schema.channels.logoUrl,
      category: schema.channels.category,
      isVerified: schema.channels.isVerified,
      followerCount: schema.channels.followerCount,
    })
    .from(schema.channels)
    .where(inArray(schema.channels.publisherId, publisherIds));

  const result: PublisherMembership[] = memberRows.map((m) => ({
    publisher: {
      id: m.publisherId,
      slug: m.pubSlug,
      name: m.pubName,
      isEvotvOwned: m.isEvotvOwned,
      kycState: m.kycState,
      revenueSharePct: m.revenueSharePct,
    },
    role: m.role as PublisherMembership["role"],
    channels: channels
      .filter((c) => c.publisherId === m.publisherId)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        logoUrl: c.logoUrl,
        category: c.category,
        isVerified: c.isVerified,
        followerCount: c.followerCount,
      })),
  }));

  return NextResponse.json(result);
}
