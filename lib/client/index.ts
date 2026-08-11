/**
 * The real data layer for client components.
 *
 * Drop-in replacement for the old `@/lib/mock` barrel: same function names, same
 * signatures, same return shapes, but every call goes to a `/api/*` route
 * handler backed by Postgres.
 *
 * Swapping a page over is a one-line import change:
 *
 *   -import { listGames } from "@/lib/mock";
 *   +import { listGames } from "@/lib/client";
 *
 * Domains that have no backend yet are deliberately absent rather than stubbed,
 * so importing one is a compile error instead of a silent empty screen. See
 * docs/HANDOVER-LANDING-BRAND.md for that list.
 */
export * from "./_fetch";
export * from "./catalog";
export * from "./account";
export * from "./ads";
export * from "./live";
