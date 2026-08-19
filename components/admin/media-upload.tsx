"use client";

import * as React from "react";
import { Loader2, Upload, X } from "@/components/icons";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { apiGet } from "@/lib/client";

/**
 * The admin's file picker.
 *
 * Until this existed the web CMS had no way to upload anything: the endpoints
 * were built for the native app and no browser component ever called them. A
 * poster or an episode could only be attached by pasting a URL that had been
 * uploaded somewhere else first.
 *
 * Bytes never pass through the API process. The browser asks for a credential,
 * PUTs the file straight at the bucket, and posts back the URL it already
 * knows. A 512 MB episode has no business occupying a Node process for the
 * length of an upload.
 *
 * The URL field stays visible next to the picker on purpose. It is the only
 * thing that works when neither storage backend has credentials, which is the
 * ordinary state of a local checkout, and it is how an asset already hosted
 * elsewhere gets attached without a pointless round trip through our bucket.
 */

interface UploadBackend {
  backend: "spaces" | "blob";
  configured: boolean;
  maxBytes: number;
  allowedContentTypes: string[];
}

/**
 * What an image has to be to be accepted.
 *
 * Artwork that arrives at whatever size the designer exported is why a poster
 * rail ends up with one card taller than its neighbours and a hero that goes
 * soft on a laptop. A ratio and a floor fix the shape; the byte ceiling is
 * about the viewer on a Lagos phone connection, not about disk.
 */
export interface ImageSpec {
  /** Width divided by height, e.g. 2/3 for a poster. */
  aspect: number;
  /** How far off that ratio is still acceptable, as a fraction. */
  tolerance: number;
  minWidth: number;
  minHeight: number;
  label: string;
}

/**
 * Every image slot on the platform, with the size to upload.
 *
 * Standing rule from the owner: an upload field always says what size the
 * image should be. Nobody can guess "poster" and be right, and artwork that
 * arrives at whatever size the designer exported is how a rail ends up with
 * one card taller than its neighbours.
 *
 * `tolerance` is how far off the ratio is still accepted. It is generous for
 * slots where a crop is applied anyway and tight where the image is shown
 * whole.
 */
export const POSTER_SPEC: ImageSpec = {
  aspect: 2 / 3,
  tolerance: 0.04,
  minWidth: 800,
  minHeight: 1200,
  label: "portrait 2:3, 1000 by 1500 recommended",
};

export const HERO_SPEC: ImageSpec = {
  aspect: 16 / 9,
  tolerance: 0.04,
  minWidth: 1600,
  minHeight: 900,
  label: "landscape 16:9, 1920 by 1080 recommended",
};

/** Video thumbnails: episodes, VODs, clips, streams. */
export const THUMBNAIL_SPEC: ImageSpec = {
  aspect: 16 / 9,
  tolerance: 0.06,
  minWidth: 640,
  minHeight: 360,
  label: "landscape 16:9, 1280 by 720 recommended",
};

/** Product shots. Square, because the shop grid is a square grid. */
export const PRODUCT_SPEC: ImageSpec = {
  aspect: 1,
  tolerance: 0.05,
  minWidth: 800,
  minHeight: 800,
  label: "square, 1200 by 1200 recommended",
};

/** Crests, game icons, avatars: anything rendered in a circle or a small square. */
export const LOGO_SPEC: ImageSpec = {
  aspect: 1,
  tolerance: 0.05,
  minWidth: 256,
  minHeight: 256,
  label: "square, 512 by 512 recommended",
};

/** Ad creative and page banners, which are wider than video. */
export const BANNER_SPEC: ImageSpec = {
  aspect: 3,
  tolerance: 0.12,
  minWidth: 1200,
  minHeight: 400,
  label: "wide 3:1, 1500 by 500 recommended",
};

/** Two megabytes, for both artwork slots. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export interface MediaUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** `image` for posters and thumbnails, `video` for an episode's master file. */
  kind: "image" | "video";
  /** Sub-folder inside `admin-uploads/`, so the bucket is browsable later. */
  folder: string;
  hint?: string;
  disabled?: boolean;
  /** Shape and minimum size an image must meet. Omit to accept any image. */
  spec?: ImageSpec;
  /** Overrides the backend's ceiling. Images are held to 2 MB. */
  maxBytes?: number;
  /**
   * Narrow the accepted video types.
   *
   * Ads default to MP4 and WebM only. A `.mov` uploads without complaint,
   * previews here because Chrome usually decodes H.264 inside QuickTime, and
   * then refuses to play for a viewer on Firefox. For a creative that covers a
   * dropped feed, an outage is the worst possible time to discover that.
   */
  videoTypes?: string[];
}

// GIF is here for ad creatives, which are often animated. Posters and
// thumbnails are held to a shape and a size by `spec`, not by format.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** `Otaku & Chillz S1E2.mp4` -> `otaku-chillz-s1e2.mp4`, so a key never needs escaping. */
function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const cleanStem =
    stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  return `${cleanStem}${ext.replace(/[^a-z0-9.]/g, "")}`;
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * PUT with a progress callback.
 *
 * `fetch` cannot report upload progress, and a 400 MB episode uploading behind
 * a spinner that never moves is indistinguishable from one that has hung.
 */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Part of the signature, so it has to be exactly what was presigned.
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    });
    xhr.addEventListener("error", () =>
      reject(new Error("Upload failed. Check the connection and try again.")),
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.send(file);
  });
}

/** Natural pixel size of a picked file, before it goes anywhere. */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

