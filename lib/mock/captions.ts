import { sleep } from "./_util";

export type CaptionLang = "en" | "fr" | "pt" | "ha" | "yo" | "ig" | "sw";

export interface CaptionTrack {
  lang: CaptionLang | "auto";
  label: string;
  isAuto: boolean;
  fileUrl?: string;
  source: "human" | "auto";
}

export interface CaptionLine {
  startSec: number;
  endSec: number;
  text: string;
}

const ALL_LANGS: { lang: CaptionLang; label: string; native: string }[] = [
  { lang: "en", label: "English", native: "English" },
  { lang: "fr", label: "French", native: "Français" },
  { lang: "pt", label: "Portuguese", native: "Português" },
  { lang: "ha", label: "Hausa", native: "Hausa" },
  { lang: "yo", label: "Yoruba", native: "Yorùbá" },
  { lang: "ig", label: "Igbo", native: "Igbo" },
  { lang: "sw", label: "Swahili", native: "Kiswahili" },
];

const LINES_BY_LANG: Record<CaptionLang, string[]> = {
  en: [
    "Nice rotation by Team Alpha at the north ridge.",
    "Shots fired in zone B — Nova has the high ground.",
    "Massive 1v3 clutch incoming — pressure on the IGL.",
    "Smoke deployed, Vortex pushing through the choke.",
    "That was a clean ace for Apex Predators.",
    "Final circle closing on the south plateau.",
    "Team Alpha rotates west, picking up wallbangs as they go.",
    "Eclipse caught off-guard at the bridge — they're in trouble.",
    "Beautiful tap-fire from Viper, headshot confirmed.",
    "Nova drops a smoke and bails out of the fight.",
    "Casters going wild — that was unreal map awareness.",
    "Vortex baiting the rotation, perfect read.",
    "Two members down for Eclipse, they need to regroup.",
    "Final exchange of the round, both teams trading.",
    "Alpha takes the round, momentum shifting their way.",
  ],
  fr: [
    "Belle rotation de Team Alpha sur la crête nord.",
    "Tirs en zone B — Nova prend la hauteur.",
    "Énorme 1v3 en cours — pression sur l'IGL.",
    "Fumigène déployé, Vortex pousse dans le choke.",
    "Quel ace propre pour Apex Predators.",
    "Le cercle se ferme sur le plateau sud.",
    "Team Alpha tourne à l'ouest, wallbangs en chemin.",
    "Eclipse surpris au pont — ils sont en difficulté.",
    "Beau tir précis de Viper, headshot confirmé.",
    "Nova lâche une fumée et sort du combat.",
    "Les commentateurs s'emballent — quelle conscience de la carte.",
    "Vortex appâte la rotation, lecture parfaite.",
    "Deux membres à terre pour Eclipse, regroupement nécessaire.",
    "Dernier échange du round, les deux équipes échangent.",
    "Alpha remporte le round, momentum de leur côté.",
  ],
  pt: [
    "Boa rotação do Team Alpha na crista norte.",
    "Tiros na zona B — Nova tem o terreno alto.",
    "Enorme clutch 1v3 a caminho — pressão no IGL.",
    "Fumaça lançada, Vortex avança pelo choke.",
    "Que ace limpo dos Apex Predators.",
    "Círculo final fechando no platô sul.",
    "Team Alpha rota a oeste, pegando wallbangs no caminho.",
    "Eclipse pego de surpresa na ponte — em apuros.",
    "Tap-fire belíssimo do Viper, headshot confirmado.",
    "Nova solta uma fumaça e sai da luta.",
    "Casters enlouquecendo — consciência de mapa irreal.",
    "Vortex atraindo a rotação, leitura perfeita.",
    "Dois membros caídos para a Eclipse, precisam reagrupar.",
    "Última troca do round, ambos times trocando.",
    "Alpha vence o round, momento a favor deles.",
  ],
  ha: [
    "Kyakkyawan juyawa daga Team Alpha a arewa.",
    "An harba a zone B — Nova na sama.",
    "Babban clutch 1v3 yana zuwa — matsa lamba akan IGL.",
    "An shanya hayaki, Vortex na tura ta cikin choke.",
    "Wannan ace ne mai tsabta ga Apex Predators.",
    "Da'irar karshe na rufewa a kudu.",
    "Team Alpha juya yamma, suna daukar wallbangs.",
    "Eclipse cikin wahala a kan gada.",
    "Mai kyau tap-fire daga Viper, headshot.",
    "Nova ya jefa hayaki ya gudu daga fada.",
    "Masu sharhi sun yi farin ciki — mai ban mamaki.",
    "Vortex na jarrabawa, kyakkyawar karatu.",
    "Mambobi biyu sun fadi ga Eclipse.",
    "Karshen musayar zagaye, kungiyoyin biyu suna musayya.",
    "Alpha ya dauki zagaye, lokaci ya canza musu.",
  ],
  yo: [
    "Yiyi to dara lati ọdọ Team Alpha ni ariwa.",
    "Awọn ibọn ti yibọ ni zone B — Nova ni oke.",
    "Clutch 1v3 nla ti nbọ — titẹ lori IGL.",
    "Ti fi efin sile, Vortex ntọ ọna choke.",
    "Iyẹn jẹ ace mimọ fun Apex Predators.",
    "Ẹgbẹ ipari ti npade lori plateau guusu.",
    "Team Alpha yi pada si iwọ-oorun, gbe wallbangs.",
    "Eclipse mu lairotele lori afara — won wa ninu wahala.",
    "Tap-fire to dara lati ọdọ Viper, headshot fọwọsi.",
    "Nova ju efin silẹ o si lo kuro ninu ija.",
    "Awọn caster nyọ — imo agbegbe ti ko ni gbagbọ.",
    "Vortex n bait yiyi, kika pipe.",
    "Awọn ọmọ ẹgbẹ meji ti silẹ fun Eclipse.",
    "Paṣipaarọ ipari yiyi, awọn ẹgbẹ mejeeji.",
    "Alpha gba yiyi, akoko n yipada si wọn.",
  ],
  ig: [
    "Ntugharị mara mma site na Team Alpha n'ugwu.",
    "Egbe na-agba na mpaghara B — Nova nwere elu.",
    "Nnukwu clutch 1v3 na-abịa — nrụgide na IGL.",
    "Anwụrụ ọkụ etinyere, Vortex na-akwagharị.",
    "Nke ahụ bụ ace dị ọcha maka Apex Predators.",
    "Okirikiri ikpeazụ na-emechi na ndịda.",
    "Team Alpha tụgharịa n'ọdịda anyanwụ.",
    "Eclipse na-enwe nsogbu na akwa mmiri.",
    "Tap-fire mara mma site na Viper, headshot.",
    "Nova tụpụrụ anwụrụ ọkụ wee pụọ na ọgụ.",
    "Ndị na-ekwu okwu na-enwe obi ụtọ.",
    "Vortex na-edu ntugharị, ọgụgụ zuru oke.",
    "Mmadụ abụọ adala maka Eclipse.",
    "Mgbanwe ikpeazụ nke gburugburu, otu abụọ.",
    "Alpha weghaara gburugburu, oge na-agbanwe.",
  ],
  sw: [
    "Mzunguko mzuri wa Team Alpha kaskazini.",
    "Risasi katika eneo B — Nova wana eneo la juu.",
    "Clutch kubwa ya 1v3 inakuja — shinikizo kwa IGL.",
    "Moshi umetolewa, Vortex anasukuma kupitia choke.",
    "Hiyo ilikuwa ace safi kwa Apex Predators.",
    "Mduara wa mwisho unafunga nyanda za juu kusini.",
    "Team Alpha inazunguka magharibi, ikipiga wallbangs.",
    "Eclipse imekamatwa kwa mshangao kwenye daraja.",
    "Tap-fire nzuri kutoka Viper, headshot imethibitishwa.",
    "Nova anatupa moshi na kutoka katika mapigano.",
    "Wachambuzi wanafurahia — uelewa wa ramani usio wa kawaida.",
    "Vortex anabaitisha mzunguko, usomaji kamili.",
    "Wanachama wawili wameanguka kwa Eclipse.",
    "Mabadilishano ya mwisho ya raundi.",
    "Alpha inashinda raundi, kasi ikienda upande wao.",
  ],
};

