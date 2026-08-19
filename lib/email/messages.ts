import "server-only";

import {
  renderEmailHtml,
  renderEmailText,
  type EmailContent,
} from "./layout";

/**
 * Every message EVO TV sends, as content rather than markup.
 *
 * Each function returns a subject and an `EmailContent`, and the shell in
 * `layout.ts` turns that into HTML and text. Keeping them here means the copy
 * can be read and argued about without wading through table markup, and a
 * design change lands in one file rather than nine.
 *
 * The copy rules are the platform's: say what happened, name the thing, no
 * marketing voice, no em dashes, and never invent a number.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function render(subject: string, content: EmailContent): RenderedEmail {
  return {
    subject,
    text: renderEmailText(content),
    html: renderEmailHtml(content),
  };
}

/* ── Account ──────────────────────────────────────────────────────────── */

export function welcomeEmail(input: { name?: string }): RenderedEmail {
  const who = input.name?.trim() ? `, ${input.name.trim()}` : "";
  return render("Welcome to EVO TV", {
    preheader: "Your account is ready. Here is where to start.",
    heading: `Welcome${who}`,
    blocks: [
      {
        text: "Your account is ready. EVO TV runs a live channel around the clock, plus recorded shows you can watch whenever.",
      },
      { cta: { label: "Start watching", url: "https://evotv.co/home" } },
      {
        text: "Set your language and playback quality in settings. If you are on mobile data, the 480p default will save you a lot of it.",
      },
    ],
    footnote: "You are getting this because you created an EVO TV account.",
  });
}

export function verifyEmail(input: { url: string }): RenderedEmail {
  return render("Verify your EVO TV email", {
    preheader: "Confirm this address to finish setting up your account.",
    heading: "Confirm your email",
    blocks: [
      { text: "Tap below to confirm this is your address." },
      { cta: { label: "Verify email", url: input.url } },
    ],
    footnote: "If you did not create an EVO TV account, ignore this message.",
  });
}

export function changeEmailRequested(input: {
  newEmail: string;
  url: string;
}): RenderedEmail {
  return render("Confirm your new EVO TV email", {
    preheader: `Approve the change to ${input.newEmail}.`,
    heading: "Confirm your new email",
    blocks: [
      {
        text: `Someone asked to change the email on your account to <strong>${input.newEmail}</strong>. Nothing changes until you confirm it.`,
      },
      { cta: { label: "Confirm the change", url: input.url } },
      {
        text: "If this was not you, ignore this message and change your password. This link was sent to your current address for that reason.",
      },
    ],
  });
}

/* ── Watching ─────────────────────────────────────────────────────────── */

export function goingLiveEmail(input: {
  title: string;
  channel: string;
  url: string;
}): RenderedEmail {
  return render(`${input.title} is live now`, {
    preheader: `${input.channel} just went live.`,
    heading: `${input.title} is live`,
    blocks: [
      { text: `${input.channel} is broadcasting now.` },
      { cta: { label: "Watch live", url: input.url } },
    ],
    footnote:
      "You follow this channel. Turn these off under Notifications in settings.",
  });
}

export function weeklyDigestEmail(input: {
  items: Array<{ title: string; when: string }>;
}): RenderedEmail {
  return render("This week on EVO TV", {
    preheader: "What is airing this week.",
    heading: "This week on EVO TV",
    blocks: [
      { text: "Here is what is scheduled." },
      {
        rows: input.items.map((i) => ({ label: i.when, value: i.title })),
      },
      { cta: { label: "See the full schedule", url: "https://evotv.co/schedule" } },
    ],
    footnote: "One email on Mondays. Turn it off under Notifications.",
  });
}

/* ── Money ────────────────────────────────────────────────────────────── */

export function orderConfirmedEmail(input: {
  orderId: string;
  totalNgn: number;
  items: Array<{ name: string; qty: number }>;
}): RenderedEmail {
  return render(`EVO TV order ${input.orderId} confirmed`, {
    preheader: `We have your order ${input.orderId}.`,
    heading: "Order confirmed",
    blocks: [
      { text: "Thanks. Here is what you ordered." },
      {
        rows: [
          ...input.items.map((i) => ({
            label: i.qty > 1 ? `${i.name} x${i.qty}` : i.name,
            value: "",
          })),
          { label: "Total", value: formatNgn(input.totalNgn) },
          { label: "Order", value: input.orderId },
        ],
      },
      { cta: { label: "View your orders", url: "https://evotv.co/profile/orders" } },
    ],
  });
}

export function subscriptionStartedEmail(input: {
  priceNgn: number;
  renewsOn: string;
}): RenderedEmail {
  return render("Your EVO TV Premium is active", {
    preheader: "Premium is on. No ads, and the full catalogue.",
    heading: "Premium is active",
    blocks: [
      { text: "No ads, premium shows, and the highest quality the channel carries." },
      {
        rows: [
          { label: "Price", value: `${formatNgn(input.priceNgn)} a month` },
          { label: "Renews", value: input.renewsOn },
        ],
      },
      { cta: { label: "Start watching", url: "https://evotv.co/home" } },
    ],
    footnote: "Cancel any time under Billing in settings.",
  });
}

export function subscriptionCancelledEmail(input: {
  activeUntil: string;
}): RenderedEmail {
  return render("Your EVO TV Premium is cancelled", {
    preheader: `Premium runs until ${input.activeUntil}.`,
    heading: "Premium cancelled",
    blocks: [
      {
        text: `You will not be charged again. Premium keeps working until <strong>${input.activeUntil}</strong>, which is the end of the period you have already paid for.`,
      },
      { cta: { label: "Resubscribe", url: "https://evotv.co/upgrade" } },
    ],
  });
}

/* ── Moderation ───────────────────────────────────────────────────────── */

export function reportReceivedEmail(input: {
  reference: string;
}): RenderedEmail {
  return render("We got your report", {
    preheader: `Reference ${input.reference}.`,
    heading: "Your report is with the moderators",
    blocks: [
      {
        text: "A moderator will look at it. We do not usually write back about individual reports, but every one is read.",
      },
      { code: input.reference },
    ],
  });
}

function formatNgn(amount: number): string {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}

/**
 * An announcement, in an inbox.
 *
 * The same words that go to the notification list and the push. An
 * announcement that is worth interrupting somebody for is worth writing once,
 * and rewriting it per channel is how the three drift apart.
 */
export function announcementEmail(input: {
  title: string;
  body: string;
  /** Where it points, already composed into a full URL. */
  url?: string | null;
  /** The words on the button. Falls back to something plain. */
  cta?: string;
}): RenderedEmail {
  return render(input.title, {
    preheader: input.body.slice(0, 120),
    heading: input.title,
    blocks: [
      {
        text: input.body,
        ...(input.url
          ? { cta: { label: input.cta || "Open EVO TV", url: input.url } }
          : {}),
      },
    ],
    footnote:
      "You are getting this because you have an EVO TV account. Turn announcements off in Settings, Notifications.",
  });
}
