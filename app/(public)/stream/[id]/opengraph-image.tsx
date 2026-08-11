import { ImageResponse } from "next/og";

import { getStreamById } from "@/lib/api/streams";

/**
 * A shared stream link should show that stream, not the house image.
 *
 * The root `app/opengraph-image.png` covers every route, which is right for the
 * landing page and wrong here: a link to a specific broadcast that unfurls as
 * the generic EVO TV card tells nobody what they are being sent to. This draws
 * the stream's own title and thumbnail instead.
 *
 * Drawn rather than served: the thumbnail an operator uploads is whatever shape
 * they had, and a scraper wants exactly 1200x630. Compositing here means the
 * card is always the right size, always carries the title, and degrades to the
 * brand gradient when a stream has no artwork yet, which is the common case
 * while the catalogue is being filled.
 */
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "EVO TV stream";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = await getStreamById(id).catch(() => null);

  const title = stream?.title ?? "EVO TV";
  const streamer = stream?.streamerName ?? "";
  const thumb = stream?.thumbnailUrl?.startsWith("http")
    ? stream.thumbnailUrl
    : null;
  const isLive = Boolean(stream?.isLive);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          // The landing palette, so a shared card and the page it opens are
          // recognisably the same product.
          background: thumb
            ? "#05191b"
            : "linear-gradient(135deg, #05191b 0%, #0a2426 55%, #1f7f8c 100%)",
          position: "relative",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Scrim. Without it, title text over a bright thumbnail is unreadable
            and there is no way to know in advance which one an operator will
            upload. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(5,25,27,0.96) 0%, rgba(5,25,27,0.75) 45%, rgba(5,25,27,0.25) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "64px",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                color: "#eaf6f5",
                letterSpacing: "-0.01em",
              }}
            >
              EVO
              <span style={{ color: "#46e3ce", marginLeft: 8 }}>TV</span>
            </div>
            {isLive ? (
              <div
                style={{
                  display: "flex",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 6,
                  letterSpacing: "0.06em",
                }}
              >
                LIVE
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: title.length > 44 ? 58 : 72,
              fontWeight: 700,
              color: "#eaf6f5",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {title.slice(0, 90)}
          </div>

          {streamer ? (
            <div style={{ display: "flex", fontSize: 28, color: "#9fbdbd" }}>
              {streamer}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
