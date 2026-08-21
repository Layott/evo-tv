import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import {
  activeSlotSpans,
  showFacts,
  slotPatchSchema,
  startTakenResponse,
  uniqueViolationResponse,
} from "@/lib/api/epg-admin";
import { refreshShowStatus } from "@/lib/api/show-state";
import { overlapWarnings, type SlotSpan } from "@/lib/epg/admin";

/**
 * One slot of the weekly grid.
 *
 * Both verbs are admin only, same as the collection: this is the channel's
 * running order, and an edit here is live on the landing page immediately.
 */

/**
 * PATCH /api/admin/epg/[id] - move, retime, retitle or re-pillar a slot.
 *
 * Every field is optional so the row's pillar can be changed straight from the
 * schedule table without opening the editor. That is deliberate: a programme
 * filed under the wrong pillar shipped once already, and the fix must not be
 * buried behind a form.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = slotPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = (
    await db.select().from(schema.epgSlots).where(eq(schema.epgSlots.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("Slot not found", { status: 404 });

  // Re-pointing a slot at another show renames it, because the title on the row
  // is a copy of the show's. Leaving the old text behind is how a grid ends up
  // announcing a programme that is not the one linked.
  let title = existing.title;
  let pillar = existing.pillar;
  if (parsed.data.showId && parsed.data.showId !== existing.showId) {
    const show = await showFacts(parsed.data.showId);
    if (!show) {
      return NextResponse.json(
        { error: "That show does not exist. Create it under Shows first." },
        { status: 422 },
      );
    }
    title = show.title;
    pillar = show.pillar;
  }

  const next = {
    dayOfWeek: parsed.data.dayOfWeek ?? existing.dayOfWeek,
    startMinute: parsed.data.startMinute ?? existing.startMinute,
    durationMin: parsed.data.durationMin ?? existing.durationMin,
    showId: parsed.data.showId ?? existing.showId,
    title,
    pillar,
    subtitle:
      parsed.data.subtitle === undefined ? existing.subtitle : parsed.data.subtitle,
    parentalRating:
      parsed.data.parentalRating === undefined
        ? existing.parentalRating
        : parsed.data.parentalRating,
  };

  const others = (await activeSlotSpans()).filter((s) => s.id !== id);
  const clash = others.find(
    (s) => s.dayOfWeek === next.dayOfWeek && s.startMinute === next.startMinute,
  );
  if (clash) {
    return startTakenResponse(next.dayOfWeek, next.startMinute, clash.title);
  }

  try {
    await db
      .update(schema.epgSlots)
      .set({ ...next, updatedAt: new Date().toISOString() })
      .where(eq(schema.epgSlots.id, id));
  } catch (err) {
    const conflict = uniqueViolationResponse(err, next.dayOfWeek, next.startMinute);
    if (conflict) return conflict;
    throw err;
  }

  // Both shows can change status: one gained a slot, the other may have lost
  // its last one.
  for (const affected of new Set([existing.showId, next.showId].filter(Boolean))) {
    await refreshShowStatus(affected as string);
  }

  await writeAudit({
    actorId: guard.user.id,
    action: "epg.update",
    targetType: "epg_slot",
    targetId: id,
    meta: { before: { ...existing }, after: next },
  });

  const slot = (
    await db.select().from(schema.epgSlots).where(eq(schema.epgSlots.id, id)).limit(1)
  )[0];
  const candidate: SlotSpan = { id, ...next };

  return NextResponse.json({ slot, warnings: overlapWarnings(candidate, others) });
}

/**
 * DELETE /api/admin/epg/[id] - remove a slot from the rotation.
 *
 * A hard delete, not a soft one. An inactive row is invisible in the grid but
 * still holds its primary key and shows up in nothing an operator can see,
 * which is a worse state than gone. The audit row carries the whole slot, so a
 * deletion made in error is retyped from the log rather than lost.
 *
 * Note the hole this leaves: the grid is the always-there base layer, so an
 * hour with no slot renders as nothing on air. The schedule page shows those
 * gaps rather than letting them go unnoticed.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const slot = (
    await db.select().from(schema.epgSlots).where(eq(schema.epgSlots.id, id)).limit(1)
  )[0];
  if (!slot) return new NextResponse("Slot not found", { status: 404 });

  await db.delete(schema.epgSlots).where(eq(schema.epgSlots.id, id));

  // Losing its last slot can move a show off "airing".
  if (slot.showId) await refreshShowStatus(slot.showId);

  await writeAudit({
    before: slot as unknown as Record<string, unknown>,
    after: null,
    actorId: guard.user.id,
    action: "epg.delete",
    targetType: "epg_slot",
    targetId: id,
    meta: { ...slot },
  });

  return NextResponse.json({ ok: true, slotId: id });
}
