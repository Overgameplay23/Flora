import { DEFAULT_LOOK, PRESETS, normalizeLook, presetsFor, shade, withSpecies } from "../domain/petLook";

describe("normalizeLook", () => {
  it("returns the species default for junk and keeps valid choices", () => {
    expect(normalizeLook(null)).toEqual(DEFAULT_LOOK.dog);
    expect(normalizeLook({ species: "cat" })).toEqual(DEFAULT_LOOK.cat);
    const custom = normalizeLook({ species: "dog", coat: "#ABCDEF", ears: "pointy", marking: "socks", eye: "#4a86c8" });
    expect(custom.coat).toBe("#abcdef");
    expect(custom.ears).toBe("pointy");
    expect(custom.marking).toBe("socks");
    expect(custom.eye).toBe("#4a86c8");
  });

  it("rejects options that do not exist for the species", () => {
    const cat = normalizeLook({ species: "cat", ears: "floppy", marking: "tabby", tail: "curl" });
    expect(cat.ears).toBe("pointy");
    expect(cat.marking).toBe("tabby");
    expect(cat.tail).toBe("curl");
    expect(normalizeLook({ species: "dog", coat: "red", nose: "#12" }).coat).toBe(DEFAULT_LOOK.dog.coat);
  });

  it("switches species while keeping colours", () => {
    const shiba = PRESETS.find((p) => p.id === "shiba")!.look;
    const asCat = withSpecies(shiba, "cat");
    expect(asCat.species).toBe("cat");
    expect(asCat.coat).toBe(shiba.coat);
    expect(asCat.ears).toBe("pointy");
    expect(asCat.marking).toBe("none");
    expect(withSpecies(shiba, "dog")).toBe(shiba);
  });

  it("has presets for both species and they all normalise to themselves", () => {
    expect(presetsFor("dog").length).toBeGreaterThanOrEqual(4);
    expect(presetsFor("cat").length).toBeGreaterThanOrEqual(4);
    for (const preset of PRESETS) expect(normalizeLook(preset.look)).toEqual(preset.look);
  });
});

describe("shade", () => {
  it("darkens and lightens within bounds", () => {
    expect(shade("#808080", -0.5)).toBe("#404040");
    expect(shade("#808080", 0.5)).toBe("#c0c0c0");
    expect(shade("#ffffff", 0.5)).toBe("#ffffff");
    expect(shade("nope", 0.1)).toBe("#949494");
  });
});
