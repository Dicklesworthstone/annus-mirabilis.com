/**
 * A distance SR-03 calls the rod's is the rod's (am-sr03-default-readings-not-rod-ends-bf7w).
 *
 * The default readings are two platform marks 10 ls apart, simultaneous in K, while the rod rests
 * in k: 8 ls long in K at 0.6c and 6 ls at 0.8c. The view model (readings.ts) decides what every
 * distance is called from the owner's outputs. Here each distance it places with the rod (the
 * verdict's "the rod's length there", its "is N ls long there", the strips, the values-table row
 * named for the rod) is checked against the rod's length computed in this file, independently of
 * the owner: L0 in its rest frame, L0·√(1 − v²) in the other. A view model that called the platform
 * marks' 10 ls the rod's length fails the first test at 0.6c and 0.8c.
 */
import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import { type FrameId, SR03_DEFAULTS, type Sr03Parameters } from "./definition.ts";
import { type Sr03ReadingsView, sr03ReadingsView } from "./readings.ts";

/** The rod's length in `frame`, its ends read at one time there: the test's own oracle. */
function rodOracle(p: Sr03Parameters, frame: FrameId): number {
  return p.rodRestFrame === frame ? p.L0 : p.L0 * Math.sqrt(1 - p.v * p.v);
}

const close = (actual: number | null, expected: number) =>
  actual !== null && withinTolerance(actual, expected, { absolute: 1e-9, relative: 1e-9 }).ok;

async function viewFor(
  p: Sr03Parameters,
): Promise<{ view: Sr03ReadingsView; measured: number | null }> {
  const evaluated = await evaluateSr03(p);
  if (evaluated.kind !== "accepted") throw new TypeError(`SR-03 refused ${JSON.stringify(p)}`);
  const out = evaluated.data.outputs.find((o) => o.quantityId === "measuredLength");
  const measured = out?.status === "value" && typeof out.value === "number" ? out.value : null;
  return { view: sr03ReadingsView(p, evaluated.data.outputs), measured };
}

