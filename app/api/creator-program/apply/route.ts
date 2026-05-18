import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  CreatorAppError,
  submitApplication,
} from "@/lib/api/creator-program";

const schema = z.object({
  bio: z.string().min(20).max(2000),
  country: z.string().min(2).max(80),
  primaryGameId: z.string().min(1).max(128),
  socialPlatform: z.enum(["youtube", "twitch", "tiktok", "kick", "other"]),
  socialHandle: z.string().min(1).max(80),
  followerCount: z.number().int().min(0).max(1_000_000_000),
  agreementAccepted: z.boolean(),
});

/** POST /api/creator-program/apply — submit application. One per user. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const app = await submitApplication({
      userId: user.id,
      ...parsed.data,
    });
    return NextResponse.json(app, { status: 201 });
  } catch (err) {
    if (err instanceof CreatorAppError) {
      const status = err.code === "duplicate" ? 409 : 422;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
