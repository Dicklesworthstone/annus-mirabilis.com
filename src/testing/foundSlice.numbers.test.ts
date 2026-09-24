import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { erf } from "../physics/reference/special/erf.ts";
import { roundsTo } from "../units/tolerance.ts";

/**
 * am-bm-slice-foundations-f5z9: every number the Brownian slice's lessons and bridges PRINT, redone
 * from the inputs they print and found in their own text. foundBrownianSlice.test.ts checks some of
 * the same arithmetic against literals typed into the test (its Gaussian fractions compare one
 * typed number with another); this one reads the lessons, enumerates where it can, and takes the
 * Gaussian fractions from the erf owner.
 */

const text = (slug: string) => {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(
    JSON.parse(readFileSync(join(process.cwd(), "content/foundations", `${slug}.json`), "utf8")),
  );
  return out.join(" ");
};
const printed = (value: number, shown: number, figures: number) =>
  roundsTo(value, shown, { significantFigures: figures }).ok;

describe("integration", () => {
  const t = text("integration");
  test("0.25 per μm over 4 μm; 0.25 × 1.5 = 0.375; the triangle ½ × 4 × 0.5 = 1; strips sum to 0.75", () => {
    expect(1 / 4).toBe(0.25);
    expect(0.25 * 1.5).toBe(0.375);
    expect(0.5 * 4 * 0.5).toBe(1);
    // A density rising from 0 to 0.5 per μm across 4 μm is 0.125 x; the left edges are 0, 1, 2, 3.
    const strips = [0, 1, 2, 3].map((x) => 0.125 * x * 1);
    expect(strips).toEqual([0, 0.125, 0.25, 0.375]);
    expect(strips.reduce((a, b) => a + b, 0)).toBe(0.75);
    expect(t).toContain("0.25 × 1.5 = 0.375");
    expect(t).toContain("½ × 4 × 0.5 = 1");
    expect(t).toContain("0 + 0.125 + 0.25 + 0.375 = 0.75");
  });
});

describe("taylor-expansion: (2 + Δ)² against 4 + 4Δ", () => {
  const t = text("taylor-expansion");
  test("Δ = 0.1, 0.5 and 2: the kept terms, the exact square, the error and its share", () => {
    const cases: [number, number, number, number, number, string][] = [
      [
        0.1,
        4.4,
        4.41,
        0.01,
        0.2,
        "Δ = 0.1: 4.4 instead of 4.41. The error, 0.01, is about 0.2 per cent.",
      ],
      [0.5, 6, 6.25, 0.25, 4, "Δ = 0.5: 6 instead of 6.25. The error, 0.25, is 4 per cent."],
    ];
    for (const [d, kept, exact, error, percent, line] of cases) {
      expect(printed(4 + 2 * 2 * d, kept, 2)).toBe(true);
      expect(printed((2 + d) ** 2, exact, 3)).toBe(true);
      expect(printed(exact - kept, error, 1)).toBe(true);
      expect(printed((100 * error) / exact, percent, 1)).toBe(true);
      expect(t).toContain(line);
    }
    expect(4 + 2 * 2 * 2).toBe(12);
    expect((2 + 2) ** 2).toBe(16);
    expect(4 / 16).toBe(0.25);
    expect(t).toContain("Δ = 2: 12 instead of 16. The error, 4, is a quarter of the answer.");
  });
});

describe("distributions", () => {
  const t = text("distributions");
  test("30 of 100 in a 2 μm bin: 0.3, 0.15 per μm, 150,000 per metre; 1 ÷ 4 μm and a squeeze to 2 μm", () => {
    expect(30 / 100).toBe(0.3);
    expect(printed(0.3 / 2, 0.15, 2)).toBe(true);
    expect(printed(0.3 / 2e-6, 150_000, 2)).toBe(true);
    expect(1 / 4).toBe(0.25);
    expect(1 / 2).toBe(0.5);
    expect(t).toContain("0.3 divided by 2 μm, or 0.15 per micrometre");
    expect(t).toContain("150,000 per metre");
    expect(t).toContain("1 divided by 4 μm, or 0.25 per micrometre");
    expect(t).toContain("the height doubles to 0.5 per micrometre");
  });
});

describe("mean, variance and RMS, and the squaring bridge", () => {
  const moves = [-3, -1, 1, 3];
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  test("−3, −1, +1, +3: mean 0, mean distance 2, mean square 5, RMS √5 ≈ 2.236", () => {
    expect(mean(moves)).toBe(0);
    expect(mean(moves.map(Math.abs))).toBe(2);
    expect(mean(moves.map((x) => x * x))).toBe(5);
    expect(printed(Math.sqrt(5), 2.236, 4)).toBe(true);
    expect(text("mean-variance-rms")).toContain("The RMS is the square root of 5, about 2.236");
  });

  test("doubled: squares 36, 4, 4, 36 average 20; √20 ≈ 4.472, twice the RMS", () => {
    const doubled = moves.map((x) => 2 * x);
    expect(doubled.map((x) => x * x)).toEqual([36, 4, 4, 36]);
    expect(mean(doubled.map((x) => x * x))).toBe(20);
    expect(printed(Math.sqrt(20), 4.472, 4)).toBe(true);
    expect(printed(Math.sqrt(20) / Math.sqrt(5), 2, 3)).toBe(true);
    const t = text("bridge-squaring-square-roots");
    expect(t).toContain("The squares are 36, 4, 4, 36, and their average is 20");
    expect(t).toContain("√20, about 4.472: twice as large");
  });

  test("the sum bridge: 3 + 1 + 1 + 3 = 8", () => {
    expect(3 + 1 + 1 + 3).toBe(8);
    expect(text("bridge-sum-average")).toContain("Add 3 + 1 + 1 + 3 to get 8.");
  });
});

