import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The numbers the linear-geometry lessons print (am-found-linear-geometry-7w15), recomputed here and
 * required in each lesson's text at the precision it prints them, and the bead's glyph rule: no
 * record of this cluster writes β for v/c, because Einstein's β is the modern γ in the relativity
 * and mass-energy papers and Wien's constant in the light paper.
 */

const CLUSTER = [
  "vectors-components",
  "matrices-linear-maps",
  "dot-cross-products",
  "hyperbolic-functions-rapidity",
  "conservation-symmetry",
] as const;

const path = (id: string) => new URL(`../../content/foundations/${id}.json`, import.meta.url);

/** Every string a lesson shows, joined with spaces, with the \( \) inline-math delimiters removed. */
const lessonText = (id: string): string => {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(JSON.parse(readFileSync(path(id), "utf8")));
  return strings.join(" ").replace(/\\[()]/g, "");
};

const close = (actual: number, reference: number, relative = 1e-12) =>
  expect(withinTolerance(actual, reference, { relative }).ok).toBe(true);

describe("vectors and components", () => {
  const text = lessonText("vectors-components");
  const cos = 0.8;
  const sin = 0.6;

  test("0.6c along x, seen from axes turned so cos θ = 0.8, has components 0.48c and −0.36c", () => {
    const along = 0.6 * cos;
    const across = -0.6 * sin;
    expect(text).toContain(`= ${along.toFixed(2)}c along the new x axis`);
    expect(text).toContain(`= ${across.toFixed(2)}c along the new y axis`);
    // The axes are a real rotation: cos² + sin² = 1.
    close(cos ** 2 + sin ** 2, 1);
  });

  test("the arrow's length is 0.6 in both descriptions", () => {
    const length = Math.sqrt((0.6 * cos) ** 2 + (0.6 * sin) ** 2);
    close(length, 0.6);
    expect(text).toContain(`= ${length.toFixed(1)}, so the speed is 0.6c in both descriptions`);
  });

  test("the field of 5 units splits into 3 along the boost and 4 across it", () => {
    close(Math.hypot(3, 4), 5);
    expect(text).toContain("a parallel component of 3 and a perpendicular part of 4");
  });
});

describe("matrices and linear maps", () => {
  const text = lessonText("matrices-linear-maps");
  const speedRatio = 0.6; // v/c. Never named speedRatio: Einstein's β is the modern γ.
  const gamma = 1 / Math.sqrt(1 - speedRatio ** 2);
  // The boost on (x, t) with c = 1: rows (γ, −γ v/c) and (−γ v/c, γ).
  const [p, q, r, s] = [gamma, -gamma * speedRatio, -gamma * speedRatio, gamma];

  test("γ = 1.25 and γv/c = 0.75 at 0.6c, printed in the table", () => {
    close(gamma, 1.25);
    close(gamma * speedRatio, 0.75);
    expect(text).toContain(`${gamma.toFixed(2)} &\\quad -${(gamma * speedRatio).toFixed(2)}c`);
  });

  test("the determinant is 1 for the boost and for the Galilean map", () => {
    close(p * s - q * r, 1);
    close(1 * 1 - -speedRatio * 0, 1);
    expect(text).toContain("1.25^2 - 0.75^2 = 1");
  });

  test("the light lines are eigenvectors, stretched by 0.5 and 2", () => {
    for (const [direction, stretch] of [
      [1, gamma * (1 - speedRatio)],
      [-1, gamma * (1 + speedRatio)],
    ] as const) {
      // Apply the map to the light line x = ±t (c = 1) and check it is only stretched.
      const x = direction;
      const t = 1;
      close(p * x + q * t, stretch * x);
      close(r * x + s * t, stretch * t);
    }
    close(gamma * (1 - speedRatio), 0.5);
    close(gamma * (1 + speedRatio), 2);
    expect(text).toContain("stretched by 0.5 and by 2");
  });

  test("the Galilean map does not keep x = ct: the flash moves at c − v", () => {
    // x' = x − vt on x = t gives x' = (1 − 0.6)t, not t' = t.
    close(1 - speedRatio, 0.4);
    expect(text).toContain("the flash now moves at c − v, not c");
  });

  test("simultaneous events 10 light-seconds apart: Δx′ = 12.5 light-seconds, Δt′ = −7.5 s", () => {
    const dx = 10;
    const dt = 0;
    const dxPrime = p * dx + q * dt;
    const dtPrime = r * dx + s * dt;
    close(dxPrime, 12.5);
    close(dtPrime, -7.5);
    expect(text).toContain(`= ${dxPrime.toFixed(1)} light-seconds`);
    expect(text).toContain(`\\Delta t' = ${dtPrime.toFixed(1)}`);
  });
});

