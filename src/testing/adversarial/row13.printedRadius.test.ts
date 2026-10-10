/**
 * ROW 13: "Radius = 1 um reproduces Einstein's 0.8 um" (am-ver-adversarial-audit-1ef).
 *
 * Einstein's printed figure for one second is about 0.8 um. It comes from a = 0.5 um -- half the
 * printed 0,001 mm diameter -- and a reader who takes the diameter for the radius gets 0.56 um and
 * a number that still looks plausible. Both values below were measured against the owner before
 * being written here.
 */

import { expect, test } from "bun:test";
import { printedBrownianDisplacement } from "../../physics/reference/diffusion/printedDisplacement.ts";
import { CORRECT_PRINTED_RADIUS_M, WRONG_PRINTED_RADIUS_M } from "./wrongComputations.ts";

/** Einstein's stated inputs: 17 C, k = 1,35e-2 poise, one second. */
const INPUT = { temperatureK: 290.15, viscosityPaS: 1.35e-3, elapsedSeconds: 1 };

function micronsAt(particleRadiusM: number) {
  const out = printedBrownianDisplacement({ ...INPUT, particleRadiusM });
  expect(out.status).toBe("value");
  return { printed: out.printed.value * 1e6, modern: out.modern.value * 1e6 };
}

test("the correct radius reproduces the printed figure", () => {
  const { printed, modern } = micronsAt(CORRECT_PRINTED_RADIUS_M);
  expect(printed).toBeCloseTo(0.7948, 4);
  // Rounds to the paper's "about 0.8 um" under both constant sets.
  expect(Math.round(printed * 10) / 10).toBe(0.8);
  expect(Math.round(modern * 10) / 10).toBe(0.8);
});

test("the WRONG radius fails on the displacement, and fails plausibly rather than absurdly", () => {
  const { printed, modern } = micronsAt(WRONG_PRINTED_RADIUS_M);
  // The row's stated values, measured: 0.562 um printed and 0.561 um with the modern constant.
  expect(printed).toBeCloseTo(0.562, 3);
  expect(modern).toBeCloseTo(0.561, 3);
  // It is not 0.8, and it does not round to it: that is the failing assertion for this row.
  expect(Math.round(printed * 10) / 10).not.toBe(0.8);
  // And it is wrong by 1/sqrt(2), because displacement goes as 1/sqrt(a) -- the same square root
  // row 1 is about, which is why this error looks like arithmetic rather than a blunder.
  const correct = micronsAt(CORRECT_PRINTED_RADIUS_M).printed;
  expect(correct / printed).toBeCloseTo(Math.SQRT2, 3);
});
