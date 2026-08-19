/**
 * The browser side of the data layer.
 *
 * Pages are `"use client"` and drive TanStack Query, so they cannot import
 * `lib/api/*` - those modules pull in `server-only` and a live Postgres client.
 * This layer speaks to the `/api/*` route handlers instead and returns exactly
 * the shapes `lib/mock/*` used to return, so swapping a page over is a one-line
 * import change rather than a rewrite.
 *
 * Nothing here invents data. When a table is empty the endpoint returns an empty
 * list and the page renders its empty state, which is the honest result.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildUrl(path: string, params?: QueryParams): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

/**
 * GET a JSON endpoint.
 *
 * A 404 returns null rather than throwing, because every `getXById` in the old
 * mock layer resolved to `null` for a miss and call sites branch on that.
 *
 * A **401 also returns null**. Every user-scoped endpoint - `/api/users/me`,
 * `/api/follows`, `/api/notifications`, `/api/orders`, `/api/subscriptions/me`,
 * `/api/rewards/me` - returns 401 to a guest, and a guest simply has no profile
 * or notifications. Throwing would put an error boundary on every public page
 * that shows a follow button. Mutations still throw on 401 so the UI can prompt
 * a sign-in, which is what `apiSend` does.
 */
export async function apiGet<T>(
  path: string,
  params?: QueryParams,
): Promise<T | null> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    credentials: "include",
    headers: { accept: "application/json" },
  });

  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) {
    throw new ApiError(res.status, url, await errorMessage(res));
  }
  return (await res.json()) as T;
}

/** GET a list endpoint. A miss or an empty body is an empty array, never null. */
export async function apiList<T>(
  path: string,
  params?: QueryParams,
): Promise<T[]> {
  const data = await apiGet<T[]>(path, params);
  return Array.isArray(data) ? data : [];
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw new ApiError(res.status, path, await errorMessage(res));
  }
  // 204 and empty bodies are normal for mutations.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: unknown;
      message?: unknown;
    };
    const readable = readableError(body.error) ?? readableError(body.message);
    return readable ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

/**
 * A sentence, or nothing.
 *
 * `error` is a string on most routes and a **zod flatten** on the ones that
 * validate a body, which is an object. Templating that into an Error message
 * produced the literal "[object Object]" in a toast, on every button of the
 * moderation queue, which said nothing about the 422 underneath it.
 */
function readableError(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;

  const flat = value as {
    formErrors?: unknown;
    fieldErrors?: Record<string, unknown>;
  };
  const parts: string[] = [];
  if (Array.isArray(flat.formErrors)) {
    parts.push(...flat.formErrors.filter((v): v is string => typeof v === "string"));
  }
  if (flat.fieldErrors && typeof flat.fieldErrors === "object") {
    for (const [field, messages] of Object.entries(flat.fieldErrors)) {
      if (!Array.isArray(messages)) continue;
      const first = messages.find((m): m is string => typeof m === "string");
      if (first) parts.push(`${field}: ${first}`);
    }
  }
  return parts.length > 0 ? parts.join(". ") : null;
}
