import { NextResponse, type NextRequest } from "next/server";
import { localStorage } from "@/lib/storage/local";
import path from "node:path";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

function contentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const rel = segments.join("/");

  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const expiryStr = url.searchParams.get("e");

  if (token && expiryStr) {
    const expiry = Number.parseInt(expiryStr, 10);
    if (!Number.isFinite(expiry) || !localStorage.verifySigned(rel, token, expiry)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (!(await localStorage.exists(rel))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buf = await localStorage.read(rel);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType(rel),
      "Cache-Control": "private, max-age=60",
    },
  });
}
