/**
 * What a chat message is allowed to contain, decided without a database.
 *
 * Pure on purpose. Screening a message is the part that has to be right, and it
 * is the part hardest to be sure about: a link detector that misses
 * `evotv﻿.co` with a zero-width space in it is a scam nobody blocked, and one
 * that fires on "3.5" is a channel where numbers cannot be typed. Both failures
 * are testable here and neither is testable through the route.
 */

export interface ChatRules {
  blockLinks: boolean;
  /** Hosts that are still allowed when links are blocked, e.g. `evotv.co`. */
  allowedDomains: string[];
  bannedWords: string[];
  strikesBeforeBan: number;
  banMinutes: number;
}

export const DEFAULT_CHAT_RULES: ChatRules = {
  blockLinks: true,
  allowedDomains: ["evotv.co"],
  bannedWords: [],
  strikesBeforeBan: 3,
  banMinutes: 60,
};

export type ChatVerdict =
  | { allowed: true }
  | { allowed: false; reason: "link" | "word"; detail: string };

/**
 * Characters that exist to make a link not look like one.
 *
 * Zero-width spaces and joiners are invisible, survive a copy and paste, and
 * split `evotv.co` into two fragments that no pattern matches. Stripping them
 * before the test costs nothing and closes the cheapest evasion there is.
 */
const INVISIBLE = /[​-‍⁠﻿]/g;

/** `dot`, `(dot)`, ` . `, and the rest of the ways a full stop gets written. */
const DOT_WORDS = /\s*[([{<]?\s*(?:dot|punto|\.)\s*[)\]}>]?\s*/gi;

function normalise(body: string): string {
  return body
    .replace(INVISIBLE, "")
    .toLowerCase()
    .replace(/ /g, " ");
}

/**
 * Anything that would reach a browser as a link.
 *
 * Deliberately wider than `https://`: most posted links have no scheme, and the
 * ones worth blocking least often do. A bare host with a known ending counts,
 * and so does one written with the dot spelled out.
 */
const SCHEME = /\b(?:https?:\/\/|www\.)\S+/i;
const HOSTISH = /\b[a-z0-9][a-z0-9-]{0,62}\.(?:com|net|org|io|co|gg|tv|me|ly|link|xyz|app|shop|store|info|biz|live|club|online|site|ng|africa)\b(?:\/\S*)?/i;

/** The hosts a message mentions, lower-cased and without `www.`. */
export function hostsIn(body: string): string[] {
  const text = normalise(body).replace(DOT_WORDS, ".");
  const found = new Set<string>();
  const pattern = new RegExp(`${SCHEME.source}|${HOSTISH.source}`, "gi");
  for (const match of text.match(pattern) ?? []) {
    const cleaned = match
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0];
    if (cleaned) found.add(cleaned);
  }
  return [...found];
}

function allowed(host: string, allowedDomains: string[]): boolean {
  return allowedDomains.some((domain) => {
    const d = domain.trim().toLowerCase().replace(/^www\./, "");
    if (!d) return false;
    // `evotv.co` allows `evotv.co` and `www.evotv.co` and `help.evotv.co`, and
    // not `evotv.co.scam.xyz`, which is the whole reason this is not `includes`.
    return host === d || host.endsWith(`.${d}`);
  });
}

/**
 * Is this message allowed under these rules?
 *
 * Returns the reason as well as the verdict, because the viewer is told what
 * happened and "message blocked" with no reason is how a chat loses the people
 * who were not breaking the rule.
 */
export function screenMessage(body: string, rules: ChatRules): ChatVerdict {
  const text = normalise(body);

  for (const raw of rules.bannedWords) {
    const word = raw.trim().toLowerCase();
    if (word && text.includes(word)) {
      return { allowed: false, reason: "word", detail: word };
    }
  }

  if (rules.blockLinks) {
    for (const host of hostsIn(body)) {
      if (!allowed(host, rules.allowedDomains)) {
        return { allowed: false, reason: "link", detail: host };
      }
    }
  }

  return { allowed: true };
}

/** What the viewer is told, in their words rather than the rule's. */
export function refusalMessage(verdict: Extract<ChatVerdict, { allowed: false }>): string {
  return verdict.reason === "link"
    ? "Links are not allowed in this chat."
    : "That message was blocked by the chat rules.";
}
