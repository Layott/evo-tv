import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHAT_RULES,
  hostsIn,
  screenMessage,
  type ChatRules,
} from "@/lib/chat/rules";

const rules: ChatRules = { ...DEFAULT_CHAT_RULES, bannedWords: ["scam"] };

describe("screenMessage", () => {
  it("lets ordinary chat through", () => {
    for (const line of [
      "that was clean",
      "3.5 seconds left",
      "GG",
      "he went 12.4 kd tonight",
      "see you at 8.30",
    ]) {
      expect(screenMessage(line, rules).allowed).toBe(true);
    }
  });

  it("blocks the shapes a link actually arrives in", () => {
    for (const line of [
      "https://free-drops.xyz/claim",
      "check www.twitch.tv/someone",
      "go to freefire-rewards.com now",
      "join discord.gg/abcd",
      "visit freegems dot xyz",
      "f r e e".length ? "claim at bit.ly/x1" : "",
    ]) {
      const verdict = screenMessage(line, rules);
      expect(verdict.allowed, line).toBe(false);
    }
  });

  it("sees through an invisible character in the middle of a host", () => {
    // A zero-width space survives copy and paste and splits the host in two.
    expect(screenMessage("go to scam\u200bsite.com", rules).allowed).toBe(false);
  });

  it("still allows the channel's own links", () => {
    expect(screenMessage("watch on evotv.co/schedule", rules).allowed).toBe(true);
    expect(screenMessage("help.evotv.co has it", rules).allowed).toBe(true);
    // The suffix trick: this is not evotv.co, it only ends with those letters.
    expect(screenMessage("evotv.co.claim-now.xyz", rules).allowed).toBe(false);
  });

  it("blocks a banned word wherever it sits", () => {
    const verdict = screenMessage("this is a SCAM channel", rules);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toBe("word");
  });

  it("lets links through when the operator turns the rule off", () => {
    const open: ChatRules = { ...rules, blockLinks: false };
    expect(screenMessage("https://free-drops.xyz", open).allowed).toBe(true);
  });
});

describe("hostsIn", () => {
  it("returns bare hosts without scheme or www", () => {
    expect(hostsIn("try https://www.Example.COM/path and foo.gg")).toEqual([
      "example.com",
      "foo.gg",
    ]);
  });
});
