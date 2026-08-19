import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api/admin";
import { FIXED_PAGE_LABELS, pickableDestinations } from "@/lib/api/destinations";

/**
 * What a message can be pointed at, by name.
 *
 * Feeds every picker that used to be a text box asking for a path.
 */
export async function GET() {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;

  const things = await pickableDestinations();
  return NextResponse.json({
    pages: Object.entries(FIXED_PAGE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
    ...things,
  });
}
