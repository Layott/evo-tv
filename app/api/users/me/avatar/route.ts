import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { storage, ownedKeyFromUrl } from "@/lib/storage";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

// Vercel's hard request-body cap is 4.5 MB on Hobby — stay safely under so
// our 413 fires inside the route (with a clean message) before the platform
// terminates the request.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

/**
 * POST /api/users/me/avatar
 *
 * Accepts multipart/form-data with a single `file` field. Validates type +
 * size, uploads to Vercel Blob under `avatars/<userId>-<ts>.<ext>` (public
 * access — these URLs are pulled by RN's <Image> on every device), updates
 * user.image, and best-effort deletes the previous avatar blob.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 415 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 422 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}` },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const key = `avatars/${user.id}-${Date.now()}.${extFromMime(file.type)}`;
  const url = await storage.write(key, Buffer.from(await file.arrayBuffer()));

  const prev = (user as { image?: string | null }).image;

  await db.update(schema.user).set({ image: url }).where(eq(schema.user.id, user.id));

  const prevKey = ownedKeyFromUrl(prev);
  if (prevKey) {
    void storage.delete(prevKey).catch(() => {
      // Best-effort cleanup; safe to leak orphans.
    });
  }

  return NextResponse.json({ ok: true, url });
}

/**
 * DELETE /api/users/me/avatar — revert to the default (empty) avatar.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const prev = (user as { image?: string | null }).image;
  await db.update(schema.user).set({ image: null }).where(eq(schema.user.id, user.id));

  const prevKey = ownedKeyFromUrl(prev);
  if (prevKey) {
    void storage.delete(prevKey).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
