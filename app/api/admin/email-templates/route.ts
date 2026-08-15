import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

/**
 * GET /api/admin/email-templates - admin+. List all templates.
 */
export async function GET() {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  const rows = await db
    .select()
    .from(schema.emailTemplates)
    .orderBy(desc(schema.emailTemplates.updatedAt));

  return NextResponse.json({ templates: rows });
}
