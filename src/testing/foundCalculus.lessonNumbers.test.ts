import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LN_2, LOG10_2, logarithmPower } from "../foundations/calculus.ts";
import { gaussianPropagator, rmsDisplacement } from "../physics/reference/diffusion.ts";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-calculus-6agg: every number the five calculus lessons PRINT, redone from the inputs they
 * print and found in their own text. foundCalculus.numbers.test.ts checks h/e, ln 2 and a logarithm
 * identity against literals typed into that test and reads no lesson; this one reads the lessons,
 * so a reader who redoes a line of a worked example gets the lesson's own answer. The Gaussian
 * heights and the diffusion widths come from the diffusion owner, not from a formula typed here.
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
/** A figure as the lesson prints it; its significant figures are counted from the string. */
const printedAs = (value: number, shown: string) =>
  printed(value, Number(shown), shown.replace(/^[-−]?[0.]*/, "").replace(".", "").length);
const close = (actual: number, reference: number) =>
  withinTolerance(actual, reference, { relative: 1e-6, absolute: 1e-9 }).ok;
const val = (e: { result: { status: string; value?: unknown } }): number => {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
};

describe("functions-graphs: a filling bath and ⟨x²⟩ = 2Dt", () => {
  const t = text("functions-graphs");

  test("10, 20 and 30 litres after one, two and three minutes climb 10 litres a minute", () => {
    const litres = (minute: number) => 10 * minute;
    expect([1, 2, 3].map(litres)).toEqual([10, 20, 30]);
    expect(litres(3) - litres(2)).toBe(10);
    expect(t).toContain("After one minute it holds 10 litres, after two 20, after three 30");
    expect(t).toContain("a straight line that climbs 10 litres for every minute");
  });

  test("D = 0.5 µm²/s: 1, 4 and 9 µm² at 1, 4 and 9 s, and RMS widths 1, 2 and 3 µm", () => {
    const D = 0.5;
    expect(2 * D).toBe(1);
    const rms = (seconds: number) => val(rmsDisplacement(D, seconds));
    expect([1, 4, 9].map((s) => close(rms(s) ** 2, s))).toEqual([true, true, true]);
    expect([1, 4, 9].map((s, i) => close(rms(s), i + 1))).toEqual([true, true, true]);
    expect(close(rms(4) / rms(1), 2)).toBe(true);
    expect(t).toContain("Take D = 0.5 square micrometres per second, so 2D = 1 square micrometre");
    expect(t).toContain(
      "At t = 1 s the mean square displacement is 1 µm²; at t = 4 s it is 4 µm²; at t = 9 s, 9 µm².",
    );
    expect(t).toContain("are 1, 2 and 3 µm: four times the time gives twice the distance");
  });
});