describe("gaussian-distributions", () => {
  const t = text("gaussian-distributions");
  test("the width √(2Dt) is 1 μm for D = 0.5 μm²/s and t = 1 s", () => {
    expect(Math.sqrt(2 * 0.5 * 1)).toBe(1);
    expect(t).toContain("For D = 0.5 µm² per second and t = 1 s the width is 1 µm");
  });

  test("about 68, 95 and 99.7 per cent within one, two and three widths, from the erf owner", () => {
    const within = (k: number) => 100 * erf(k / Math.SQRT2);
    expect(printed(within(1), 68, 2)).toBe(true);
    expect(printed(within(2), 95, 2)).toBe(true);
    expect(printed(within(3), 99.7, 3)).toBe(true);
    expect(t).toContain("about 68 per cent of the particles");
    expect(t).toContain("about 95 per cent; within three, about 99.7 per cent");
  });

  test("one in three beyond one width, one in twenty beyond two", () => {
    expect(printed(1 / (1 - erf(1 / Math.SQRT2)), 3, 1)).toBe(true);
    expect(printed(1 / (1 - erf(2 / Math.SQRT2)), 20, 1)).toBe(true);
    expect(t).toContain("about one particle in three ends more than one width");
    expect(t).toContain("about one in twenty more than two widths away");
  });
});

describe("random walks and the diffusion equation", () => {
  test("sixteen walks of four steps: two end 4 m out, eight 2 m out, six at the start; mean square 4", () => {
    const ends = Array.from({ length: 16 }, (_, walk) =>
      [0, 1, 2, 3].reduce((x, step) => x + ((walk >> step) & 1 ? 1 : -1), 0),
    );
    const count = (d: number) => ends.filter((e) => Math.abs(e) === d).length;
    expect([count(4), count(2), count(0)]).toEqual([2, 8, 6]);
    expect(ends.reduce((a, e) => a + e * e, 0) / 16).toBe(4);
    expect((2 * 16 + 8 * 4) / 16).toBe(4);
    const t = text("random-walks");
    expect(t).toContain("Two end 4 m out, eight end 2 m out and six end at the start");
    expect(t).toContain("(2 × 16 + 8 × 4) ÷ 16 = 4");
  });

  test("typical distance √n: 1 m, about 1.4 m, 2 m, 10 m after 1, 2, 4 and 100 steps", () => {
    expect(printed(Math.sqrt(2), 1.4, 2)).toBe(true);
    expect([Math.sqrt(1), Math.sqrt(4), Math.sqrt(100)]).toEqual([1, 2, 10]);
    expect(text("random-walks")).toContain(
      "1 m after one step, about 1.4 m after two, 2 m after four, 10 m after a hundred",
    );
  });

  test("double D: √2 × 1 mm ≈ 1.4 mm; four times as long: 2 mm", () => {
    expect(printed(Math.SQRT2 * 1, 1.4, 2)).toBe(true);
    expect(Math.sqrt(4) * 1).toBe(2);
    const t = text("diffusion-equation");
    expect(t).toContain("the typical distance becomes about 1.4 mm");
    expect(t).toContain("the typical distance doubles, to 2 mm");
  });
});

describe("the notation bridges", () => {
  test("fractions: 6/2 = 3, 1/4 = 0.25 and 2/8 = 0.25", () => {
    expect(6 / 2).toBe(3);
    expect(1 / 4).toBe(0.25);
    expect(2 / 8).toBe(0.25);
    const t = text("bridge-fractions-ratios");
    expect(t).toContain("The fraction 6/2 is 3");
    expect(t).toContain("the fraction is 1/4 = 0.25");
    expect(t).toContain("the fraction is 2/8 = 0.25");
  });

  test("scientific notation: (6 × 10⁻⁶ m)² = 36 × 10⁻¹² m² = 3.6 × 10⁻¹¹ m²", () => {
    expect(printed(6e-6 ** 2, 3.6e-11, 2)).toBe(true);
    expect(printed(36e-12, 3.6e-11, 2)).toBe(true);
    expect(text("bridge-scientific-notation-units")).toContain(
      "(6 × 10⁻⁶ m)² = 36 × 10⁻¹² m² = 3.6 × 10⁻¹¹ m²",
    );
  });
});