export function listCaptionLanguages() {
  return ALL_LANGS;
}

export async function listCaptionTracks(streamOrVodId: string): Promise<CaptionTrack[]> {
  await sleep(80);
  // Seed: 3 human-authored (en, fr, pt) + 4 auto for the rest. Stream-id-keyed for variety.
  const seedHash = streamOrVodId
    .split("")
    .reduce((acc, c) => (acc + c.charCodeAt(0)) % 7, 0);
  return ALL_LANGS.map((l, i) => {
    const isHuman = i < 3 && seedHash % 2 === 0 ? true : i < 2;
    return {
      lang: l.lang,
      label: l.label + (isHuman ? "" : " (auto)"),
      isAuto: !isHuman,
      source: isHuman ? "human" : "auto",
      fileUrl: `/captions/${streamOrVodId}/${l.lang}.vtt`,
    } satisfies CaptionTrack;
  });
}

export async function getCaptionLines(
  streamOrVodId: string,
  lang: CaptionLang,
): Promise<CaptionLine[]> {
  await sleep(50);
  const phrases = LINES_BY_LANG[lang];
  // Build a 60-line cycle every ~3s so it feels alive.
  return phrases.map((text, i) => ({
    startSec: i * 3,
    endSec: i * 3 + 3,
    text,
  }));
}

/** Synchronous helper used by the player overlay so we don't have to await each cycle. */
export function getCaptionPhrasesSync(lang: CaptionLang): string[] {
  return LINES_BY_LANG[lang];
}
