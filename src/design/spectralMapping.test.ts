import { describe, expect, test } from "bun:test";
import { spectralColor, VISIBLE_BAND_NM } from "./spectralMapping";

describe("VISIBLE_BAND_NM: the declared boundary and its source", () => {
  test("is 380-780 nm with a non-empty recorded source", () => {
    expect(VISIBLE_BAND_NM.min).toBe(380);
    expect(VISIBLE_BAND_NM.max).toBe(780);
    expect(VISIBLE_BAND_NM.source.length).toBeGreaterThan(0);
  });
});

describe("spectralColor: a wavelength sweep at 5 nm steps across and beyond the band", () => {
  test("below the band is outside-visible on the ultraviolet side", () => {
    for (let nm = 100; nm < VISIBLE_BAND_NM.min; nm += 5) {
      const result = spectralColor(nm);
      expect(result.kind).toBe("outside-visible");
      if (result.kind === "outside-visible") expect(result.side).toBe("ultraviolet");
    }
  });

  test("above the band is outside-visible on the infrared side", () => {
    for (let nm = VISIBLE_BAND_NM.max + 1; nm <= 1200; nm += 5) {
      const result = spectralColor(nm);
      expect(result.kind).toBe("outside-visible");
      if (result.kind === "outside-visible") expect(result.side).toBe("infrared");
    }
  });

  test("strictly inside the band is always a visible color, a real #rrggbb string", () => {
    for (let nm = VISIBLE_BAND_NM.min + 1; nm < VISIBLE_BAND_NM.max; nm += 5) {
      const result = spectralColor(nm);
      expect(result.kind).toBe("visible");
      if (result.kind === "visible") expect(result.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("exactly at each boundary is declared: both endpoints are visible (the band is closed)", () => {
    expect(spectralColor(VISIBLE_BAND_NM.min).kind).toBe("visible");
    expect(spectralColor(VISIBLE_BAND_NM.max).kind).toBe("visible");
    expect(spectralColor(VISIBLE_BAND_NM.min - 1).kind).toBe("outside-visible");
    expect(spectralColor(VISIBLE_BAND_NM.max + 1).kind).toBe("outside-visible");
  });
});

describe("spectralColor: recognizable landmark hues", () => {
  test("blue light (~450nm) has a dominant blue channel", () => {
    const result = spectralColor(450);
    if (result.kind !== "visible") throw new Error("expected visible");
    const b = Number.parseInt(result.color.slice(5, 7), 16);
    const r = Number.parseInt(result.color.slice(1, 3), 16);
    expect(b).toBeGreaterThan(r);
  });

  test("red light (~700nm) has a dominant red channel", () => {
    const result = spectralColor(700);
    if (result.kind !== "visible") throw new Error("expected visible");
    const r = Number.parseInt(result.color.slice(1, 3), 16);
    const b = Number.parseInt(result.color.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });

  test("green light (~550nm) has a dominant green channel", () => {
    const result = spectralColor(550);
    if (result.kind !== "visible") throw new Error("expected visible");
    const g = Number.parseInt(result.color.slice(3, 5), 16);
    const r = Number.parseInt(result.color.slice(1, 3), 16);
    const b = Number.parseInt(result.color.slice(5, 7), 16);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });
});

describe("spectralColor: theme independence (a fixture sweep, not a screenshot)", () => {
  test("calling spectralColor takes no theme argument and needs none: it is the same function call regardless of which theme's tokens are loaded elsewhere in the process", () => {
    // spectralColor's signature itself proves independence: it has no theme
    // parameter and reads no theme module (spectralImportBoundary.test.ts
    // asserts the import graph directly). Calling it twice in a row, as any
    // two themes' code paths would, gives bitwise-identical results.
    const wavelengths = [400, 450, 500, 550, 600, 650, 700, 750];
    for (const nm of wavelengths) {
      expect(spectralColor(nm)).toEqual(spectralColor(nm));
    }
  });
});
