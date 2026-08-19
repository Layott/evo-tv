import { NextResponse, type NextRequest } from "next/server";
import {
  describeDestination,
  resolvePath,
} from "@/lib/api/destinations";
import { announcementEmail } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";
import { z } from "zod";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { createNotification } from "@/lib/api/notifications";
import { sendExpoPushToUser } from "@/lib/api/expo-push";
import { sendPushToUser } from "@/lib/push";
import { RANK, type PlatformRole } from "@/lib/auth/role-catalog";

/**
 * Send a message to viewers.
 *
 * The platform could already deliver a push in three ways - an in-app
 * notification row, an Expo push to the mobile app, a Web Push to a browser -
 * and nothing could trigger one. `sendExpoPushToUser` had exactly one caller,
 * `/api/cron/reminders`, and that path had no
 * scheduler on the droplet either, so in practice no notification has ever been
 * sent by this system.
 *
 * All three channels fire together on purpose. A viewer who has the app gets a
 * push; one who only uses the site gets a browser notification if they allowed
 * them; everyone gets the row in their notifications list, which is the only
 * channel that cannot silently fail.
 *
 * Deliberately not a marketing tool: there is no scheduling, no segmentation
 * beyond role, and no templating. It is "tell people something", which is what
 * a live channel actually needs.
 */

const PLATFORM_ROLES = Object.keys(RANK) as [PlatformRole, ...PlatformRole[]];

const bodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(500),
  /**
   * Where tapping it goes, chosen rather than typed.
   *
   * This was a text box asking for "an in-app path starting with /", which
   * required the operator to know the route table and shipped a dead link the
   * day a route was renamed. The path is composed server-side from a real
   * thing: a page, a show, a broadcast, a video, or an address off the
   * platform.
   */
  destination: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("none") }),
      z.object({
        kind: z.literal("page"),
        page: z.enum([
          "home",
          "channel",
          "schedule",
          "shows",
          "discover",
          "events",
          "shop",
          "upgrade",
        ]),
      }),
      z.object({ kind: z.literal("show"), id: z.string().min(1) }),
      z.object({ kind: z.literal("stream"), id: z.string().min(1) }),
      z.object({ kind: z.literal("video"), id: z.string().min(1) }),
      z.object({ kind: z.literal("external"), url: z.string().url() }),
    ])
    .default({ kind: "none" }),
  audience: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("everyone") }),
    z.object({ kind: z.literal("role"), role: z.enum(PLATFORM_ROLES) }),
    z.object({ kind: z.literal("user"), email: z.string().trim().email() }),
    /** A named set of people, pasted or picked. */
    z.object({
      kind: z.literal("users"),
      emails: z.array(z.string().trim().email()).min(1).max(500),
    }),
    /** Everyone currently paying, or everyone who is not. */
    z.object({ kind: z.literal("subscribers") }),
    z.object({ kind: z.literal("free") }),
  ]),
  /**
   * How to deliver it. The notification list is always written, because it is
   * the durable channel: a push that fails leaves nothing behind, and a person
   * with no device would otherwise never see the message at all.
   */
  channels: z
    .object({
      push: z.boolean().default(true),
      email: z.boolean().default(false),
    })
    .default({ push: true, email: false }),
  /**
   * A dry run reports who it would reach and sends nothing. There is no undo on
   * a notification, so the screen asks for this first.
   */
  preview: z.boolean().default(false),
});

/** Live accounts only: a deleted one cannot read anything sent to it. */
async function resolveAudience(
  audience: z.infer<typeof bodySchema>["audience"],
): Promise<{ ids: string[]; description: string }> {
  if (audience.kind === "user") {
    const rows = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(
        and(
          sql`lower(${schema.user.email}) = ${audience.email.toLowerCase()}`,
          isNull(schema.user.deletedAt),
        ),
      )
      .limit(1);
    return { ids: rows.map((r) => r.id), description: audience.email };
  }

  if (audience.kind === "users") {
    const wanted = audience.emails.map((e) => e.toLowerCase());
    const rows = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(isNull(schema.user.deletedAt));
    const matched = rows.filter((r) => wanted.includes(r.email.toLowerCase()));
    return {
      ids: matched.map((r) => r.id),
      description: `${matched.length} of ${wanted.length} named accounts`,
    };
  }

  if (audience.kind === "subscribers" || audience.kind === "free") {
    /*
     * Who is paying right now, from the subscriptions table rather than the
     * role column: a role is granted by hand for comps and staff, and using it
     * here would send a "thanks for subscribing" message to the office.
     */
    const paying = await db
      .selectDistinct({ id: schema.subscriptions.userId })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "active"));
    const payingIds = new Set(paying.map((r) => r.id));

    const everyone = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(isNull(schema.user.deletedAt));

    const ids =
      audience.kind === "subscribers"
        ? everyone.filter((r) => payingIds.has(r.id)).map((r) => r.id)
        : everyone.filter((r) => !payingIds.has(r.id)).map((r) => r.id);

    return {
      ids,
      description:
        audience.kind === "subscribers"
          ? "everyone with an active subscription"
          : "everyone without a subscription",
    };
  }

  if (audience.kind === "role") {
    const rows = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(
        and(eq(schema.user.role, audience.role), isNull(schema.user.deletedAt)),
      );
    return { ids: rows.map((r) => r.id), description: `everyone with the ${audience.role} role` };
  }

  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(isNull(schema.user.deletedAt));
  return { ids: rows.map((r) => r.id), description: "every account" };
}

