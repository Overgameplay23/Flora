import { SHELTER, adoptedLook, companionById, isAdopted, shelterFor } from "../domain/shelter";
import { normalizeLook } from "../domain/petLook";

describe("shelter", () => {
  it("offers a few of each species with unique ids and names", () => {
    expect(shelterFor("dog").length).toBeGreaterThanOrEqual(3);
    expect(shelterFor("cat").length).toBeGreaterThanOrEqual(3);
    expect(new Set(SHELTER.map((c) => c.id)).size).toBe(SHELTER.length);
    expect(new Set(SHELTER.map((c) => c.name)).size).toBe(SHELTER.length);
    for (const c of SHELTER) {
      expect(c.look.species).toBe(c.species);
      expect(normalizeLook(c.look)).toEqual(expect.objectContaining({ species: c.species, coat: c.look.coat }));
      expect(c.bio.length).toBeLessThan(80);
    }
  });

  it("marks an adopted look and finds companions by id", () => {
    const olive = companionById("olive");
    expect(olive?.species).toBe("cat");
    expect(companionById("nobody")).toBeNull();
    const look = adoptedLook(olive!);
    expect(isAdopted(look)).toBe(true);
    expect(isAdopted(normalizeLook(look))).toBe(true);
    expect(isAdopted(normalizeLook({ ...look, origin: "own" }))).toBe(false);
    expect(isAdopted(null)).toBe(false);
  });
});
