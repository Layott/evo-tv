/**
 * What each dashboard screen is for, in the words the screen uses.
 *
 * Written for the person who opens a page they did not build, mid-broadcast,
 * and needs to know what a control does before they touch it. Not a feature
 * list: every entry names the thing on screen, says what it changes, and where
 * it shows up for a viewer.
 *
 * Kept in one file on purpose. Spread across twenty components this drifts out
 * of date silently; together, it reads as documentation and the gaps are
 * obvious.
 */

export interface HowToContent {
  title: string;
  intro: string;
  points: { term: string; detail: string }[];
  stepsTitle?: string;
  steps?: string[];
  /** The one thing that bites people on this screen. */
  watchOut?: string;
}

export const HOW_TO = {
  overview: {
    title: "How this page works",
    intro:
      "The state of the channel in one screen: what is on air, how many people are watching, what has sold, and who signed up. Everything here is read live, so it is the page to leave open during a broadcast.",
    points: [
      { term: "Live now", detail: "Streams currently publishing. A number here with a black player usually means the encoder stopped without telling us." },
      { term: "Viewers", detail: "Counted from heartbeats sent by real players, shared across both API containers. Staff only." },
      { term: "Views today", detail: "Distinct viewing sessions since midnight UTC, not page loads." },
      { term: "Revenue", detail: "Paid orders and active subscriptions, in naira, exactly as Paystack settled them." },
    ],
    watchOut:
      "Numbers are as live as the last heartbeat, roughly a minute. A viewer who closed the tab is still counted for that minute.",
  },

  shows: {
    title: "How this page works",
    intro:
      "The catalogue. A show is the programme itself: its name, its artwork, what it costs to watch, and which seasons and episodes belong to it. Scheduling happens elsewhere; this is what the thing is.",
    points: [
      { term: "Pillar", detail: "Esports, anime or lifestyle. Decides which filter a show appears under on the site and which accent colour it takes on air." },
      { term: "Tier", detail: "Free or premium. Premium withholds the video from anyone without a subscription, not just the badge." },
      { term: "Release date", detail: "A show dated in the future is absent from every list until then, and its page says Coming soon rather than 404." },
      { term: "Poster", detail: "Portrait 2:3. Used on the site, in the app and in the on-air cards, so it is worth uploading properly." },
    ],
    steps: [
      "Create the show with its name, pillar and artwork.",
      "Add seasons and episodes, or publish a video under Library and file it here.",
      "Put it on air by giving it a slot under Schedule.",
    ],
    watchOut:
      "Renaming a show renames it everywhere at once, including the schedule and the on-air graphics. That is deliberate; there is no separate name to keep in step.",
  },

  schedule: {
    title: "How this page works",
    intro:
      "The weekly grid: what plays at what time, every week, until you change it. This is what the guide shows, what the site says is on now, and what the on-air cards announce.",
    points: [
      { term: "Slot", detail: "One programme at one time on one weekday. Its name comes from the show it points at." },
      { term: "Second line on air", detail: "The slot's own line under the programme name: which game this hour is, whose session it is. Leave it blank for none." },
      { term: "Gaps", detail: "Minutes with nothing scheduled. The channel keeps playing; the guide simply says nothing is listed." },
      { term: "Copy day", detail: "Duplicates a whole weekday onto another, which is how a Monday to Friday strip gets built in seconds." },
    ],
    steps: [
      "Pick the weekday.",
      "Add a slot, choose the show, set the start time and how long it runs.",
      "Add the second line if the hour needs one.",
    ],
    watchOut:
      "Two slots cannot start on the same minute. Overlaps are allowed and warned about, because a two-hour programme legitimately covers an hour a stale row still claims.",
  },

  calendar: {
    title: "How this page works",
    intro:
      "The dated view of the same programming: a specific day rather than the repeating week. Use it to see what a given date will actually air once one-off broadcasts and premieres are laid over the grid.",
    points: [
      { term: "Grid row", detail: "Comes from the weekly schedule and repeats every week." },
      { term: "Dated row", detail: "A scheduled stream or an episode premiere. It overrides the grid for that day only." },
      { term: "Today", detail: "Highlighted in the channel's own clock, Lagos, not the browser's." },
    ],
  },

  library: {
    title: "How this page works",
    intro:
      "Everything that has been uploaded: episodes, clips and one-off videos, with the file behind each one. Publishing here is what makes something watchable on the site and in the app.",
    points: [
      { term: "Belongs to a show", detail: "Filing a video under a show makes it an episode and it inherits the show's tier and rating. A one-off stays on its own." },
      { term: "Thumbnail", detail: "Landscape 16:9. Shown on every card before the video plays." },
      { term: "Publish date", detail: "A video dated in the future is not listed and cannot be played until then." },
    ],
    watchOut:
      "An upload is not finished until the preview appears. If the file cannot be read back publicly the upload fails on purpose, because a saved but unreadable URL is a broken poster nobody notices for days.",
  },

  streams: {
    title: "How this page works",
    intro:
      "Live broadcasts and the keys the encoder publishes with. The main channel is the always-on one; anything else is a one-off broadcast.",
    points: [
      { term: "Stream key", detail: "Shown once, when the stream is created. Treat it like a password; regenerate to get a new one, which stops the old encoder dead." },
      { term: "One publish per quality", detail: "Four rungs, 360p to 1080p, each its own publish name. Publishing only one gives every viewer that single quality with nothing to fall back to." },
      { term: "If the feed drops", detail: "How long the broadcast waits for the encoder before ending for real. An always-on channel wants an hour; a one-off match wants minutes." },
      { term: "Make main channel", detail: "Points the home page hero, /channel and the app's channel tab at this stream." },
    ],
    watchOut:
      "The bitrates on this page are what the server promises viewers. An encoder that sends more than it was asked for makes the playlist lie, and phones pick a rung they cannot hold.",
  },

  encoder: {
    title: "How this page works",
    intro:
      "The settings the office machine needs, per encoder. The server does not transcode: whatever the encoder sends is exactly what viewers get, so these numbers are the picture quality.",
    points: [
      { term: "Keyframe 2 seconds", detail: "Not automatic, not 4. Segments are only cut on a keyframe, and rungs whose keyframes do not line up stutter at every quality change." },
      { term: "CBR", detail: "A variable bitrate on a rung that advertises a fixed one is the overshoot problem in slow motion." },
      { term: "Suffixes", detail: "_low, _mid, _hi, _fhd on the publish name. That is how the server knows which rung it is receiving." },
    ],
    watchOut:
      "Aitum honours the resolution you set and ignores bitrate and keyframe, so set those in OBS itself and check the log rather than the dock: it fails silently.",
  },

  content: {
    title: "How this page works",
    intro:
      "The written parts of the site: pages, copy blocks and the things that are neither a show nor a broadcast. Edits here are live on the next request.",
    points: [
      { term: "Status", detail: "Draft is invisible to viewers. Published is on the site." },
      { term: "Slug", detail: "Derived from the title. Nothing here asks you to type a path." },
    ],
  },

  polls: {
    title: "How this page works",
    intro:
      "Live polls attached to a broadcast. A poll is a moment: it opens, people vote in the player, it closes, and the result can take the screen.",
    points: [
      { term: "Who can vote", detail: "Anyone with an account, or subscribers only. An account is the floor, because an unidentified vote can be cast a thousand times from one browser." },
      { term: "Show the totals while it runs", detail: "Off holds the numbers back until it closes, so nobody votes with the crowd and the close is the moment." },
      { term: "Put the winner on screen", detail: "At the close, the result takes the picture over the video for a few seconds." },
      { term: "Change your mind", detail: "Off means one vote each, decided the first time." },
    ],
    steps: [
      "Pick the broadcast the poll belongs to.",
      "Write the question and two to six answers.",
      "Choose who votes, whether the totals show, and how long it runs.",
      "Close it early at any time; the result is final the moment you do.",
    ],
  },

  announcements: {
    title: "How this page works",
    intro:
      "One message, up to three ways: the notification list every account has, a push to phones and browsers that allowed it, and an email. There is no unsend.",
    points: [
      { term: "Where tapping it goes", detail: "Chosen from real things: a page, a show, a broadcast, a video, or an address off EVO TV. The link is built for you." },
      { term: "Who gets it", detail: "Everyone, everyone paying, everyone not paying, people with a role, or a list you paste in." },
      { term: "Their notification list", detail: "Always written. It is the only channel that survives a failure everywhere else." },
      { term: "Check the audience", detail: "Counts the recipients before you send. Always worth pressing." },
    ],
    watchOut:
      "\"Everyone who is paying\" comes from subscriptions, not from roles, so comped staff accounts are not told they subscribed.",
  },

  ads: {
    title: "How this page works",
    intro:
      "Campaign creatives and where they appear, plus the channel's own break rhythm. Three placements play inside the player and take a video; the rest are still images beside the content.",
    points: [
      { term: "Placement", detail: "Choose it first. It decides whether the creative is a video or an image, and what size it should be." },
      { term: "Weight", detail: "How often this ad is picked against others in the same placement. Two ads at 100 and 50 serve twice as often as each other. It is not a priority or a budget." },
      { term: "Channel break", detail: "The ad that plays at the interval set below, on the always-on channel only." },
      { term: "Filler when the feed drops", detail: "What covers the screen when the encoder stops. It works whether or not ad breaks are switched on." },
    ],
    watchOut:
      "Anyone on a paid plan sees neither the breaks nor the filler ads, so test with a free account.",
  },

  users: {
    title: "How this page works",
    intro:
      "Every account, and what each one is allowed to do. Rank decides seniority; the section a role can open is separate and is not inherited.",
    points: [
      { term: "Role", detail: "Granted here and effective immediately, without the person signing out." },
      { term: "Programmer", detail: "Opens the editorial screens: shows, schedule, library, content." },
      { term: "Broadcast op", detail: "Opens the broadcast screens: streams and encoder setup." },
      { term: "Moderator", detail: "Opens moderation, and can pin, delete and ban in a live chat." },
    ],
    watchOut:
      "Nobody can sanction an account at or above their own rank, and nobody can sanction themselves.",
  },

  analytics: {
    title: "How this page works",
    intro:
      "How each video performed and how the platform is doing. Nothing here is modelled or smoothed: a video nobody watched returns zeroes and the page says so.",
    points: [
      { term: "Views", detail: "Distinct viewing sessions, not page loads and not plays." },
      { term: "Average percent viewed", detail: "How far into the video a session got, averaged across sessions." },
      { term: "Retention", detail: "The share of sessions still watching at each percent of the runtime. The cliff is where people leave." },
      { term: "Pick dates", detail: "Any single day, or any window. The presets are shortcuts, not the only answer." },
    ],
  },

  shop: {
    title: "How this page works",
    intro:
      "Merchandise and anything else sold on the site. A product is visible the moment it is active and in stock.",
    points: [
      { term: "Price", detail: "In naira. What the customer is charged is exactly this number." },
      { term: "Stock", detail: "Zero hides the buy button rather than the product." },
      { term: "Linked show", detail: "Puts the product in that show's page and in the panel beside the player." },
    ],
  },

  orders: {
    title: "How this page works",
    intro:
      "What people bought, what they paid and where it is going. Every row here is money that actually moved through Paystack.",
    points: [
      { term: "Status", detail: "Paid, fulfilled, refunded or failed. A failed order means the payment did not complete." },
      { term: "Refund", detail: "Sends the money back through Paystack and marks the order. It cannot be undone." },
    ],
  },

  subscriptions: {
    title: "How this page works",
    intro:
      "Who is subscribed, on which plan, and until when. Entitlements on the site are read from this, not from a role.",
    points: [
      { term: "Active", detail: "In its paid period. Premium content, no ads, early access." },
      { term: "Past due", detail: "A renewal that failed. The perks stay for a few days, because a failed card is usually a bank rather than a decision." },
      { term: "Cancelled", detail: "Runs to the end of the paid period, then stops." },
    ],
  },

  moderation: {
    title: "How this page works",
    intro:
      "Reports from viewers, people currently banned from chat, and appeals. The queue is what somebody complained about; the decision is yours.",
    points: [
      { term: "Approve", detail: "Dismisses the report and leaves the message up." },
      { term: "Delete message", detail: "Removes it for everyone, live, without banning the author." },
      { term: "Ban user", detail: "Writes a timed chat ban and removes the message. It expires by itself." },
      { term: "Escalate", detail: "Passes it up to an admin with the context attached." },
      { term: "Chat rules", detail: "What is blocked before anybody has to report it: links, words, and how many warnings before a mute. The house rules apply everywhere; a broadcast can carry its own, which replace them." },
    ],
  },

  billing: {
    title: "How this page works",
    intro:
      "Where money comes in, in one place. Nothing is edited here: the work happens under Subscriptions and Orders, and the processor is set on the server.",
    points: [
      { term: "Subscriptions", detail: "What the active periods are worth, at the price each was bought on. Premium access is read from these rows, not from a role." },
      { term: "Shop orders", detail: "Paid orders and what they came to. Refunds are counted separately, because the money went back." },
      { term: "Processor", detail: "Paystack takes every card payment. It is chosen by an environment variable on the server, so no switch here can put the platform into a mode where payments are approved without money moving." },
      { term: "USSD", detail: "Not integrated. No short code, no aggregator, no table behind one, so a viewer on a feature phone cannot pay yet." },
    ],
  },

  forensic: {
    title: "How this page works",
    intro:
      "The technical record of a broadcast: what the encoder sent, when segments arrived, and where a stream dropped. This is the page to open when somebody says the stream was buffering.",
    points: [
      { term: "Publish events", detail: "Every time an encoder connected or disconnected, with the rung it was publishing." },
      { term: "Segment timing", detail: "Late or missing segments are what buffering looks like from the server's side." },
    ],
  },

  audit: {
    title: "How this page works",
    intro:
      "Every action taken in this dashboard, who took it, under which role, and what changed. Names, not ids, resolved when you look rather than when it happened.",
    points: [
      { term: "Section", detail: "Which part of the dashboard the action belonged to." },
      { term: "Changed", detail: "The fields that moved, with both sides. \"1 field\" opens to show what it was and what it became." },
      { term: "Deleted records", detail: "Keep the name they had, because a row that only says an id cannot be read later." },
    ],
  },

  settings: {
    title: "How this page works",
    intro:
      "Platform switches, branding, the emails the system sends, and the files the dashboard has uploaded.",
    points: [
      { term: "Feature flags", detail: "Turn a product feature on or off at runtime, with no deploy." },
      { term: "Email templates", detail: "The words in the messages the system sends. Placeholders in braces are filled in per recipient." },
      { term: "Uploads", detail: "Checks every uploaded file is actually readable and repairs the ones that are not. A broken thumbnail is almost always this." },
    ],
  },
} as const satisfies Record<string, HowToContent>;

export type HowToKey = keyof typeof HOW_TO;
