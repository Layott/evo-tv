import { NextResponse, type NextRequest } from "next/server";
import {
  listScheduleForDay,
  listScheduleForWeek,
  type EpgPillar,
} from "@/lib/api/schedule";

const PILLARS: ReadonlyArray<EpgPillar | "all"> = [
  "all",
  "esports",
  "anime",
  "lifestyle",
];

function parsePillar(value: string | null): EpgPillar | "all" | undefined {
  if (!value) return undefined;
  const v = value as EpgPillar | "all";
  return PILLARS.includes(v) ? v : undefined;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pillar = parsePillar(searchParams.get("pillar"));
  const week = searchParams.get("week");

  try {
    if (week === "1") {
      const from = searchParams.get("from") ?? todayIso();
      const data = await listScheduleForWeek(from, pillar);
      return NextResponse.json({ from, byDay: data });
    }
    const date = searchParams.get("date") ?? todayIso();
    const data = await listScheduleForDay({ date, pillar });
    return NextResponse.json({ date, rows: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
