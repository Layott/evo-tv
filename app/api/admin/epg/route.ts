import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import {
  activeSlotSpans,
  showFacts,
  slotBodySchema,
  startTakenResponse,
  uniqueViolationResponse,
} from "@/lib/api/epg-admin";
import { refreshShowStatus } from "@/lib/api/show-state";
import { overlapWarnings, type SlotSpan } from "@/lib/epg/admin";

/**
 * The write side of the repeating weekly grid.
 *
 * Until this existed the only way to move a programme was to re-run
 * `scripts/import-epg.ts` against an edited CSV, which meant a shell on the
 * droplet for a one-word title fix. The grid drives the landing page and
 * `/api/schedule`, and `app/page.tsx` is `force-dynamic`, so a write here shows
 * on the site and in the app on the next request. Nothing to purge.
 *
 * Admin only, on every verb. Programming the channel is not a moderator
 * action: it is what every visitor sees on the front page.
 */

/** GET /api/admin/epg - every slot in the grid, in running order. */
export async function GET() {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  const slots = await db
    .select()
    .from(schema.epgSlots)
    .orderBy(asc(schema.epgSlots.dayOfWeek), asc(schema.epgSlots.startMinute));

  return NextResponse.json({ slots });
}

/**
 * POST /api/admin/epg - add one slot to the grid.
 *
 * Returns 201 with the created row and any overlap warnings. An overlap warns
 * rather than blocks: a two-hour programme entered as one slot legitimately
 * covers the hour a stale hourly row still claims, and the operator fixing
 * that needs to see both rows rather than a rejection.
 *
 * `genreId` / `subgenreId` are left null. They are the source spreadsheet's
 * numeric codes with no lookup table in this repo, so a CMS field for them
 * would be typing digits with no meaning attached.
 */
export async function POST(req: NextRequest) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = slotBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  const show = await showFacts(input.showId);
  if (!show) {
    return NextResponse.json(
      { error: "That show does not exist. Create it under Shows first." },
      { status: 422 },
    );
  }

  const existing = await activeSlotSpans();
  const clash = existing.find(
    (s) => s.dayOfWeek === input.dayOfWeek && s.startMinute === input.startMinute,
  );
  if (clash) {
    return startTakenResponse(input.dayOfWeek, input.startMinute, clash.title);
  }

  /**
   * A random id rather than the importer's `epg_<day>_<start>`. That scheme
   * collides on the primary key the moment a row is deactivated instead of
   * deleted, and the unique index deliberately ignores inactive rows.
   */
  const id = generateId("epg");
  const candidate: SlotSpan = { id, ...input, title: show.title };

  try {
    await db.insert(schema.epgSlots).values({
      id,
      dayOfWeek: input.dayOfWeek,
      startMinute: input.startMinute,
      durationMin: input.durationMin,
      showId: input.showId,
      title: show.title,
      pillar: show.pillar,
      subtitle: input.subtitle,
      parentalRating: input.parentalRating,
      isActive: true,
    });
  } catch (err) {
    const conflict = uniqueViolationResponse(err, input.dayOfWeek, input.startMinute);
    if (conflict) return conflict;
    throw err;
  }

  // A show with a live slot is on air, whatever its episodes say.
  await refreshShowStatus(input.showId);

  const slot = (
    await db.select().from(schema.epgSlots).where(eq(schema.epgSlots.id, id)).limit(1)
  )[0];

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "epg.create",
    targetType: "epg_slot",
    targetId: id,
    before: null,
    // The row as stored, not the request: the title and the pillar come from
    // the show rather than from whoever filled the form.
    after: slot as unknown as Record<string, unknown>,
  });

  return NextResponse.json(
    { slot, warnings: overlapWarnings(candidate, existing) },
    { status: 201 },
  );
}
