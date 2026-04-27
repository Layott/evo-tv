import type { Product } from "@/lib/types";
import { sleep, byId, bySlug } from "./_util";

export const products: Product[] = [
  {
    id: "prod_alpha_jersey",
    slug: "team-alpha-jersey-2026",
    name: "Team Alpha Official Jersey 2026",
    description:
      "Official match-worn jersey replica. Breathable poly-blend, player name on back.",
    category: "jersey",
    priceNgn: 38_000,
    images: [
      "/team-alpha-jersey.jpg",
      "/team-alpha-banner.jpg",
    ],
    variants: [
      { id: "s", label: "S", priceNgn: 38_000, inventory: 12 },
      { id: "m", label: "M", priceNgn: 38_000, inventory: 28 },
      { id: "l", label: "L", priceNgn: 38_000, inventory: 18 },
      { id: "xl", label: "XL", priceNgn: 40_000, inventory: 9 },
    ],
    featured: true,
    active: true,
    teamId: "team_alpha",
    inventory: 67,
  },
  {
    id: "prod_evo_hoodie",
    slug: "evo-tv-hoodie",
    name: "EVO TV Classic Hoodie",
    description: "Heavyweight fleece hoodie. Embroidered EVO TV logo chest left.",
    category: "apparel",
    priceNgn: 28_500,
    images: ["/evo-hoodie.jpg"],
    variants: [
      { id: "s", label: "S", priceNgn: 28_500, inventory: 10 },
      { id: "m", label: "M", priceNgn: 28_500, inventory: 22 },
      { id: "l", label: "L", priceNgn: 28_500, inventory: 14 },
    ],
    featured: true,
    active: true,
    teamId: null,
    inventory: 46,
  },
  {
    id: "prod_champs_cap",
    slug: "championship-cap-2026",
    name: "EVO Championship Snapback 2026",
    description: "Limited edition championship snapback. Numbered 1 of 500.",
    category: "accessory",
    priceNgn: 12_000,
    images: ["/championship-cap.jpg"],
    variants: [],
    featured: false,
    active: true,
    teamId: null,
    inventory: 124,
  },
  {
    id: "prod_premium_gift",
    slug: "premium-sub-gift",
    name: "Premium Subscription Gift Card — 3 months",
    description: "Gift Premium to a friend. Delivered via email.",
    category: "digital",
    priceNgn: 12_500,
    images: ["/premium-sub.jpg"],
    variants: [],
    featured: true,
    active: true,
    teamId: null,
    inventory: 9999,
  },
  {
    id: "prod_gift_card",
    slug: "evo-gift-card-10k",
    name: "EVO TV Gift Card — ₦10,000",
    description: "Redeemable for subscriptions, merch, or in-stream gifts.",
    category: "digital",
    priceNgn: 10_000,
    images: ["/gift-card.jpg"],
    variants: [],
    featured: false,
    active: true,
    teamId: null,
    inventory: 9999,
  },
  {
    id: "prod_poster_set",
    slug: "afc-poster-set",
    name: "EVO Championship Poster Set",
    description: "Set of 4 matte-finish A2 posters featuring Season 4 finalists.",
    category: "collectible",
    priceNgn: 8_500,
    images: ["/poster-set.jpg"],
    variants: [],
    featured: false,
    active: true,
    teamId: null,
    inventory: 62,
  },
  {
    id: "prod_mousepad",
    slug: "evo-pro-mousepad",
    name: "EVO Pro Mousepad — XL",
    description: "900x400mm stitched cloth mousepad. Low friction weave.",
    category: "accessory",
    priceNgn: 9_500,
    images: ["/gaming-mouse.png"],
    variants: [],
    featured: false,
    active: true,
    teamId: null,
    inventory: 88,
  },
  {
    id: "prod_nova_cap",
    slug: "nova-esports-cap",
    name: "Nova Esports Dad Cap",
    description: "Unstructured cotton dad cap with embroidered NOVA tag.",
    category: "accessory",
    priceNgn: 11_000,
    images: ["/championship-cap.jpg"],
    variants: [],
    featured: false,
    active: true,
    teamId: "team_nova",
    inventory: 41,
  },
];

export async function listProducts(filter?: {
  category?: Product["category"];
  featured?: boolean;
  teamId?: string;
}): Promise<Product[]> {
  await sleep();
  let result = products.filter((p) => p.active);
  if (filter?.category) result = result.filter((p) => p.category === filter.category);
  if (typeof filter?.featured === "boolean")
    result = result.filter((p) => p.featured === filter.featured);
  if (filter?.teamId) result = result.filter((p) => p.teamId === filter.teamId);
  return result;
}

export async function getProductById(id: string): Promise<Product | null> {
  await sleep();
  return byId(products, id);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await sleep();
  return bySlug(products, slug);
}
