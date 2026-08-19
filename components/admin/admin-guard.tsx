"use client";

import Link from "next/link";
import { ShieldAlert } from "@/components/icons";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { hasMinRole, roleLabel, type PlatformRole } from "@/lib/auth/role-catalog";
import {
  ROOMS,
  hasCapability,
  type Capability,
} from "@/lib/auth/capabilities";

/**
 * The gate on every admin screen.
 *
 * `minRole` rather than a hardcoded equality check. This used to read
 * `role !== "admin"`, which is true for a **head_admin**: the highest role on
 * the platform could not open a single page of the dashboard it is supposed to
 * own. The ladder is the whole point of having ranks.
 *
 * This is a convenience, not the security boundary. Every route under
 * `/api/admin/*` checks the same ladder server-side, so a viewer who forces
 * this component to render gets an empty screen and a row of 403s.
 */
export function AdminGuard({
  children,
  minRole,
  capability,
}: {
  children: React.ReactNode;
  /** Legacy seniority gate. Prefer `capability`: a room is what a job needs. */
  minRole?: PlatformRole;
  /** The room this screen belongs to. */
  capability?: Capability;
}) {
  const { role, ready } = useAuth();

  // The session and profile resolve over the network, so `role` is "guest" for
  // the first paint of every load. Denying on that flashed "Admin access
  // required" at real admins and, on a slow connection, left it up.
  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Checking your access…</p>
      </div>
    );
  }

  const allowed = capability
    ? hasCapability(role, capability)
    : hasMinRole(role, minRole ?? "admin");

  if (!allowed) {
    const roomLabel = capability
      ? (ROOMS.find((r) => r.value === capability)?.label ?? capability)
      : null;
    if (roomLabel) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="w-full max-w-md rounded-xl bg-card/50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {roomLabel} access required
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This page belongs to the {roomLabel.toLowerCase()} room. You are
              signed in as {roleLabel(role)}, which does not hold it.
            </p>
            <Button asChild className="mt-4 bg-sky-600 hover:bg-sky-500">
              <Link href="/home">Back to home</Link>
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-card/50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {roleLabel(minRole)} access required
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This page needs the {roleLabel(minRole)} role or higher. You are signed in
            as {roleLabel(role)}.
          </p>
          <Button asChild className="mt-4 bg-sky-600 hover:bg-sky-500">
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
