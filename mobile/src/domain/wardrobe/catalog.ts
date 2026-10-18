// The Wardrobe catalog. This file is the source of truth for ids, names and prices; the database seed
// (local-backend/sql/wardrobe_v1.sql) must match it, and src/__tests__/wardrobeSql.test.ts checks that.
//
// Pricing (Sprouts are ~2 per care task, ~8-10 a day): commons 20-40 (a few days), uncommons 55-90 (about a
// week or two), rares 110-160 (a few weeks). Three starters are free so the shop is a gift on day one.
// Seasonal collections (Autumn) are on sale in their season and come back every year; owned items never expire.

import type { OutfitSlot, WardrobeCategory, WardrobeItem } from "./types";

const BOTH: Array<"dog" | "cat"> = ["dog", "cat"];

export const WARDROBE_ITEMS: WardrobeItem[] = [
  // ---- free starters ---------------------------------------------------------------------------------
  { id: "head.daisy_crown", name: "Daisy crown", description: "Picked on the first walk together.", slot: "head", category: "hats", priceSprouts: 0, rarity: "common", species: BOTH, collection: "Everyday", tone: "body", art: "daisy_crown" },
  { id: "neck.bandana_red", name: "Red bandana", description: "A classic for every adventure.", slot: "neck", category: "neckwear", priceSprouts: 0, rarity: "common", species: BOTH, collection: "Everyday", tone: "energy", art: "bandana_red" },
  { id: "face.round_glasses", name: "Round reading glasses", description: "For long, thoughtful naps.", slot: "face", category: "glasses", priceSprouts: 0, rarity: "common", species: BOTH, collection: "Everyday", tone: "focus", art: "round_glasses" },

  // ---- everyday ----------------------------------------------------------------------------------------
  { id: "neck.collar_sky", name: "Sky collar with tag", description: "A little tag that jingles hello.", slot: "neck", category: "neckwear", priceSprouts: 20, rarity: "common", species: BOTH, collection: "Everyday", tone: "nourish", art: "collar_sky" },
  { id: "head.bow_blush", name: "Blush bow", description: "Soft, sweet and a little bit fancy.", slot: "head", category: "hats", priceSprouts: 25, rarity: "common", species: BOTH, collection: "Everyday", tone: "connection", art: "bow_blush" },
  { id: "neck.bell_collar", name: "Little bell collar", description: "You'll always hear them coming.", slot: "neck", category: "neckwear", priceSprouts: 25, rarity: "common", species: BOTH, collection: "Everyday", tone: "play", art: "bell_collar" },
  { id: "head.party_hat", name: "Party hat", description: "Every small win deserves one.", slot: "head", category: "hats", priceSprouts: 30, rarity: "common", species: BOTH, collection: "Everyday", tone: "play", art: "party_hat" },
  { id: "neck.bandana_gingham", name: "Picnic gingham bandana", description: "Smells faintly of sandwiches.", slot: "neck", category: "neckwear", priceSprouts: 30, rarity: "common", species: BOTH, collection: "Everyday", tone: "body", art: "bandana_gingham" },
  { id: "head.beret_rose", name: "Rose beret", description: "For an artist at heart.", slot: "head", category: "hats", priceSprouts: 35, rarity: "common", species: BOTH, collection: "Everyday", tone: "connection", art: "beret_rose" },
  { id: "neck.bowtie_plum", name: "Plum bow tie", description: "Dressed for a very important nap.", slot: "neck", category: "neckwear", priceSprouts: 35, rarity: "common", species: BOTH, collection: "Everyday", tone: "calm", art: "bowtie_plum" },
  { id: "head.beanie_sage", name: "Sage knit beanie", description: "Warm ears, calm mind.", slot: "head", category: "hats", priceSprouts: 40, rarity: "common", species: BOTH, collection: "Everyday", tone: "focus", art: "beanie_sage" },
  { id: "face.heart_sunnies", name: "Heart sunglasses", description: "Everything looks a little lovelier.", slot: "face", category: "glasses", priceSprouts: 55, rarity: "uncommon", species: BOTH, collection: "Everyday", tone: "connection", art: "heart_sunnies" },
  { id: "head.sun_hat", name: "Straw sun hat", description: "For lazy afternoons in the garden.", slot: "head", category: "hats", priceSprouts: 60, rarity: "uncommon", species: BOTH, collection: "Garden Party", tone: "play", art: "sun_hat" },
  { id: "neck.flower_lei", name: "Flower lei", description: "A whole meadow, worn proudly.", slot: "neck", category: "neckwear", priceSprouts: 70, rarity: "uncommon", species: BOTH, collection: "Garden Party", tone: "connection", art: "flower_lei" },
  { id: "face.star_glasses", name: "Starry glasses", description: "For seeing the bright side.", slot: "face", category: "glasses", priceSprouts: 75, rarity: "uncommon", species: BOTH, collection: "Everyday", tone: "calm", art: "star_glasses" },
  { id: "head.frog_hat", name: "Frog bucket hat", description: "Ribbit. Very serious business.", slot: "head", category: "hats", priceSprouts: 80, rarity: "uncommon", species: BOTH, collection: "Garden Party", tone: "body", art: "frog_hat" },
  { id: "neck.ruffle_collar", name: "Ruffle collar", description: "A touch of storybook drama.", slot: "neck", category: "neckwear", priceSprouts: 90, rarity: "uncommon", species: BOTH, collection: "Everyday", tone: "rest", art: "ruffle_collar" },
  { id: "neck.pearl_necklace", name: "Pearl necklace", description: "Quietly, impossibly elegant.", slot: "neck", category: "neckwear", priceSprouts: 110, rarity: "rare", species: BOTH, collection: "Everyday", tone: "rest", art: "pearl_necklace" },
  { id: "head.flower_halo", name: "Wildflower halo", description: "Grown from a hundred small kindnesses.", slot: "head", category: "hats", priceSprouts: 120, rarity: "rare", species: BOTH, collection: "Garden Party", tone: "cycle", art: "flower_halo" },
  { id: "head.gold_crown", name: "Tiny gold crown", description: "Royalty of the couch.", slot: "head", category: "hats", priceSprouts: 160, rarity: "rare", species: BOTH, collection: "Everyday", tone: "play", art: "gold_crown" },

  // ---- Autumn (seasonal: on sale in autumn, back every year) --------------------------------------------
  { id: "neck.knit_scarf", name: "Chunky knit scarf", description: "Sweater weather, officially.", slot: "neck", category: "neckwear", priceSprouts: 60, rarity: "uncommon", species: BOTH, collection: "Autumn", tone: "energy", art: "knit_scarf" },
  { id: "head.pumpkin_beanie", name: "Pumpkin beanie", description: "The cosiest gourd in the patch.", slot: "head", category: "hats", priceSprouts: 70, rarity: "uncommon", species: BOTH, collection: "Autumn", tone: "energy", art: "pumpkin_beanie" },
  { id: "head.witch_hat", name: "Little witch hat", description: "Spells for naps and snacks only.", slot: "head", category: "hats", priceSprouts: 90, rarity: "uncommon", species: BOTH, collection: "Autumn", tone: "calm", art: "witch_hat" },
  { id: "neck.leaf_garland", name: "Autumn leaf garland", description: "Every leaf, a little crunch of joy.", slot: "neck", category: "neckwear", priceSprouts: 45, rarity: "common", species: BOTH, collection: "Autumn", tone: "energy", art: "leaf_garland" },
];

export const WARDROBE_CATEGORIES: Array<{ id: WardrobeCategory | "all"; label: string; icon: string }> = [
  { id: "all", label: "All", icon: "sparkles-outline" },
  { id: "hats", label: "Hats", icon: "ribbon-outline" },
  { id: "glasses", label: "Glasses", icon: "glasses-outline" },
  { id: "neckwear", label: "Neckwear", icon: "heart-circle-outline" },
];

export const SLOT_LABELS: Record<OutfitSlot, string> = { head: "Head", face: "Face", neck: "Neck" };

const BY_ID = new Map(WARDROBE_ITEMS.map((item) => [item.id, item]));

export function wardrobeItem(id: string | null | undefined): WardrobeItem | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Items for one species, cheapest first within the catalog's order of collections. */
export function itemsFor(species: "dog" | "cat" | null | undefined): WardrobeItem[] {
  const s = species === "cat" ? "cat" : "dog";
  return WARDROBE_ITEMS.filter((item) => item.species.includes(s));
}

/** Autumn items are on sale from September to November (local time); out of season they show as "returns in autumn". */
export function inSeason(item: WardrobeItem, month: number = new Date().getMonth()): boolean {
  if (item.collection !== "Autumn") return true;
  return month >= 8 && month <= 10;
}
