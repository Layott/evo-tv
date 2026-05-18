import "server-only";
import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type ApplicationStatus =
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected";

export type SocialPlatform =
  | "youtube"
  | "twitch"
  | "tiktok"
  | "kick"
  | "other";

export interface CreatorApplicationRow {
  id: string;
  userId: string;
  bio: string;
  country: string;
  primaryGameId: string;
  socialPlatform: SocialPlatform;
  socialHandle: string;
  followerCount: number;
  agreementAccepted: boolean;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

function rowToApp(r: typeof schema.creatorApplications.$inferSelect): CreatorApplicationRow {
  return {
    id: r.id,
    userId: r.userId,
    bio: r.bio,
    country: r.country,
    primaryGameId: r.primaryGameId,
    socialPlatform: r.socialPlatform as SocialPlatform,
    socialHandle: r.socialHandle,
    followerCount: r.followerCount,
    agreementAccepted: r.agreementAccepted === 1,
    status: r.status as ApplicationStatus,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    reviewerNote: r.reviewerNote,
  };
}

function genId(): string {
  return (
    "capp_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface SubmitApplicationInput {
  userId: string;
  bio: string;
  country: string;
  primaryGameId: string;
  socialPlatform: SocialPlatform;
  socialHandle: string;
  followerCount: number;
  agreementAccepted: boolean;
}

export class CreatorAppError extends Error {
  code: "invalid" | "agreement_required" | "duplicate" | "not_found";
  constructor(code: CreatorAppError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<CreatorApplicationRow> {
  if (!input.agreementAccepted)
    throw new CreatorAppError("agreement_required", "Agreement required");
  if (input.bio.trim().length < 20)
    throw new CreatorAppError("invalid", "Bio must be at least 20 characters");
  if (!input.socialHandle.trim())
    throw new CreatorAppError("invalid", "Social handle required");
  if (input.followerCount < 0)
    throw new CreatorAppError("invalid", "Invalid follower count");

  const id = genId();
  const now = new Date().toISOString();

  const existing = (
    await db
      .select()
      .from(schema.creatorApplications)
      .where(eq(schema.creatorApplications.userId, input.userId))
      .limit(1)
  )[0];

  if (existing) {
    throw new CreatorAppError(
      "duplicate",
      "Application already submitted",
    );
  }

  await db.insert(schema.creatorApplications).values({
    id,
    userId: input.userId,
    bio: input.bio.trim(),
    country: input.country,
    primaryGameId: input.primaryGameId,
    socialPlatform: input.socialPlatform,
    socialHandle: input.socialHandle.trim(),
    followerCount: Math.floor(input.followerCount),
    agreementAccepted: 1,
    status: "submitted",
    submittedAt: now,
    reviewedAt: null,
    reviewerNote: null,
  });

  const row = (
    await db
      .select()
      .from(schema.creatorApplications)
      .where(eq(schema.creatorApplications.id, id))
      .limit(1)
  )[0]!;
  return rowToApp(row);
}

export async function getMyApplication(
  userId: string,
): Promise<CreatorApplicationRow | null> {
  const row = (
    await db
      .select()
      .from(schema.creatorApplications)
      .where(eq(schema.creatorApplications.userId, userId))
      .limit(1)
  )[0];
  return row ? rowToApp(row) : null;
}

export async function listApplications(
  status?: ApplicationStatus,
): Promise<CreatorApplicationRow[]> {
  const rows = status
    ? await db
        .select()
        .from(schema.creatorApplications)
        .where(eq(schema.creatorApplications.status, status))
        .orderBy(desc(schema.creatorApplications.submittedAt))
    : await db
        .select()
        .from(schema.creatorApplications)
        .orderBy(desc(schema.creatorApplications.submittedAt));
  return rows.map(rowToApp);
}

export async function reviewApplication(
  id: string,
  status: "in_review" | "approved" | "rejected",
  note?: string,
): Promise<CreatorApplicationRow> {
  const r = (
    await db
      .select()
      .from(schema.creatorApplications)
      .where(eq(schema.creatorApplications.id, id))
      .limit(1)
  )[0];
  if (!r) throw new CreatorAppError("not_found", "Application not found");

  await db
    .update(schema.creatorApplications)
    .set({
      status,
      reviewedAt: new Date().toISOString(),
      reviewerNote: note ?? null,
    })
    .where(eq(schema.creatorApplications.id, id));

  const fresh = (
    await db
      .select()
      .from(schema.creatorApplications)
      .where(eq(schema.creatorApplications.id, id))
      .limit(1)
  )[0]!;
  return rowToApp(fresh);
}
