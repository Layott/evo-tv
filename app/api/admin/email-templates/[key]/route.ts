import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

const upsertSchema = z.object({
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  textBody: z.string().default(""),
});

/**
 * GET /api/admin/email-templates/[key] — admin+. Read one.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { key } = await params;

  const row = (
    await db
      .select()
      .from(schema.emailTemplates)
      .where(eq(schema.emailTemplates.key, key))
      .limit(1)
  )[0];

  if (!row) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

/**
 * PATCH /api/admin/email-templates/[key] — admin+. Create-or-update with
 * version bump + audit row.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { key } = await params;

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { subject, htmlBody, textBody } = parsed.data;
  const nowIso = new Date().toISOString();

  const existing = (
    await db
      .select({ version: schema.emailTemplates.version })
      .from(schema.emailTemplates)
      .where(eq(schema.emailTemplates.key, key))
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(schema.emailTemplates)
      .set({
        subject,
        htmlBody,
        textBody,
        version: existing.version + 1,
        updatedBy: guard.user.id,
        updatedAt: nowIso,
      })
      .where(eq(schema.emailTemplates.key, key));
  } else {
    await db.insert(schema.emailTemplates).values({
      key,
      subject,
      htmlBody,
      textBody,
      version: 1,
      updatedBy: guard.user.id,
      updatedAt: nowIso,
    });
  }

  await writeAudit({
    actorId: guard.user.id,
    action: "email_template.update",
    targetType: "email_template",
    targetId: key,
    meta: {
      role: guard.role,
      previousVersion: existing?.version ?? 0,
      newVersion: (existing?.version ?? 0) + 1,
    },
  });

  return NextResponse.json({
    ok: true,
    key,
    version: (existing?.version ?? 0) + 1,
  });
}