export async function POST(req: NextRequest) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  const { ids, description } = await resolveAudience(input.audience);

  /*
   * The path, composed here from what was chosen. Nobody typed it, so it
   * cannot be a route that does not exist, and a show that has been deleted
   * since the message was drafted resolves to nothing rather than to a 404.
   */
  const linkUrl = (await resolvePath(input.destination)) ?? "";
  const destinationLabel = await describeDestination(input.destination);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: `Nobody matches ${description}.` },
      { status: 404 },
    );
  }

  if (input.preview) {
    return NextResponse.json({
      preview: true,
      recipients: ids.length,
      description,
      // How many of them could receive a push at all, so "0 pushes delivered"
      // is not mistaken for a failure when nobody has the app installed.
      withPushTokens: await countWithPushTargets(ids),
      destination: await describeDestination(input.destination),
    });
  }

  let notified = 0;
  let expoDelivered = 0;
  let webDelivered = 0;

  for (const userId of ids) {
    // The row first. It is the durable channel: if a push fails, or the person
    // has no device registered, the message is still waiting for them.
    await createNotification({
      userId,
      // `system`, because that is the only type in the union that means "from
      // EVO TV rather than from something you follow". Adding an
      // `announcement` type would mean touching every client that switches on
      // this field to pick an icon.
      type: "system",
      title: input.title,
      body: input.body,
      linkUrl: linkUrl || null,
    });
    notified += 1;

    // Push is best effort by design. One person's expired token must not stop
    // the fan-out, and both senders already swallow their own transport errors.
    if (!input.channels.push) continue;
    expoDelivered += await sendExpoPushToUser(userId, {
      title: input.title,
      body: input.body,
      data: { kind: "announcement", linkUrl },
    });
    webDelivered += await sendPushToUser(userId, {
      title: input.title,
      body: input.body,
      url: linkUrl || undefined,
    });
  }

  /*
   * Email, when it was asked for.
   *
   * After the loop rather than inside it: a mail provider that starts refusing
   * halfway should not leave half the audience with a notification and the
   * other half without one, and the notification row is what actually matters.
   */
  let emailed = 0;
  if (input.channels.email) {
    const recipients = await db
      .select({ email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, ids));
    const mail = announcementEmail({
      title: input.title,
      body: input.body,
      // An email needs a full address, not an in-app path.
      url: linkUrl ? (linkUrl.startsWith("http") ? linkUrl : `${SITE_URL}${linkUrl}`) : null,
    });
    for (const person of recipients) {
      try {
        await sendEmail({
          to: person.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        emailed += 1;
      } catch {
        // One bad address must not stop the rest.
      }
    }
  }

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "announcement.send",
    targetType: "system",
    targetId: "announcement",
    meta: {
      title: input.title,
      audience: description,
      destination: destinationLabel,
      recipients: ids.length,
      expoDelivered,
      webDelivered,
      emailed,
    },
  });

  return NextResponse.json({
    ok: true,
    recipients: ids.length,
    notified,
    expoDelivered,
    webDelivered,
    emailed,
    description,
    destination: destinationLabel,
  });
}

/** How many of these accounts have any device that could receive a push. */
async function countWithPushTargets(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const [expo, web] = await Promise.all([
    db
      .select({ userId: schema.expoPushTokens.userId })
      .from(schema.expoPushTokens)
      .where(inArray(schema.expoPushTokens.userId, userIds)),
    db
      .select({ userId: schema.pushSubscriptions.userId })
      .from(schema.pushSubscriptions)
      .where(inArray(schema.pushSubscriptions.userId, userIds)),
  ]);
  return new Set([...expo, ...web].map((r) => r.userId)).size;
}
