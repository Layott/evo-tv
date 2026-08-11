import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * POST /api/users/me/avatar
 *
 * Upload a profile picture. The edit-profile form asked for an "Avatar URL",
 * which is a developer's idea of how to set a picture: it assumes the user has
 * already hosted the image somewhere and can produce a direct link to it.
 * Nobody has. On a phone the picture is in the camera roll and there is no URL
 * to give.
 *
 * Modelled on /api/admin/uploads, with two differences: it writes under a
 * per-user prefix rather than a shared one, and it persists the resulting URL
 * onto the profile itself, so a successful upload cannot leave the image in
 * storage but not on the account.
 */

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

  // Trusting the browser's content-type is not a security boundary, but it is
  // the right check for the honest case, and storage serves these as static
  // assets rather than executing them.
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG or WebP image." },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That image is over 3.5 MB. Try a smaller one." },
      { status: 413 },
    );
  }

  // Namespaced by user id so one account's uploads can be found, and later
  // removed wholesale, without scanning a shared prefix.
  const key = `avatars/${user.id}/${Date.now()}-${randomSuffix()}.${extFromMime(file.type)}`;
  const url = await storage.write(key, Buffer.from(await file.arrayBuffer()));

  // Persist immediately. Returning the URL and leaving the caller to PATCH it
  // separately means a closed tab between the two leaves an orphaned file and
  // an unchanged profile.
  // `image` is Better-Auth's column. The rest of the app reads it as
  // `avatarUrl`; the mapping happens in /api/users/me.
  await db
    .update(schema.user)
    .set({ image: url })
    .where(eq(schema.user.id, user.id));

  return NextResponse.json({ url });
}