export function MediaUpload({
  label,
  value,
  onChange,
  kind,
  folder,
  hint,
  disabled,
  spec,
  maxBytes: maxBytesProp,
  videoTypes,
}: MediaUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  // A preview that fails is worth saying out loud. Reset when the URL changes,
  // or a new upload inherits the previous one's failure.
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [value]);

  const backendQ = useQuery({
    queryKey: ["admin", "uploads", "backend"],
    queryFn: () => apiGet<UploadBackend>("/api/admin/uploads/client"),
    staleTime: 5 * 60 * 1000,
  });
  const backend = backendQ.data ?? null;
  const uploading = progress !== null;
  const videoAccepted = videoTypes ?? VIDEO_TYPES;
  const accept = (kind === "image" ? IMAGE_TYPES : videoAccepted).join(",");

  async function handleFile(file: File) {
    const allowed = kind === "image" ? IMAGE_TYPES : videoAccepted;
    if (!allowed.includes(file.type)) {
      toast.error(`${file.type || "That file"} is not accepted here. Use ${allowed.join(", ")}.`);
      return;
    }
    const maxBytes =
      maxBytesProp ??
      (kind === "image" ? IMAGE_MAX_BYTES : (backend?.maxBytes ?? 512 * 1024 * 1024));
    if (file.size > maxBytes) {
      toast.error(`That file is ${formatMb(file.size)}. The limit is ${formatMb(maxBytes)}.`);
      return;
    }

    // Checked before the upload starts, not after: a rejected poster should
    // cost nothing, and telling somebody their artwork is the wrong shape once
    // it is already in the bucket is the wrong order.
    if (spec) {
      let size: { width: number; height: number };
      try {
        size = await readImageSize(file);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read that image");
        return;
      }
      if (size.width < spec.minWidth || size.height < spec.minHeight) {
        toast.error(
          `That image is ${size.width} by ${size.height}. ${label} needs ${spec.label}.`,
        );
        return;
      }
      const ratio = size.width / size.height;
      if (Math.abs(ratio - spec.aspect) / spec.aspect > spec.tolerance) {
        toast.error(
          `That image is the wrong shape for ${label.toLowerCase()}: it needs ${spec.label}.`,
        );
        return;
      }
    }

    const pathname = `admin-uploads/${folder}/${safeFileName(file.name)}`;
    setProgress(0);
    try {
      const res = await fetch("/api/admin/uploads/client", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pathname, contentType: file.type }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not start the upload (${res.status})`);
      }
      const signed = (await res.json()) as {
        uploadUrl: string;
        publicUrl: string;
        key: string;
      };
      await putWithProgress(signed.uploadUrl, file, file.type, setProgress);

      /*
       * An upload is not finished until the file can be fetched.
       *
       * The ACL travels in the presigned query string and the bucket ignored
       * it, so every image landed private. The URL was saved to the row all the
       * same, and the first anybody knew of it was a broken thumbnail on a
       * screen nobody thought to connect to an upload that had said "uploaded".
       * This sets the ACL server-side and reads the file back over the public
       * URL before the value is handed to the form.
       */
      const done = await fetch("/api/admin/uploads/finalize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: signed.key }),
      });
      const published = (await done.json().catch(() => ({}))) as {
        url?: string;
        publiclyReadable?: boolean;
        status?: number;
        error?: string;
      };
      if (!done.ok || !published.publiclyReadable) {
        throw new Error(
          published.error ??
            `The file uploaded but is not publicly readable (${published.status ?? done.status}). Nothing was saved.`,
        );
      }

      onChange(published.url ?? signed.publicUrl);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={kind === "image" ? "https://... or /path.jpg" : "https://.../master.m3u8"}
          disabled={disabled || uploading}
          className="min-w-0 flex-1"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading || backendQ.isLoading || backend?.configured === false}
            className="shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading" : "Upload"}
          </Button>
          {value && !uploading ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange("")}
              aria-label={`Clear ${label}`}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {uploading ? (
        <div className="space-y-1">
          <Progress value={progress ?? 0} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {progress}% uploaded. Leaving this page cancels it.
          </p>
        </div>
      ) : null}

      {backend?.configured === false ? (
        <p className="text-xs text-muted-foreground">
          No storage backend is configured in this environment, so the picker is
          off. Paste a URL instead.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {[
            hint,
            spec ? `${spec.label}, up to ${formatMb(IMAGE_MAX_BYTES)}` : null,
            // What the file dialog will actually accept. Finding this out by
            // being rejected is a poor way to learn it.
            kind === "image"
              ? "JPG, PNG, WebP or GIF"
              : videoAccepted
                  .map((t) => ({ "video/mp4": "MP4", "video/quicktime": "MOV", "video/webm": "WebM" })[t] ?? t)
                  .join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/*
        What was actually uploaded, not just its URL.
        
        The preview used to hide itself on an error, so a broken or private URL
        left an empty space that looked identical to no upload at all. It says
        so now. Video gets a real player: an operator checking they uploaded the
        right episode cannot tell from a filename.
      */}
      {value && kind === "image" ? (
        broken ? (
          <div className="rounded-md bg-card p-3">
            <p className="text-xs text-muted-foreground">
              This link did not load. It may be private, or the file may not be
              there any more.
            </p>
            <code className="mt-1 block break-all text-[11px] text-foreground/60">
              {value}
            </code>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- an admin preview of an
          // arbitrary URL, which next/image would need a remotePatterns entry for.
          <img
            src={value}
            alt=""
            className="h-24 w-auto rounded-md object-cover"
            onError={() => setBroken(true)}
          />
        )
      ) : null}

      {value && kind === "video" ? (
        <video
          src={value}
          controls
          preload="metadata"
          className="h-40 w-full rounded-md bg-black object-contain"
        />
      ) : null}
    </div>
  );
}
