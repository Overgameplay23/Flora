import { cleanOutfit, fittingCta, sameOutfit, takeOff, tasksToGo, toggleItem } from "../domain/wardrobe/fittingRoom";
import { WARDROBE_ITEMS, inSeason, itemsFor, wardrobeItem } from "../domain/wardrobe/catalog";

const beret = wardrobeItem("head.beret_rose")!;
const crown = wardrobeItem("head.daisy_crown")!;
const bandana = wardrobeItem("neck.bandana_red")!;
const witch = wardrobeItem("head.witch_hat")!;
const pearls = wardrobeItem("neck.pearl_necklace")!;

describe("catalog", () => {
  it("has unique ids that encode their slot, and sane prices", () => {
    const ids = WARDROBE_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of WARDROBE_ITEMS) {
      expect(item.id.startsWith(`${item.slot}.`)).toBe(true);
      expect(item.priceSprouts).toBeGreaterThanOrEqual(0);
      expect(item.priceSprouts).toBeLessThanOrEqual(200);
      expect(item.premium).not.toBe(true);
    }
  });

  it("gives three free starters, one per slot", () => {
    const free = WARDROBE_ITEMS.filter((item) => item.priceSprouts === 0);
    expect(free.map((item) => item.slot).sort()).toEqual(["face", "head", "neck"]);
  });

  it("offers every item to dogs and cats alike", () => {
    expect(itemsFor("dog").length).toBe(WARDROBE_ITEMS.length);
    expect(itemsFor("cat").length).toBe(WARDROBE_ITEMS.length);
  });

  it("keeps autumn items to their season", () => {
    expect(inSeason(witch, 9)).toBe(true); // October
    expect(inSeason(witch, 3)).toBe(false); // April
    expect(inSeason(beret, 3)).toBe(true);
  });
});

describe("trying on", () => {
  it("puts one item per slot on and takes it off again", () => {
    let outfit = toggleItem({}, beret);
    expect(outfit).toEqual({ head: beret.id });
    outfit = toggleItem(outfit, crown);
    expect(outfit).toEqual({ head: crown.id });
    outfit = toggleItem(outfit, bandana);
    expect(outfit).toEqual({ head: crown.id, neck: bandana.id });
    expect(toggleItem(outfit, crown)).toEqual({ neck: bandana.id });
    expect(takeOff(outfit, "neck")).toEqual({ head: crown.id });
  });

  it("drops unknown or misplaced ids from a stored outfit", () => {
    expect(cleanOutfit({ head: "head.gone", neck: bandana.id })).toEqual({ neck: bandana.id });
    expect(cleanOutfit({ face: beret.id })).toEqual({});
    expect(cleanOutfit(null)).toEqual({});
  });

  it("compares outfits by slot", () => {
    expect(sameOutfit({ head: crown.id }, { head: crown.id })).toBe(true);
    expect(sameOutfit({}, { head: crown.id })).toBe(false);
  });
});

describe("the main button", () => {
  const base = { worn: {}, owned: [] as string[], balance: 50, serverReady: true, month: 9 };

  it("says wearing when nothing changed, wear when an owned look changed", () => {
    expect(fittingCta({ ...base, trying: {} }).kind).toBe("wearing");
    expect(fittingCta({ ...base, owned: [crown.id], trying: { head: crown.id } }).kind).toBe("wear");
  });

  it("claims free starters and buys what the balance covers", () => {
    expect(fittingCta({ ...base, trying: { head: crown.id } })).toMatchObject({ kind: "claim" });
    expect(fittingCta({ ...base, trying: { head: beret.id } })).toMatchObject({ kind: "buy", price: 35 });
  });

  it("says kindly how far off an item is", () => {
    const cta = fittingCta({ ...base, trying: { neck: pearls.id } });
    expect(cta).toMatchObject({ kind: "short", missing: 60 });
    expect(tasksToGo(60)).toBe(30);
    expect(tasksToGo(1)).toBe(1);
  });

  it("focuses the item tried last", () => {
    const cta = fittingCta({ ...base, trying: { head: beret.id, neck: pearls.id }, lastTriedId: pearls.id });
    expect(cta).toMatchObject({ kind: "short", item: { id: pearls.id } });
  });

  it("holds seasonal items out of season and everything when the backend has no Wardrobe", () => {
    expect(fittingCta({ ...base, month: 3, trying: { head: witch.id } }).kind).toBe("season");
    expect(fittingCta({ ...base, serverReady: false, trying: { head: beret.id } }).kind).toBe("notReady");
  });

  it("treats an unknown balance as enough to offer the item (the server has the final say)", () => {
    expect(fittingCta({ ...base, balance: null, trying: { head: beret.id } }).kind).toBe("buy");
  });
});
