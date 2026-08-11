import "server-only";

/**
 * Cloudflare Stream, the live origin.
 *
 * Before this, going live meant an operator creating a stream here, creating a
 * live input by hand in the Cloudflare dashboard, copying the manifest URL back
 * into a PATCH, and remembering to toggle `isLive` off at the end. Four manual
 * steps, two of them easy to forget, and the stream key this app generated was
 * never used by anything because there is no RTMP server in production.
 *
 * With an API token configured, creating a stream provisions a live input and
 * the operator gets an RTMPS URL and key to paste straight into OBS. Playback
 * is keyed off the live input id, so the manifest URL is stable across
 * broadcasts and never has to be updated again.
 *
 * Everything degrades: with no token configured `isConfigured()` is false, the
 * create route skips provisioning, and the manual `hlsUrl` paste still works
 * exactly as it does today.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

export interface LiveInput {
  uid: string;
  /** RTMPS endpoint for OBS, ends with a slash. */
  rtmpsUrl: string;
  /** The key OBS needs. Cloudflare will return this again, unlike our own. */
  rtmpsStreamKey: string;
  /** SRT, for encoders on lossy connections. */
  srtUrl: string | null;
  srtStreamId: string | null;
  srtPassphrase: string | null;
  /** Stable across broadcasts: keyed on the input, not the recording. */
  hlsUrl: string;
  dashUrl: string;
}

interface CfEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

interface CfLiveInput {
  uid: string;
  rtmps?: { url?: string; streamKey?: string };
  srt?: { url?: string; streamId?: string; passphrase?: string };
  webRTC?: { url?: string };
  status?: { current?: { state?: string } } | null;
}

function accountId(): string | undefined {
  return process.env.CLOUDFLARE_ACCOUNT_ID;
}

function apiToken(): string | undefined {
  return process.env.CLOUDFLARE_STREAM_API_TOKEN;
}

/**
 * The `customer-<CODE>` subdomain that serves playback.
 *
 * Cloudflare shows it on the Stream dashboard and returns it inside the
 * WebRTC playback URL on every live input, so it is derived rather than
 * required. Setting it explicitly skips that parsing.
 */
function customerSubdomain(): string | undefined {
  return process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN;
}

/** True when a live input can actually be provisioned. */
export function isConfigured(): boolean {
  return Boolean(accountId() && apiToken());
}

function playbackHost(input: CfLiveInput): string | null {
  const explicit = customerSubdomain();
  if (explicit) {
    // Accept either "customer-abc123" or the full hostname.
    return explicit.includes(".")
      ? explicit
      : `${explicit}.cloudflarestream.com`;
  }
  // Fall back to the host Cloudflare already handed us on this input.
  const webrtc = input.webRTC?.url;
  if (!webrtc) return null;
  try {
    return new URL(webrtc).host;
  } catch {
    return null;
  }
}

function toLiveInput(input: CfLiveInput): LiveInput {
  const host = playbackHost(input);
  return {
    uid: input.uid,
    rtmpsUrl: input.rtmps?.url ?? "rtmps://live.cloudflare.com:443/live/",
    rtmpsStreamKey: input.rtmps?.streamKey ?? "",
    srtUrl: input.srt?.url ?? null,
    srtStreamId: input.srt?.streamId ?? null,
    srtPassphrase: input.srt?.passphrase ?? null,
    // Keyed on the input id, so this URL survives every stop and restart.
    hlsUrl: host
      ? `https://${host}/${input.uid}/manifest/video.m3u8`
      : "",
    dashUrl: host ? `https://${host}/${input.uid}/manifest/video.mpd` : "",
  };
}

async function cf<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const id = accountId();
  const token = apiToken();
  if (!id || !token) {
    throw new Error("Cloudflare Stream is not configured");
  }

  // A slow Cloudflare must not hang an admin request forever.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? 10_000,
  );

  try {
    const res = await fetch(`${API_BASE}/accounts/${id}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const body = (await res.json().catch(() => null)) as CfEnvelope<T> | null;
    if (!res.ok || !body?.success) {
      const detail =
        body?.errors?.map((e) => `${e.code} ${e.message}`).join("; ") ??
        `HTTP ${res.status}`;
      throw new Error(`Cloudflare Stream: ${detail}`);
    }
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Provision a live input.
 *
 * Recording is the expensive dimension and the one that surprises people.
 * Cloudflare bills 5 USD per 1,000 minutes **stored per month**, and it is
 * cumulative: a 24/7 channel on automatic recording stores 43,200 minutes in
 * its first month (216 USD), 86,400 by the second (432 USD), and keeps
 * climbing until somebody deletes something.
 *
 * So recording is opt-in per stream, and when it is on a retention window is
 * set. `deleteRecordingAfterDays` makes Cloudflare do the housekeeping, which
 * turns an unbounded bill into a flat one: retention days of continuous
 * broadcast, and no more.
 *
 * Defaults come from env so a deployment sets its policy once:
 *   CLOUDFLARE_STREAM_RECORD=off | automatic   (default off)
 *   CLOUDFLARE_STREAM_RETENTION_DAYS=<n>       (default 7 when recording)
 */
export async function createLiveInput(
  name: string,
  opts: {
    lowLatency?: boolean;
    record?: boolean;
    retentionDays?: number | null;
  } = {},
): Promise<LiveInput> {
  const record =
    opts.record ?? process.env.CLOUDFLARE_STREAM_RECORD === "automatic";

  const retentionDays =
    opts.retentionDays !== undefined
      ? opts.retentionDays
      : Number(process.env.CLOUDFLARE_STREAM_RETENTION_DAYS ?? 7) || null;

  const result = await cf<CfLiveInput>("/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: { name },
      recording: { mode: record ? "automatic" : "off" },
      // Cloudflare ignores this when recording is off. Null means keep
      // forever, which is exactly the runaway case, so it is never the
      // default here.
      ...(record && retentionDays
        ? { deleteRecordingAfterDays: retentionDays }
        : {}),
      preferLowLatency: opts.lowLatency ?? false,
    }),
  });
  return toLiveInput(result);
}

export async function getLiveInput(uid: string): Promise<LiveInput | null> {
  try {
    const result = await cf<CfLiveInput>(`/stream/live_inputs/${uid}`);
    return toLiveInput(result);
  } catch {
    return null;
  }
}

export async function deleteLiveInput(uid: string): Promise<void> {
  await cf<unknown>(`/stream/live_inputs/${uid}`, { method: "DELETE" });
}

/**
 * Is this input receiving a broadcast right now?
 *
 * The webhook is the fast path; this is what reconciles state when a webhook is
 * missed, which happens whenever the app is redeploying as a broadcast starts.
 */
export async function isInputLive(uid: string): Promise<boolean | null> {
  try {
    const videos = await cf<Array<{ status?: { state?: string } }>>(
      `/stream/live_inputs/${uid}/videos`,
    );
    return videos.some((v) => v.status?.state === "live-inprogress");
  } catch {
    // Unknown rather than false: a Cloudflare outage must not take a live
    // broadcast off the schedule.
    return null;
  }
}