/** Every distance the view places with the rod, and what it should be. */
function rodClaims(p: Sr03Parameters, view: Sr03ReadingsView, measured: number | null) {
  const m = p.measuringFrame;
  const claims: { where: string; shown: number | null; rod: number; exact: boolean }[] = [];
  const calledLength = view.verdict.match(/the rod's length there: ([0-9.]+) ls/)?.[1];
  if (calledLength !== undefined)
    claims.push({
      where: "verdict, the rod's length",
      shown: Number(calledLength),
      rod: rodOracle(p, m),
      exact: false,
    });
  const itself = view.verdict.match(/is ([0-9.]+) ls long there/)?.[1];
  if (itself !== undefined)
    claims.push({
      where: "verdict, the rod itself",
      shown: Number(itself),
      rod: rodOracle(p, m),
      exact: false,
    });
  if (view.valueLabels.measuredLength?.startsWith("The rod's length"))
    claims.push({
      where: "table, measuredLength row",
      shown: measured,
      rod: rodOracle(p, m),
      exact: true,
    });
  for (const strip of view.strips)
    claims.push({
      where: `strip ${strip.frame}`,
      shown: strip.length,
      rod: rodOracle(p, strip.frame),
      exact: true,
    });
  claims.push({ where: "rodLength", shown: view.rodLength, rod: rodOracle(p, m), exact: true });
  return claims.filter((c) =>
    c.exact ? !close(c.shown, c.rod) : c.shown === null || c.shown.toFixed(2) !== c.rod.toFixed(2),
  );
}

describe("SR-03's default readings: the rod's length is L0/γ in K, the platform marks are named", () => {
  for (const v of [0, 0.6, 0.8]) {
    test(`at load settings with v = ${v}c`, async () => {
      const p = { ...SR03_DEFAULTS, v };
      const { view, measured } = await viewFor(p);
      const rodK = rodOracle(p, "K");
      // The distance labelled as the rod's, in K, is L0/γ: 10, 8 and 6 ls.
      expect(close(view.rodLength, rodK)).toBe(true);
      expect(view.verdict).toContain(`${rodK.toFixed(2)} ls`);
      expect(rodClaims(p, view, measured)).toEqual([]);
      if (v === 0) {
        // At rest the two platform marks are where the rod's ends are, and the owner says so.
        expect(view.kind).toBe("rod-ends");
        expect(view.verdict).toContain("the rod's length there: 10.00 ls");
      } else {
        // The marks stay 10 ls apart while the rod shrinks: named, never offered as the rod.
        expect(view.kind).toBe("platform-marks");
        expect(measured).toBe(10);
        expect(view.valueLabels.measuredLength).toContain("platform marks, not the rod");
        expect(view.valueLabels.spatialSeparationK).toContain("platform marks, not the rod");
        expect(view.verdict).toContain("two marks on the platform, not the rod's ends");
        expect(view.verdict).not.toContain("the rod's length there:");
        expect(view.verdict).toContain(`is ${rodK.toFixed(2)} ls long there`);
      }
    });
  }
});

describe("every distance SR-03 places with the rod measures the rod's simultaneous ends", () => {
  const pairs = [
    "platform-simultaneous",
    "frame-simultaneous",
    "causal-timelike",
    "causal-lightlike",
    "causal-threshold",
  ] as const;
  const frames: readonly FrameId[] = ["K", "k"];

  test("across pairs, rest frames, measuring frames and speeds", async () => {
    const wrong: string[] = [];
    let calledRod = 0;
    let calledNotRod = 0;
    for (const endpointPairId of pairs)
      for (const rodRestFrame of frames)
        for (const measuringFrame of frames)
          for (const v of [0, 0.3, 0.6, 0.8, -0.6]) {
            const p = { ...SR03_DEFAULTS, endpointPairId, rodRestFrame, measuringFrame, v };
            const { view, measured } = await viewFor(p);
            for (const c of rodClaims(p, view, measured))
              wrong.push(
                `${endpointPairId} rest ${rodRestFrame} measured ${measuringFrame} v ${v}: ${c.where} shows ${c.shown}, the rod is ${c.rod}`,
              );
            if (view.valueLabels.measuredLength?.startsWith("The rod's length")) calledRod++;
            if (view.valueLabels.measuredLength?.includes("not the rod")) calledNotRod++;
          }
    expect(wrong).toEqual([]);
    // Both kinds of label were examined, so neither half of the property holds vacuously.
    console.log(
      `[sr03 readings] measuredLength called the rod's in ${calledRod} cases, not the rod in ${calledNotRod}`,
    );
    expect(calledRod).toBeGreaterThan(0);
    expect(calledNotRod).toBeGreaterThan(0);
  });

  test("events a reader enters at the rod's ends are its ends; others are theirs", async () => {
    const onEnds = {
      ...SR03_DEFAULTS,
      endpointPairId: "custom" as const,
      customT1: 0,
      customX1: 0,
      customT2: 0,
      customX2: 8,
    };
    const a = await viewFor(onEnds);
    expect(a.view.kind).toBe("rod-ends");
    expect(a.view.verdict).toContain("the rod's length there: 8.00 ls");

    const marks = { ...onEnds, customX2: 10 };
    const b = await viewFor(marks);
    expect(b.view.kind).toBe("entered-events");
    expect(b.view.valueLabels.measuredLength).toContain("your events, not the rod");
    expect(b.view.verdict).toContain("is 8.00 ls long there");
  });

  test("with no word from the owner, nothing is called the rod's ends", () => {
    const view = sr03ReadingsView(SR03_DEFAULTS, []);
    expect(view.rodEnds).toBe(false);
    expect(view.rodLength).toBeNull();
    expect(view.verdict).not.toContain("the rod's length there:");
  });
});
