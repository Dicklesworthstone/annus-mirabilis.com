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

  test("eight strips: heights 1.75, area 0.875; sixteen: 0.9375; the shortfall 0.25, 0.125, 0.0625", () => {
    // Left edges of n equal strips across 4 μm under the density 0.125 x.
    const heights = (n: number) => Array.from({ length: n }, (_, k) => 0.125 * k * (4 / n));
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const area = (n: number) => sum(heights(n)) * (4 / n);
    expect(sum(heights(8))).toBe(1.75);
    expect([area(4), area(8), area(16)]).toEqual([0.75, 0.875, 0.9375]);
    expect([1 - area(4), 1 - area(8), 1 - area(16)]).toEqual([0.25, 0.125, 0.0625]);
    expect(t).toContain(
      "Eight strips 0.5 µm wide: the heights add to 1.75, and times 0.5 that is 0.875.",
    );
    expect(t).toContain(
      "Sixteen strips 0.25 µm wide: 0.9375. The shortfall halves each time the strips do: 0.25, then 0.125, then 0.0625.",
    );
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

  test("2.1 squared: two strips 2 by 0.1 add 0.4, the corner 0.01, so 4.41; forty times smaller", () => {
    expect(printed(2 * (2 * 0.1), 0.4, 1)).toBe(true);
    expect(printed(0.1 * 0.1, 0.01, 1)).toBe(true);
    expect(printed(2.1 ** 2, 4.41, 3)).toBe(true);
    expect(printed(4 + 0.4 + 0.01, 4.41, 3)).toBe(true);
    expect(printed(0.4 / 0.01, 40, 1)).toBe(true);
    expect(t).toContain(
      "It gains two strips, each 2 long and 0.1 thick, which add 0.4, and a small corner, 0.1 by 0.1, which adds 0.01. So 2.1 squared is 4.41.",
    );
    expect(t).toContain("the second, 0.01, is forty times smaller");
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
    expect(t).toContain(
      "Mark where 100 particles end up on a ruler divided into 2 μm bins. If 30 land in one bin, that bin holds a probability of about 0.3",
    );
    expect(t).toContain("0.3 divided by 2 μm, or 0.15 per micrometre");
    expect(t).toContain("while the bin still holds 0.3");
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

  test("a hundred steps leave 10 m and four hundred 20 m; the path walked is 100 m", () => {
    expect([Math.sqrt(100), Math.sqrt(400)]).toEqual([10, 20]);
    expect([400 / 100, Math.sqrt(400) / Math.sqrt(100)]).toEqual([4, 2]);
    expect(100 * 1).toBe(100);
    const t = text("random-walks");
    expect(t).toContain(
      "A hundred steps of typical size 1 m leave a typical distance of 10 m from the start, because the square root of 100 is 10. Four hundred steps leave 20 m: four times the steps, twice the distance.",
    );
    expect(t).toContain("to end 10 m from home, the walker has walked 100 m");
  });

  test("double D: √2 × 1 mm ≈ 1.4 mm; four times as long: 2 mm", () => {
    expect(printed(Math.SQRT2 * 1, 1.4, 2)).toBe(true);
    expect(Math.sqrt(4) * 1).toBe(2);
    const t = text("diffusion-equation");
    expect(t).toContain("the typical distance becomes about 1.4 mm");
    expect(t).toContain("the typical distance doubles, to 2 mm");
  });
});

describe("probability-independence: two coin steps of 1 m", () => {
  const t = text("probability-independence");
  const steps = [1, -1] as const;
  const pairs = steps.flatMap((first) => steps.map((second) => [first, second] as const));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  test("four walks end 2 m right, at the start twice, 2 m left; squares 4, 0, 0, 4 average 2", () => {
    const ends = pairs.map(([a, b]) => a + b);
    expect(ends).toEqual([2, 0, 0, -2]);
    expect(ends.map((e) => e * e)).toEqual([4, 0, 0, 4]);
    expect(mean(ends.map((e) => e * e))).toBe(2);
    expect(mean(ends.map((e) => e * e)) / 2).toBe(1);
    expect(t).toContain(
      "They leave you 2 m to the right, back at the start, back at the start, or 2 m to the left.",
    );
    expect(t).toContain(
      "Square those distances so that left and right count alike: 4, 0, 0 and 4. Their average is 2, one square metre for each step.",
    );
  });

  test("the products are +1, −1, −1, +1 and average zero; a drift of +1 per step makes it 1", () => {
    const products = pairs.map(([a, b]) => a * b);
    expect(products).toEqual([1, -1, -1, 1]);
    expect(mean(products)).toBe(0);
    expect(1 * 1).toBe(1);
    expect(t).toContain(
      "the product of the two steps is +1 for right-right and left-left and −1 for the other two, so on average it is zero",
    );
    expect(t).toContain(
      "If each step drifts, averaging +1, the product of the averages is 1, not 0.",
    );
  });

  test("a second step that copies the first: squared distance 4 every time, not 2", () => {
    const copied = steps.map((first) => first + first);
    expect(copied.map((e) => e * e)).toEqual([4, 4]);
    expect(mean(copied.map((e) => e * e)) - mean(pairs.map(([a, b]) => (a + b) ** 2))).toBe(2);
    expect(t).toContain(
      "the squared distance is 4 every time: the average is 4, not 2. Independence removed that extra 2.",
    );
  });
});

describe("flux-continuity: counting across the ends of a stretch", () => {
  test("7 in and 5 out raise the count by 2; 5 in and 5 out leave it, though 10 crossed", () => {
    expect(7 - 5).toBe(2);
    expect(5 - 5).toBe(0);
    expect(5 + 5).toBe(10);
    const t = text("flux-continuity");
    expect(t).toContain(
      "7 particles cross into the stretch and 5 cross out. The count inside rises by 2.",
    );
    expect(t).toContain(
      "5 cross in and 5 cross out. The count is unchanged, although 10 particles crossed.",
    );
  });
});

describe("bridge-negative-numbers-direction and bridge-a-graph", () => {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  test("+3 and −3 sum to zero and their distances to six; −1 and +1 average zero and distance one", () => {
    expect(3 + -3).toBe(0);
    expect(Math.abs(3) + Math.abs(-3)).toBe(6);
    expect(mean([-1, 1])).toBe(0);
    expect(mean([-1, 1].map(Math.abs))).toBe(1);
    const t = text("bridge-negative-numbers-direction");
    expect(t).toContain(
      "has displacement +3; one three units to the left has displacement −3. Adding the signed displacements gives zero. Adding the distances from the start gives six.",
    );
    expect(t).toContain(
      "one at −1 and the other at +1. The signed average is zero. The average distance is one.",
    );
  });

  test("0, 14 and 28 m at 0, 10 and 20 s climb 1.4 m/s; −3, −1, +1, +3 average 0", () => {
    // A steady walk: 14 m for every 10 s.
    const metres = (seconds: number) => (14 * seconds) / 10;
    expect([0, 10, 20].map(metres)).toEqual([0, 14, 28]);
    expect(printed(14 / 10, 1.4, 2)).toBe(true);
    expect(mean([-3, -1, 1, 3])).toBe(0);
    const t = text("bridge-a-graph");
    expect(t).toContain("0 m at the start, 14 m after ten seconds, 28 m after twenty");
    expect(t).toContain("This one climbs 14 metres for every 10 seconds: 1.4 metres per second.");
    expect(t).toContain(
      "Four particles end at −3, −1, +1 and +3 micrometres from where they started.",
    );
    expect(t).toContain("The picture is symmetric, so the average position is 0.");
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

  test("0.001 mm is 0.000001 m, 10⁻⁶ m: the point moved six places", () => {
    expect(printed(0.001 * 1e-3, 1e-6, 1)).toBe(true);
    expect(Number("0.000001")).toBe(1e-6);
    expect("0.000001".split(".")[1]?.length).toBe(6);
    const t = text("bridge-scientific-notation-units");
    expect(t).toContain("for particles 0.001 mm across. In metres that is 0.000001 m");
    expect(t).toContain(
      "Written as 10⁻⁶ m, the −6 says the decimal point has moved six places to the left",
    );
    expect(t).toContain("1 micrometre (1 μm) is 10⁻⁶ metres, or 0.000001 m.");
  });
});
