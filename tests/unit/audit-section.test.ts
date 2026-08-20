import { describe, expect, it } from "vitest";

import { sectionForAudit } from "@/lib/api/audit-section";
import { SECTIONS } from "@/lib/auth/capabilities";

/**
 * The audit log printed "not recorded" in the Section column for most of its
 * rows because 39 call sites never passed one. The section is derived now, and
 * the thing worth guarding is not the mapping itself but the two ways it can
 * quietly go wrong again: a section name the dashboard does not know, which
 * renders as a raw string, and an action that falls through to nothing.
 */

const KNOWN = new Set<string>(SECTIONS.map((s) => s.value));

/** Every action string written anywhere in the codebase, as of this batch. */
const ACTIONS: [action: string, targetType: string][] = [
  ["role.grant", "user"],
  ["user.profile.update", "user"],
  ["branding.update", "site"],
  ["email_template.update", "email_template"],
  ["chat.ban", "user"],
  ["chat.delete", "user"],
  ["chat_rules.update", "stream"],
  ["announcement.send", "system"],
  ["show.create", "show"],
  ["season.delete", "season"],
  ["episode.update", "episode"],
  ["epg.create", "epg_slot"],
  ["clip.restore", "clip"],
  ["vod.delete", "vod"],
  ["stream.force_end", "stream"],
  ["channel.suspend", "channel"],
  ["channel.breaks.update", "system"],
  ["playout.now_airing.update", "stream"],
  ["bandwidth.threshold", "system"],
  ["uploads.repair", "storage"],
  ["order.ship", "order"],
  ["product.update", "product"],
  ["subscription.cancel", "subscription"],
  ["gdpr.purge", "user"],
  ["fantasy.score", "fantasy_league"],
  // The bare ones, where only the target says where it happened.
  ["create", "ad"],
  ["update", "game"],
  ["delete", "team"],
  ["upsert", "feature_flag"],
  ["update", "player"],
  ["create", "event"],
  ["ban", "report"],
];

describe("sectionForAudit", () => {
  it("names a section the dashboard can label, for every action we write", () => {
    for (const [action, targetType] of ACTIONS) {
      const section = sectionForAudit(action, targetType);
      expect(section, `${action} on ${targetType}`).not.toBeNull();
      expect(KNOWN.has(section ?? ""), `${action} -> ${section}`).toBe(true);
    }
  });

  it("puts the role grant in the roster, which is the row that showed nothing", () => {
    expect(sectionForAudit("role.grant", "user")).toBe("roster");
  });

  it("falls back to the target when the action has no namespace", () => {
    expect(sectionForAudit("create", "ad")).toBe("commerce");
    expect(sectionForAudit("delete", "episode")).toBe("editorial");
  });

  it("prefers the action over the target when they disagree", () => {
    // A chat ban is community work even though it is written against a user.
    expect(sectionForAudit("chat.ban", "user")).toBe("community");
  });

  it("returns null rather than guessing when it knows neither", () => {
    expect(sectionForAudit("wibble", "wobble")).toBeNull();
  });
});