describe("hyperbolic functions and rapidity", () => {
  const text = lessonText("hyperbolic-functions-rapidity");
  const speedRatio = 0.6;
  const rapidity = Math.atanh(speedRatio);

  test("artanh 0.6 = ln 2 = 0.6931, printed to four places", () => {
    close(rapidity, Math.LN2);
    expect(text).toContain(`= \\ln 2 = ${rapidity.toFixed(4)}`);
  });

  test("cosh and sinh of the rapidity are γ = 1.25 and γv/c = 0.75", () => {
    close(Math.cosh(rapidity), 1.25);
    close(Math.sinh(rapidity), 0.75);
    close(Math.cosh(rapidity) ** 2 - Math.sinh(rapidity) ** 2, 1);
    expect(text).toContain("= 1.25, which is γ at 0.6c");
    expect(text).toContain("= 0.75, which is");
  });

  test("two rapidities of 0.6c add to ln 4, and tanh(ln 4) = 15/17 = 0.8824 is §5's composition", () => {
    const combined = Math.tanh(2 * rapidity);
    close(combined, 15 / 17);
    // The paper's §5 rule, computed independently of any hyperbolic function.
    close((speedRatio + speedRatio) / (1 + speedRatio * speedRatio), combined);
    expect(combined).toBeLessThan(1);
    expect(text).toContain(`= 15/17 = ${combined.toFixed(4)}`);
  });

  test("e to the ∓ rapidity is 0.5 and 2, the stretches of the light lines", () => {
    close(Math.exp(-rapidity), 0.5);
    close(Math.exp(rapidity), 2);
    expect(text).toContain("= 0.5 and e^{\\ln 2} = 2 are the stretches");
  });

  test("the later-aid label names its dates, and the φ(v) of §3 is kept apart", () => {
    expect(text).toMatch(/later aid/);
    expect(text).toContain("Varićak in 1910");
    expect(text).toContain("Robb's, from 1911");
    expect(text).toContain("not the φ(v) of §3");
  });
});

describe("dot and cross products", () => {
  const text = lessonText("dot-cross-products");
  type V3 = readonly [number, number, number];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  test("the projection of (3, 4, 0) on the boost direction is 3, and its length is 5", () => {
    expect(dot([3, 4, 0], [1, 0, 0])).toBe(3);
    close(Math.sqrt(dot([3, 4, 0], [3, 4, 0])), 5);
    expect(text).toContain("\\cdot(1, 0, 0) = 3, the part along the boost");
  });

  test("x̂ × ẑ = −ŷ: a positive charge moving along +x through B along +z is pushed along −y", () => {
    expect(cross([1, 0, 0], [0, 0, 1])).toEqual([0, -1, 0]);
    expect(text).toContain("(1, 0, 0)\\times(0, 0, 1) = (0, -1, 0)");
  });

  test("E·B = 0.8 before and after a boost of 0.6 along x, by the §6 rules with c = 1", () => {
    const v = 0.6;
    const gamma = 1 / Math.sqrt(1 - v * v);
    const E: V3 = [0, 0.6, 0.8];
    const B: V3 = [0, 0, 1];
    const E2: V3 = [E[0], gamma * (E[1] - v * B[2]), gamma * (E[2] + v * B[1])];
    const B2: V3 = [B[0], gamma * (B[1] + v * E[2]), gamma * (B[2] - v * E[1])];
    for (const [actual, printed] of [
      [E2[1], 0],
      [E2[2], 1],
      [B2[1], 0.6],
      [B2[2], 0.8],
    ] as const) {
      expect(withinTolerance(actual, printed, { absolute: 1e-12 }).ok).toBe(true);
    }
    close(dot(E, B), 0.8);
    close(dot(E2, B2), 0.8);
    expect(text).toContain("\\mathbf{E}' = (0, 0, 1)");
    expect(text).toContain("\\mathbf{B}' = (0, 0.6, 0.8)");
  });

  test("the invariant is labelled a modern check, not a premise of 1905", () => {
    expect(text).toContain("a modern check on the field transformation");
    expect(text).toContain("It is not a premise of the 1905 argument");
  });
});

describe("conservation and symmetry", () => {
  const text = lessonText("conservation-symmetry");
  const speedRatio = 0.6;
  const gamma = 1 / Math.sqrt(1 - speedRatio ** 2);

  test("two pulses of L/2 from 0.6c carry 0.25L and L, a total of γL = 1.25L", () => {
    // The mass-energy paper's pulse energy, (L/2)γ(1 ∓ (v/c) cos φ), along the motion and against it.
    const forward = 0.5 * gamma * (1 - speedRatio);
    const back = 0.5 * gamma * (1 + speedRatio);
    close(forward, 0.25);
    close(back, 1);
    close(forward + back, gamma);
    expect(text).toContain(`= ${forward.toFixed(2)}L, and the pulse sent back carries`);
    expect(text).toContain(`${(forward + back).toFixed(2)}L = \\gamma L`);
  });

  test("the interval of two simultaneous events 10 light-seconds apart is −100 in both frames", () => {
    const [dt, dx] = [0, 10];
    const dtPrime = gamma * (dt - speedRatio * dx);
    const dxPrime = gamma * (dx - speedRatio * dt);
    close(dt ** 2 - dx ** 2, -100);
    close(dtPrime ** 2 - dxPrime ** 2, -100);
    expect(text).toContain("7.5^2 - 12.5^2 = 56.25 - 156.25 = -100");
  });

  test("the interval is labelled a modern check, never a premise of the 1905 route", () => {
    expect(text).toContain("Minkowski's geometry of 1908");
    expect(text).toContain("It is not a premise of the 1905 route");
  });
});

describe("the β rule, over every lesson of the cluster that exists", () => {
  const present = CLUSTER.filter((id) => existsSync(path(id)));

  test("at least one lesson of the cluster exists, so the rule is not checked over nothing", () => {
    expect(present.length).toBeGreaterThan(0);
  });

  test("no lesson writes β for v/c, in words, symbols or LaTeX", () => {
    for (const id of present) {
      const text = lessonText(id);
      expect(text, id).not.toMatch(/(β|\\speedRatio)\s*=\s*v\s*\/\s*c/);
      expect(text, id).not.toMatch(/v\s*\/\s*c\s*=\s*(β|\\speedRatio)/);
    }
  });
});
