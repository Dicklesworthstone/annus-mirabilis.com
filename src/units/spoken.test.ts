import { describe, expect, it } from "bun:test";
import { spokenQuantity, spokenUnit } from "./spoken.ts";

describe("Spoken Quantity & Unit Formatting (am-ver-precision-display-5e5)", () => {
  it("pluralizes spoken units appropriately", () => {
    expect(spokenUnit("m", 1)).toBe("metre");
    expect(spokenUnit("m", 2)).toBe("metres");
    expect(spokenUnit("μm", 1)).toBe("micrometre");
    expect(spokenUnit("μm", 0.79)).toBe("micrometres");
    expect(spokenUnit("s", 1)).toBe("second");
    expect(spokenUnit("s", 60)).toBe("seconds");
    expect(spokenUnit("Pa·s", 1)).toBe("pascal-second");
    expect(spokenUnit("Pa·s", 2)).toBe("pascal-seconds");
  });

  it("formats spoken quantities into natural language", () => {
    expect(spokenQuantity(0.79, "μm")).toBe("0.79 micrometres");
    expect(spokenQuantity(1, "s")).toBe("1 second");
    expect(spokenQuantity(60, "s")).toBe("60 seconds");
    expect(spokenQuantity(1.35e-3, "Pa·s")).toBe("0.00135 pascal-seconds");
  });
});
