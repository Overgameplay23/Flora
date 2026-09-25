import { isProtectedMood } from "../domain/protectedMode";
import { derivePetState } from "../utils/petState";

describe("isProtectedMood", () => {
  it("is protected at mood 2 or below and not otherwise", () => {
    expect(isProtectedMood(1)).toBe(true);
    expect(isProtectedMood(2)).toBe(true);
    expect(isProtectedMood(3)).toBe(false);
    expect(isProtectedMood(5)).toBe(false);
  });

  it("treats a missing mood as not protected", () => {
    expect(isProtectedMood(null)).toBe(false);
    expect(isProtectedMood(undefined)).toBe(false);
  });
});

describe("derivePetState", () => {
  it("maps the 1-5 mood slider to the live pet expression", () => {
    expect(derivePetState(1)).toBe("sad");
    expect(derivePetState(2)).toBe("sad");
    expect(derivePetState(3)).toBe("calm");
    expect(derivePetState(4)).toBe("happy");
    expect(derivePetState(5)).toBe("excited");
  });

  it("rounds and clamps out-of-range values", () => {
    expect(derivePetState(0)).toBe("sad");
    expect(derivePetState(9)).toBe("excited");
    expect(derivePetState(3.4)).toBe("calm");
    expect(derivePetState(3.6)).toBe("happy");
  });
});
