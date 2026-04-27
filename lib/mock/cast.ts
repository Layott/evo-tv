import { sleep } from "./_util";

export type CastKind = "chromecast" | "airplay" | "roku" | "firetv";
export type CastSignal = "strong" | "ok" | "weak";

export interface CastDevice {
  id: string;
  name: string;
  kind: CastKind;
  signal: CastSignal;
  /** Free-text room/location label shown next to the device. */
  room: string;
}

const DEVICES: CastDevice[] = [
  {
    id: "cast_living",
    name: "Living Room TV",
    kind: "chromecast",
    signal: "strong",
    room: "Living Room",
  },
  {
    id: "cast_bedroom",
    name: "Bedroom Chromecast",
    kind: "chromecast",
    signal: "ok",
    room: "Bedroom",
  },
  {
    id: "cast_kitchen",
    name: "Kitchen HomePod",
    kind: "airplay",
    signal: "ok",
    room: "Kitchen",
  },
  {
    id: "cast_office",
    name: "Office AppleTV",
    kind: "airplay",
    signal: "strong",
    room: "Home Office",
  },
  {
    id: "cast_iphone",
    name: "Mom's iPhone",
    kind: "airplay",
    signal: "weak",
    room: "Hallway",
  },
  {
    id: "cast_firetv",
    name: "Lounge Fire TV Stick",
    kind: "firetv",
    signal: "ok",
    room: "Lounge",
  },
  {
    id: "cast_roku",
    name: "Bedroom Roku Express",
    kind: "roku",
    signal: "weak",
    room: "Guest Room",
  },
];

export async function discoverCastDevices(): Promise<CastDevice[]> {
  // Simulate discovery latency.
  await sleep(700 + Math.random() * 400);
  // Shuffle a little so it feels like real discovery.
  return [...DEVICES].sort(() => Math.random() - 0.5);
}

export function castKindLabel(kind: CastKind): string {
  switch (kind) {
    case "chromecast":
      return "Chromecast";
    case "airplay":
      return "AirPlay";
    case "roku":
      return "Roku";
    case "firetv":
      return "Fire TV";
  }
}