describe("derivatives: a ball that has gone 3t² metres", () => {
  const t = text("derivatives");
  const x = (seconds: number) => 3 * seconds * seconds;

  test("3 m after one second and 12 m after two", () => {
    expect([x(1), x(2)]).toEqual([3, 12]);
    expect(t).toContain("3 m after one second, 12 m after two");
  });

  test("each shorter stretch: where it reaches, how far it went, and the average speed", () => {
    const rows: [number, string, string, string, string][] = [
      // Δt, position reached, distance, average speed, the line that prints them
      [
        1,
        "12",
        "9",
        "9",
        "Over the next second it goes from 3 m to 12 m: 9 m in 1 s, an average of 9 m/s.",
      ],
      [
        0.1,
        "3.63",
        "0.63",
        "6.3",
        "Over the next tenth of a second it reaches 3.63 m: 0.63 m in 0.1 s, an average of 6.3 m/s.",
      ],
      [
        0.01,
        "3.0603",
        "0.0603",
        "6.03",
        "Over the next hundredth it reaches 3.0603 m: 0.0603 m in 0.01 s, an average of 6.03 m/s.",
      ],
      [
        0.001,
        "3.006003",
        "0.006003",
        "6.003",
        "Over the next thousandth it reaches 3.006003 m: 0.006003 m in 0.001 s, an average of 6.003 m/s.",
      ],
    ];
    for (const [dt, reached, distance, average, line] of rows) {
      expect(printedAs(x(1 + dt), reached)).toBe(true);
      expect(printedAs(x(1 + dt) - x(1), distance)).toBe(true);
      expect(printedAs((x(1 + dt) - x(1)) / dt, average)).toBe(true);
      expect(line).toContain(
        `${reached} m: ${distance} m in ${dt} s, an average of ${average} m/s.`,
      );
      expect(t).toContain(line);
    }
  });

  test("the averages close in on 6 m/s, and the extra 3, 0.3, 0.03 and 0.003 are 3Δt", () => {
    expect(close((x(1 + 1e-6) - x(1 - 1e-6)) / 2e-6, 6)).toBe(true);
    const extra = (dt: number) => (x(1 + dt) - x(1)) / dt - 6;
    expect([1, 0.1, 0.01, 0.001].map((dt) => close(extra(dt), 3 * dt))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(t).toContain("The averages close in on 6 m/s.");
    expect(t).toContain("At t = 1 s that is 6 m/s.");
    expect(t).toContain(
      "The extra 3, 0.3, 0.03 and 0.003 in the list above are that 3Δt term, for Δt of 1, 0.1, 0.01 and 0.001 seconds.",
    );
  });

  test("3(t + Δt)² − 3t² = 6tΔt + 3(Δt)² at points the lesson does not print", () => {
    for (const [s, dt] of [
      [0.7, 0.2],
      [2.5, 1.3],
      [-1.1, 0.05],
    ] as const)
      expect(close(x(s + dt) - x(s), 6 * s * dt + 3 * dt * dt)).toBe(true);
    expect(t).toContain("3(t+\\Delta t)^2 - 3t^2 = 6t\\,\\Delta t + 3(\\Delta t)^2");
  });
});

describe("partial-derivatives: the §4 profile, from the diffusion owner", () => {
  const t = text("partial-derivatives");
  const D = 0.5;
  const f = (x: number, time: number) => val(gaussianPropagator(x, time, D));
  const h = 1e-4;
  const dfdx = (x: number, time: number) => (f(x + h, time) - f(x - h, time)) / (2 * h);
  const dfdt = (x: number, time: number) => (f(x, time + h) - f(x, time - h)) / (2 * h);
  const d2fdx2 = (x: number, time: number) =>
    (f(x + h, time) - 2 * f(x, time) + f(x - h, time)) / (h * h);
  const points = [
    [0.3, 1],
    [0.9, 1],
    [1.5, 1],
    [2.5, 2],
  ] as const;

  test("∂f/∂x at fixed t is −x/2Dt times f", () => {
    for (const [x, time] of points)
      expect(close(dfdx(x, time), (-x / (2 * D * time)) * f(x, time))).toBe(true);
    expect(t).toContain("the derivative of −x²/4Dt with respect to x is −x/2Dt");
  });

  test("∂f/∂t at fixed x is (−1/2t + x²/4Dt²) times f, negative inside x² = 2Dt and positive outside", () => {
    for (const [x, time] of points) {
      const bracket = -1 / (2 * time) + (x * x) / (4 * D * time * time);
      expect(withinTolerance(dfdt(x, time), bracket * f(x, time), { relative: 1e-5 }).ok).toBe(
        true,
      );
      expect(Math.sign(dfdt(x, time))).toBe(x * x < 2 * D * time ? -1 : 1);
    }
    expect(t).toContain("Near the centre, where x² is less than 2Dt, the bracket is negative");
  });

  test("D ∂²f/∂x² equals ∂f/∂t: the §4 equation", () => {
    for (const [x, time] of points)
      expect(withinTolerance(D * d2fdx2(x, time), dfdt(x, time), { relative: 1e-4 }).ok).toBe(true);
    expect(t).toContain("That is the §4 equation ∂f/∂t = D ∂²f/∂x²");
  });
});

describe("exponentials: halving atoms and the Brownian curve's factor", () => {
  const t = text("exponentials");

  test("1,000 atoms halving each hour: 500, 250, 125 remain, and 500, 250, 125 are lost", () => {
    const remain = (hours: number) => 1000 / 2 ** hours;
    expect([1, 2, 3].map(remain)).toEqual([500, 250, 125]);
    expect([1, 2, 3].map((h) => remain(h - 1) - remain(h))).toEqual([500, 250, 125]);
    expect(t).toContain("After one hour 500 remain, after two 250, after three 125.");
    expect(t).toContain("500 in the first hour, 250 in the second, 125 in the third.");
  });

  test("e about 2.718; k about 0.693 per hour halves N₀ each hour", () => {
    expect(printedAs(Math.E, "2.718")).toBe(true);
    expect(printedAs(LN_2, "0.693")).toBe(true);
    // With the printed k, N₀e^(−kt) gives the halvings above to the three figures printed.
    const k = Number("0.693");
    expect(
      [1, 2, 3].map((hours) => printedAs(1000 * Math.exp(-k * hours), String(1000 / 2 ** hours))),
    ).toEqual([true, true, true]);
    expect(t).toContain("with e about 2.718");
    expect(t).toContain("for halving every hour, k is about 0.693 per hour");
  });

  test("the series 1 + x + x²/2 + x³/6 + … is eˣ, and eˣ is its own rate of change", () => {
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    expect([factorial(2), factorial(3)]).toEqual([2, 6]);
    for (const x of [1, -0.5, 2]) {
      let sum = 0;
      for (let k = 0; k < 30; k++) sum += x ** k / factorial(k);
      expect(close(sum, Math.exp(x))).toBe(true);
      expect(close((Math.exp(x + 1e-6) - Math.exp(x - 1e-6)) / 2e-6, Math.exp(x))).toBe(true);
    }
    expect(t).toContain("e^{x} = 1 + x + \\frac{x^{2}}{2} + \\frac{x^{3}}{6} + \\ldots");
  });

  test("one RMS width out the curve is about 0.607 of its peak; at √(4Dt), about 0.368", () => {
    const D = 0.5;
    const time = 1;
    const peak = val(gaussianPropagator(0, time, D));
    const width = val(rmsDisplacement(D, time));
    expect(close(width, Math.sqrt(2 * D * time))).toBe(true);
    expect(printedAs(val(gaussianPropagator(width, time, D)) / peak, "0.607")).toBe(true);
    const farther = val(gaussianPropagator(Math.sqrt(4 * D * time), time, D)) / peak;
    expect(printedAs(farther, "0.368")).toBe(true);
    expect(close((-2 * D * time) / (4 * D * time), -1 / 2)).toBe(true);
    expect(t).toContain(
      "the exponent is −2Dt/4Dt = −1/2, and e raised to −1/2 is about 0.607 of the peak",
    );
    expect(t).toContain("the exponent is −1, and e raised to −1 is about 0.368 of the peak");
  });

  test("doubling the time moves each height √2 times farther out", () => {
    const D = 0.5;
    const ratio = (x: number, time: number) =>
      val(gaussianPropagator(x, time, D)) / val(gaussianPropagator(0, time, D));
    const at = Math.sqrt(2 * D * 1);
    expect(close(ratio(Math.SQRT2 * at, 2), ratio(at, 1))).toBe(true);
    expect(close(ratio(2 * Math.SQRT2 * at, 2), ratio(2 * at, 1))).toBe(true);
    expect(t).toContain("each of these heights is reached √2 times farther from the centre");
  });
});

describe("logarithms: products into sums, and ten molecules in one half", () => {
  const t = text("logarithms");

  test("ln 2 ≈ 0.693, ln 4 ≈ 1.386, and their sum 2.079 is ln 8", () => {
    expect(printedAs(Math.log(2), "0.693")).toBe(true);
    expect(printedAs(Math.log(4), "1.386")).toBe(true);
    expect(printedAs(Number("0.693") + Number("1.386"), "2.079")).toBe(true);
    expect(printedAs(Math.log(8), "2.079")).toBe(true);
    expect(t).toContain(
      "The natural logarithm of 2 is about 0.693, and of 4 about 1.386. Add them and you get 2.079, which is the natural logarithm of 8",
    );
  });

  test("e raised to 0.693, 1.386 and 2.079 gives 2, 4 and 8, to the powers' three figures", () => {
    expect(printed(Math.exp(Number("0.693")), 2, 3)).toBe(true);
    expect(printed(Math.exp(Number("1.386")), 4, 3)).toBe(true);
    expect(printed(Math.exp(Number("2.079")), 8, 3)).toBe(true);
    expect(t).toContain("Raised to 0.693, e gives 2, and raised to 1.386 it gives 4.");
    expect(t).toContain("so raised to 2.079 it gives 8");
  });

  test("a printed lg 2 is ln 2, about 0.693, not log₁₀ 2, about 0.301", () => {
    expect(printedAs(LN_2, "0.693")).toBe(true);
    expect(printedAs(LOG10_2, "0.301")).toBe(true);
    expect(t).toContain("So a printed lg 2 means ln 2, about 0.693, not log₁₀ 2, about 0.301.");
  });

  test("n = 10, v = v₀/2: W = 1/1024 ≈ 0.000977, ln W = 10 × (−0.693) = −6.93", () => {
    expect(0.5 ** 10).toBe(1 / 1024);
    expect(printedAs(0.5 ** 10, "0.000977")).toBe(true);
    expect(close(logarithmPower(0.5, 10), Math.log(0.5 ** 10))).toBe(true);
    expect(printedAs(logarithmPower(0.5, 10), "-6.93")).toBe(true);
    expect(printedAs(10 * -Number("0.693"), "-6.93")).toBe(true);
    expect(t).toContain("Then W = (1/2)¹⁰ = 1/1024, about 0.000977.");
    expect(t).toContain("ln W = 10 × ln(1/2) = 10 × (−0.693) = −6.93.");
    expect(t).toContain("lower by 6.93 × R/N: 6.93 times Boltzmann's constant");
  });
});
