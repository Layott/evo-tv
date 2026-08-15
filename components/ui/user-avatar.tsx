"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { avatarTint, initialsFrom, resolveAvatarUrl } from "@/lib/avatar";

interface Props {
  /** `profiles.avatar_url`. Empty and null are both treated as absent. */
  src?: string | null;
  /** Better-Auth's `user.image`, used when the profile column is empty. */
  fallbackSrc?: string | null;
  /** Display name, for initials and for the alt text. */
  name?: string | null;
  /** @handle, used for initials when there is no name. */
  handle?: string | null;
  /** Stable value the tint is derived from. The user id is ideal. */
  seed?: string | null;
  /** Size and shape. Pass the same classes the old `<img>` carried. */
  className?: string;
  /** Type size for the initials. Set this when the avatar is not ~32px. */
  textClassName?: string;
  /**
   * Decorative avatars next to a name that is already on screen should not be
   * announced twice. Those call sites passed `alt=""`; this is that.
   */
  decorative?: boolean;
}

/**
 * One avatar, used everywhere.
 *
 * Before this, fourteen call sites each did `<img src={x.avatarUrl}>` and each
 * of them painted a black disc when the value was empty or the file had gone.
 * Three things are centralised here:
 *
 * - **Empty is absent.** `""` never reaches `src`, so the browser never
 *   requests the page's own HTML and never renders a broken image.
 * - **A dead URL degrades.** `onError` falls back to initials, which covers the
 *   case the upload is in the database but missing from Spaces, or a signed URL
 *   has expired. That was one of the reported symptoms and it cannot be fixed
 *   by picking a better column.
 * - **There is always something to see.** Initials on a tint from the wordmark
 *   ramp, so a user with no picture is still recognisable in a list.
 */
export function UserAvatar({
  src,
  fallbackSrc,
  name,
  handle,
  seed,
  className,
  textClassName,
  decorative = false,
}: Props) {
  const resolved = resolveAvatarUrl(src, fallbackSrc);
  const [failed, setFailed] = React.useState(false);

  // A new URL deserves a fresh attempt: without this, one broken picture leaves
  // the component stuck on initials even after the user uploads a good one.
  React.useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const label = name?.trim() || handle?.trim() || "";
  const showImage = Boolean(resolved) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- images.unoptimized
      // is on, so next/image adds a wrapper and no optimisation here.
      <img
        src={resolved as string}
        alt={decorative ? "" : label}
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  const tint = avatarTint(seed ?? label ?? handle);
  return (
    <span
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label || undefined}
      style={{ backgroundColor: tint.bg, color: tint.fg }}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold leading-none",
        textClassName ?? "text-[11px]",
        className,
      )}
    >
      {initialsFrom(name, handle)}
    </span>
  );
}
