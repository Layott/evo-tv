import { NextResponse, type NextRequest } from "next/server";
import {
  generateId,
  requireAdminFromRequest,
  writeAudit,
} from "@/lib/api/admin";
import { db, schema } from "@/lib/db";
import { parseEventsCsv, type ParseError } from "@/lib/api/import";

export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") !== "0"; // default true

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file field" },
      { status: 400 }
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseEventsCsv(buffer);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      parsed: rows.length,
      rows,
      errors,
    });
  }

  let created = 0;
  const runtimeErrors: ParseError[] = [];
  // TODO: pg-port - neon-http has no transaction(); errors collected per-row.
  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = generateId("event");
      const { teamIds, ...eventData } = row;
      try {
        await db.insert(schema.events).values({ id, ...eventData });
        for (const teamId of teamIds) {
          await db.insert(schema.eventTeams).values({ eventId: id, teamId });
        }
        writeAudit({
          actorId: guard.user.id,
          action: "create",
          targetType: "event",
          targetId: id,
          meta: row as unknown as Record<string, unknown>,
        });
        created++;
      } catch (err) {
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: unknown }).message ?? "")
            : String(err);
        runtimeErrors.push({ row: i, message });
      }
    }
  } catch (err) {
    const message =
      typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err);
    return NextResponse.json(
      { error: "Import transaction failed", detail: message, created: 0 },
      { status: 500 }
    );
  }

  return NextResponse.json({
    dryRun: false,
    parsed: rows.length,
    created,
    errors: [...errors, ...runtimeErrors],
  });
}
