import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

const DEFAULTS = {
  favoriteGames: [] as string[],
  favoriteTeams: [] as string[],
  favoritePlayers: [] as string[],
  notifOptIn: {
    goLive: true,
    eventReminder: true,
    newVod: false,
    weeklyDigest: true,
  },
  playback: {
    defaultQuality: "auto" as const,
    captions: false,
    autoplay: true,
  },
  language: "en",
  theme: "dark" as "system" | "light" | "dark",
  maturityPreference: "mature" as "kids" | "pg" | "teen" | "mature",
};

const patchSchema = z.object({
  favoriteGames: z.array(z.string()).optional(),
  favoriteTeams: z.array(z.string()).optional(),
  favoritePlayers: z.array(z.string()).optional(),
  notifOptIn: z
    .object({
      goLive: z.boolean(),
      eventReminder: z.boolean(),
      newVod: z.boolean(),
      weeklyDigest: z.boolean(),
    })
    .optional(),
  playback: z
    .object({
      defaultQuality: z.enum(["auto", "1080p", "720p", "480p", "360p"]),
      captions: z.boolean(),
      autoplay: z.boolean(),
    })
    .optional(),
  language: z.string().min(2).max(10).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  maturityPreference: z.enum(["kids", "pg", "teen", "mature"]).optional(),
});

async function loadOrCreate(userId: string) {
  const row = (
    await db
      .select()
      .from(schema.userPrefs)
      .where(eq(schema.userPrefs.userId, userId))
      .limit(1)
  )[0];
  if (row) return row;

  await db.insert(schema.userPrefs).values({
    userId,
    ...DEFAULTS,
  });
  return {
    userId,
    ...DEFAULTS,
  };
}

/**
 * GET /api/users/me/prefs — caller's preferences. Creates a default row if
 * none exists.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const prefs = await loadOrCreate(user.id);
  return NextResponse.json(prefs);
}

/**
 * PATCH /api/users/me/prefs — partial update. Any field omitted in the
 * request body is left unchanged.
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Ensure row exists.
  await loadOrCreate(user.id);

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v;
  }

  if (Object.keys(update).length > 0) {
    await db
      .update(schema.userPrefs)
      .set(update)
      .where(eq(schema.userPrefs.userId, user.id));
  }

  const fresh = (
    await db
      .select()
      .from(schema.userPrefs)
      .where(eq(schema.userPrefs.userId, user.id))
      .limit(1)
  )[0];
  return NextResponse.json(fresh);
}
