import { NextResponse, type NextRequest } from "next/server";
import { storage } from "@/lib/storage";
import { requireAdminFromRequest } from "@/lib/api/admin";

// Vercel's hard request-body cap is 4.5 MB on Hobby. Stay safely under so
// our 413 fires inside the route (with a clean message) before the platform
// terminates the request. Matches the RN client's 3.5 MB pre-check.
const MAX_BYTES = Math.floor(3.5 * 1024 * 1024); // 3.5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function randomSuffix(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * POST /api/admin/uploads
 *
 * Admin-only generic image upload (game covers, icons, ad creatives).
 * Accepts multipart/form-data with a single `file` field. Validates type +
 * size, uploads to Vercel Blob under `admin-uploads/<ts>-<random>.<ext>`
 * (public access: URLs are pulled by RN's <Image> on every device), and
 * returns `{ url }`.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

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
      { error: "File too large (max 3.5 MB)" },
      { status: 413 },
    );
  }

  const key = `admin-uploads/${Date.now()}-${randomSuffix()}.${extFromMime(file.type)}`;
  // storage.write returns the public URL, which is what callers persist.
  const url = await storage.write(key, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url });
}
