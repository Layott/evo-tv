// Existing core mocks
export * from "./_util";
export * from "./games";
export * from "./teams";
export * from "./players";
export * from "./events";
export * from "./streams";
export * from "./vods";
export * from "./users";
export * from "./subs";
export * from "./products";
export * from "./orders";
export * from "./ads";
export * from "./notifications";
export * from "./chat";
export * from "./polls";
export * from "./follows";
export * from "./flags";
export * from "./search";
export * from "./admin";

// New feature-build mocks (2026-04-27 expansion).
// Note: `predictions` and `tips` are NOT re-exported via the barrel because they
// declare `getCoinBalance` (and predictions declares `getTeamById`) which collide
// with sibling modules. Consumers import them directly:
//   import { getCoinBalance as getPredictionsBalance } from "@/lib/mock/predictions";
//   import { getCoinBalance as getWalletBalance, sendTip } from "@/lib/mock/tips";
// `lite-mode` is also not re-exported because it ships a `"use client"` hook that
// would force the entire barrel client-only.
export * from "./watch-parties";
export * from "./co-streams";
export * from "./pickem";
export * from "./fantasy";
export * from "./rewards";
export * from "./creators";
export * from "./payment-methods";
export * from "./ussd";
export * from "./downloads";
export * from "./apps";
export * from "./cast";
export * from "./embed";
export * from "./bots";
export * from "./sso";
export * from "./captions";
export * from "./ai-commentary";
export * from "./commentary-tracks";
export * from "./forensic";
export * from "./api-keys";
export * from "./calendar";
export * from "./auto-clips";
export * from "./partners";
