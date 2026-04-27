import { sleep } from "./_util";
import { teamLogo } from "./_media";

export type PartnerKind = "betting" | "sponsor";
export type PartnerSlot = "home" | "sidebar" | "odds-widget";

export interface Partner {
  id: string;
  name: string;
  tagline: string;
  blurb: string;
  kind: PartnerKind;
  logoUrl: string;
  brandColor: string;
  slotPlacements: PartnerSlot[];
  country: string;
  rating: number; // 1-5 stars
  ctaLabel: string;
}

export interface MatchOdds {
  matchId: string;
  partnerId: string;
  partnerName: string;
  oddsTeamA: number;
  oddsTeamB: number;
  oddsDraw?: number;
  marketLabel: string;
  updatedAt: string;
}

export const partners: Partner[] = [
  {
    id: "partner_betevo",
    name: "BetEvo",
    tagline: "Africa's esports-first oddsmaker.",
    blurb:
      "BetEvo specializes in African mobile esports markets, offering live in-play prices on Free Fire, CoD Mobile and EA FC.",
    kind: "betting",
    logoUrl: teamLogo("betevo"),
    brandColor: "#10b981",
    slotPlacements: ["home", "sidebar", "odds-widget"],
    country: "NG",
    rating: 4.6,
    ctaLabel: "Visit BetEvo",
  },
  {
    id: "partner_oddsarena",
    name: "OddsArena",
    tagline: "Live odds, deeper markets.",
    blurb:
      "Pan-African operator with the widest market depth on tournaments. Markets reload every 8 seconds during live play.",
    kind: "betting",
    logoUrl: teamLogo("oddsarena"),
    brandColor: "#a855f7",
    slotPlacements: ["sidebar", "odds-widget"],
    country: "GH",
    rating: 4.4,
    ctaLabel: "Visit OddsArena",
  },
  {
    id: "partner_championsbet",
    name: "ChampionsBet",
    tagline: "For the long-format watcher.",
    blurb:
      "Specialists in best-of-5 props and outrights. Especially strong on bracket-stage markets.",
    kind: "betting",
    logoUrl: teamLogo("championsbet"),
    brandColor: "#f97316",
    slotPlacements: ["home", "sidebar"],
    country: "KE",
    rating: 4.2,
    ctaLabel: "Visit ChampionsBet",
  },
  {
    id: "partner_primebet",
    name: "PrimeBet",
    tagline: "Mobile-first, Lagos-based.",
    blurb:
      "Built natively for mobile bettors. The fastest cash-out flow on the continent and a rebate program tied to engagement.",
    kind: "betting",
    logoUrl: teamLogo("primebet"),
    brandColor: "#ef4444",
    slotPlacements: ["home", "odds-widget"],
    country: "NG",
    rating: 4.0,
    ctaLabel: "Visit PrimeBet",
  },
  {
    id: "partner_africaodds",
    name: "AfricaOdds",
    tagline: "Continental coverage, local lines.",
    blurb:
      "Region-aware pricing across all 54 African markets. Best line aggregation engine on the continent.",
    kind: "betting",
    logoUrl: teamLogo("africaodds"),
    brandColor: "#0ea5e9",
    slotPlacements: ["sidebar", "odds-widget"],
    country: "ZA",
    rating: 4.3,
    ctaLabel: "Visit AfricaOdds",
  },
  {
    id: "partner_propick",
    name: "ProPick",
    tagline: "Tipster network meets data feeds.",
    blurb:
      "Curated tipster picks paired with deep statistical models. Most popular among Free Fire devotees.",
    kind: "betting",
    logoUrl: teamLogo("propick"),
    brandColor: "#eab308",
    slotPlacements: ["home", "sidebar"],
    country: "EG",
    rating: 4.1,
    ctaLabel: "Visit ProPick",
  },
];

export async function listPartners(placement?: PartnerSlot): Promise<Partner[]> {
  await sleep(60);
  if (!placement) return partners;
  return partners.filter((p) => p.slotPlacements.includes(placement));
}

const oddsMap: Record<string, MatchOdds[]> = {
  match_1: [
    {
      matchId: "match_1",
      partnerId: "partner_betevo",
      partnerName: "BetEvo",
      oddsTeamA: 1.65,
      oddsTeamB: 2.35,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
    {
      matchId: "match_1",
      partnerId: "partner_oddsarena",
      partnerName: "OddsArena",
      oddsTeamA: 1.7,
      oddsTeamB: 2.25,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
    {
      matchId: "match_1",
      partnerId: "partner_primebet",
      partnerName: "PrimeBet",
      oddsTeamA: 1.62,
      oddsTeamB: 2.4,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
  ],
  match_2: [
    {
      matchId: "match_2",
      partnerId: "partner_betevo",
      partnerName: "BetEvo",
      oddsTeamA: 1.95,
      oddsTeamB: 1.95,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
    {
      matchId: "match_2",
      partnerId: "partner_africaodds",
      partnerName: "AfricaOdds",
      oddsTeamA: 1.9,
      oddsTeamB: 2.0,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
  ],
  match_4: [
    {
      matchId: "match_4",
      partnerId: "partner_oddsarena",
      partnerName: "OddsArena",
      oddsTeamA: 2.1,
      oddsTeamB: 1.78,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
    {
      matchId: "match_4",
      partnerId: "partner_championsbet",
      partnerName: "ChampionsBet",
      oddsTeamA: 2.05,
      oddsTeamB: 1.82,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
  ],
};

export async function listMatchOdds(matchId: string): Promise<MatchOdds[]> {
  await sleep(50);
  if (oddsMap[matchId]) return oddsMap[matchId]!;
  // Fallback synthetic odds, deterministic by match id length
  const seed = matchId.length;
  return [
    {
      matchId,
      partnerId: "partner_betevo",
      partnerName: "BetEvo",
      oddsTeamA: 1.6 + (seed % 4) * 0.1,
      oddsTeamB: 2.3 - (seed % 3) * 0.1,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
    {
      matchId,
      partnerId: "partner_primebet",
      partnerName: "PrimeBet",
      oddsTeamA: 1.7 + (seed % 3) * 0.1,
      oddsTeamB: 2.15 - (seed % 4) * 0.05,
      marketLabel: "Match winner",
      updatedAt: new Date().toISOString(),
    },
  ];
}

export async function listOddsForStream(streamId: string): Promise<{
  matchId: string;
  matchLabel: string;
  odds: MatchOdds[];
}> {
  await sleep(60);
  // Map stream → match (lookup based on hardcoded mock matches in events.ts)
  const streamToMatch: Record<string, { matchId: string; label: string }> = {
    stream_lagos_final: { matchId: "match_1", label: "Team Alpha vs Nova Esports" },
    stream_casablanca: { matchId: "match_4", label: "Zenith vs Hydra" },
    stream_codm_scrim: { matchId: "match_2", label: "Vortex vs Eclipse" },
  };
  const meta = streamToMatch[streamId];
  if (!meta) {
    return {
      matchId: "match_unknown",
      matchLabel: "—",
      odds: await listMatchOdds("match_1"),
    };
  }
  return {
    matchId: meta.matchId,
    matchLabel: meta.label,
    odds: await listMatchOdds(meta.matchId),
  };
}
