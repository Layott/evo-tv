import { NextResponse, type NextRequest } from "next/server";
import { requireMinRole } from "@/lib/auth/guards";
import {
  listApplications,
  type ApplicationStatus,
} from "@/lib/api/creator-program";

/**
 * GET /api/admin/creator-program?status=
 * Lists creator applications. Optional status filter. moderator+.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const sp = new URL(req.url).searchParams;
  const raw = sp.get("status");
  const status: ApplicationStatus | undefined =
    raw && ["submitted", "in_review", "approved", "rejected"].includes(raw)
      ? (raw as ApplicationStatus)
      : undefined;

  return NextResponse.json(await listApplications(status));
}
