/**
 * Which section of the dashboard an action belonged to.
 *
 * 39 of the writeAudit call sites never passed one, so the audit log printed
 * "not recorded" in the Section column for, among other things, every role
 * grant this account has ever made. Asking each call site to remember a second
 * constant is how it got that way. The action and the target already say which
 * room the work was done in, so the answer is derived here and a call site only
 * passes one when it genuinely disagrees.
 *
 * Pure on purpose: `lib/api/audit.ts` and `lib/api/admin.ts` both hold a
 * writeAudit and already import from each other's direction, so the shared
 * table cannot live in either of them.
 */

const SECTION_BY_ACTION: [string, string][] = [
  ["show.", "editorial"],
  ["season.", "editorial"],
  ["episode.", "editorial"],
  ["epg.", "editorial"],
  ["clip.", "editorial"],
  ["vod.", "editorial"],
  ["announcement.", "editorial"],
  ["stream.", "broadcast"],
  ["channel.", "broadcast"],
  ["playout.", "broadcast"],
  ["bandwidth.", "broadcast"],
  ["uploads.", "broadcast"],
  ["order.", "commerce"],
  ["product.", "commerce"],
  ["subscription.", "commerce"],
  ["ad.", "commerce"],
  ["payout.", "commerce"],
  ["chat.", "community"],
  ["chat_rules.", "community"],
  ["report.", "community"],
  ["sanction.", "community"],
  ["gdpr.", "community"],
  ["fantasy.", "community"],
  ["role.", "roster"],
  ["user.", "roster"],
  ["branding.", "roster"],
  ["email_template.", "roster"],
];

/**
 * The fallback for the bare actions.
 *
 * A handful of routes log `create` / `update` / `delete` with no namespace on
 * the front, which says nothing about where it happened. What was touched
 * still does.
 */
const SECTION_BY_TARGET: Record<string, string> = {
  ad: "commerce",
  order: "commerce",
  product: "commerce",
  subscription: "commerce",
  channel: "broadcast",
  storage: "broadcast",
  stream: "broadcast",
  clip: "editorial",
  epg_slot: "editorial",
  episode: "editorial",
  event: "editorial",
  fantasy_league: "editorial",
  game: "editorial",
  player: "editorial",
  season: "editorial",
  show: "editorial",
  team: "editorial",
  vod: "editorial",
  report: "community",
  creator_application: "roster",
  email_template: "roster",
  feature_flag: "roster",
  site: "roster",
  user: "roster",
};

export function sectionForAudit(
  action: string,
  targetType: string,
): string | null {
  const byAction = SECTION_BY_ACTION.find(([prefix]) => action.startsWith(prefix));
  if (byAction) return byAction[1];
  return SECTION_BY_TARGET[targetType] ?? null;
}
