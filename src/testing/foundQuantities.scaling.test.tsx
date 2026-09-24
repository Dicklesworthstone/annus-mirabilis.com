import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import { ScalingTable } from "../components/foundations/ScalingTable.tsx";
import {
  PAPER_SPREAD_UM,
  SCALING_REFUSALS,
  type ScalingOutcome,
  scaleBy,
  scaleByTyped,
} from "../foundations/scaling.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The scaling construction of foundation:ratios-scaling (am-found-quantities-magnitudes-igxe).
 * Its law is the lesson's: k for a length, k² for an area, k³ for a volume, √k for a spread over
 * k times the time, and 1/√k for a spread with k times the radius or the viscosity.
 */

const close = (actual: number, reference: number, relative = 1e-12) =>
  expect(withinTolerance(actual, reference, { relative }).ok).toBe(true);

type Scaled = Extract<ScalingOutcome, { status: "scaled" }>;
const scaled = (k: number): Scaled => {
  const outcome = scaleBy(k);
  expect(outcome.status).toBe("scaled");
  return outcome as Scaled;
};

describe("the scaling law", () => {
  test("k = 2: length 2, area 4, volume 8, spread √2 over twice the time, 1/√2 at twice the radius", () => {
    const s = scaled(2);
    close(s.length, 2);
    close(s.area, 4);
    close(s.volume, 8);
    close(s.spreadLongerTime, Math.SQRT2);
    close(s.spreadLargerRadius, Math.SQRT1_2);
  });

  test("adversarial: doubling the radius does not halve the spread", () => {
    // The tempting wrong answer the lesson names. 0.7071 is 41 percent away from 0.5.
    expect(withinTolerance(scaled(2).spreadLargerRadius, 0.5, { relative: 0.1 }).ok).toBe(false);
  });

  test("the powers hold at any factor, including below one", () => {
    for (const k of [0.001, 0.5, 3, 7.25, 1000]) {
      const s = scaled(k);
      close(s.area, s.length ** 2);
      close(s.volume, s.length ** 3);
      close(s.spreadLongerTime * s.spreadLargerRadius, 1);
    }
  });
});

describe("the paper's 0.8 micrometres", () => {
  test("PAPER_SPREAD_UM is the constant set's rmsDisplacement1d, to four figures", () => {
    const entries = (
      load(
        readFileSync(
          new URL(
            "../../content/quantities/constant-sets/einstein-1905-brownian-printed.yaml",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as { entries: { quantityId: string; value: number }[] }
    ).entries;
    const entry = entries.find((e) => e.quantityId === "rmsDisplacement1d");
    expect(entry).toBeDefined();
    close(PAPER_SPREAD_UM, Number(((entry?.value ?? 0) / 1e-6).toPrecision(4)));
  });

  test("at k = 2 it becomes 1.124 μm in 2 s and 0.5620 μm at twice the radius, as the lesson says", () => {
    const s = scaled(2);
    close(s.paperSpreadLongerTimeUm, 1.124, 1e-3);
    close(s.paperSpreadLargerRadiusUm, 0.562, 1e-3);
    const lesson = readFileSync(
      new URL("../../content/foundations/ratios-scaling.json", import.meta.url),
      "utf8",
    );
    expect(lesson).toContain(`${s.paperSpreadLargerRadiusUm.toFixed(4)} μm`);
  });
});

describe("what a reader types", () => {
  test("a decimal comma reads as the papers print it", () => {
    const outcome = scaleByTyped("1,5");
    expect(outcome.status === "scaled" && outcome.k).toBe(1.5);
  });

  test("empty, unreadable, non-positive and out-of-range factors are refused with a reason", () => {
    const cases: readonly [string, string][] = [
      ["", SCALING_REFUSALS.empty],
      ["abc", SCALING_REFUSALS.unreadable],
      ["0", SCALING_REFUSALS["not-positive"]],
      ["-2", SCALING_REFUSALS["not-positive"]],
      ["2000", SCALING_REFUSALS["out-of-range"]],
      ["1e-5", SCALING_REFUSALS["out-of-range"]],
      ["1e400", SCALING_REFUSALS["out-of-range"]],
    ];
    for (const [text, message] of cases) {
      const outcome = scaleByTyped(text);
      expect(outcome.status).toBe("refused");
      expect(outcome.status === "refused" && outcome.message).toBe(message);
    }
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(<ScalingTable />);

  test("it offers typed entry beside the slider, with one label for both", () => {
    expect(html).toContain('data-foundation-construction="ratios-scaling"');
    expect(html).toContain('type="range"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("Scale factor k");
  });

  test("its first render, before any script runs, already shows the k = 2 readout", () => {
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("× k² = 4");
    expect(text).toContain("× k³ = 8");
    expect(text).toContain("0.5620 μm");
    expect(text).toContain("What it shows, in words");
  });
});
