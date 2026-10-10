/**
 * ROW 8: "Forces have equal numerical components in different frames"
 * (am-ver-adversarial-audit-1ef).
 *
 * The transverse coefficient is gamma^2 in the source convention and gamma in the laboratory one.
 * The row's stated values at beta = 0.6 are 1.5625m and 1.25m, and the owner gives exactly those.
 *
 * The error is plausible because BOTH are called "the transverse mass" and the literature of the
 * period used both conventions, so a reader carrying one number between frames is not being
 * careless -- they are using a real quantity under the wrong convention.
 */

import { expect, test } from "bun:test";
import type { ScientificResult } from "../../experiments/results/types.ts";
import {
  longitudinalMass,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../../physics/reference/electron.ts";
import { wrongFrameIndependentTransverseCoefficient } from "./wrongComputations.ts";

const M = 1;
const BETA = 0.6;
const GAMMA = 1.25;

/** Narrows the owner's own union rather than a loosened shape, so tsc checks the access. */
const value = (r: ScientificResult) => {
  expect(r.status).toBe("value");
  return r.status === "value" && typeof r.value === "number" ? r.value : Number.NaN;
};

test("the two transverse coefficients are the row's stated values, and they differ by gamma", () => {
  const comoving = value(transverseMassComoving(M, BETA));
  const laboratory = value(transverseMassLaboratory(M, BETA));
  expect(comoving).toBeCloseTo(1.5625, 12);
  expect(laboratory).toBeCloseTo(1.25, 12);
  expect(comoving).toBeCloseTo(GAMMA * GAMMA * M, 12);
  expect(laboratory).toBeCloseTo(GAMMA * M, 12);
  expect(comoving / laboratory).toBeCloseTo(GAMMA, 12);
});

test("the WRONG computation fails on the comoving coefficient, by exactly gamma", () => {
  const comoving = value(transverseMassComoving(M, BETA));
  const laboratory = value(transverseMassLaboratory(M, BETA));
  const wrong = wrongFrameIndependentTransverseCoefficient(laboratory);
  expect(wrong).not.toBeCloseTo(comoving, 6);
  expect(comoving / wrong).toBeCloseTo(GAMMA, 12);
});

test("beta = 0 is the degenerate case, documented so nobody tests there", () => {
  // The third coincidence in this audit, after row 7's 90 degrees and row 14's n = 1: at rest the
  // conventions agree and a fixture there passes under both.
  expect(value(transverseMassComoving(M, 0))).toBeCloseTo(
    value(transverseMassLaboratory(M, 0)),
    12,
  );
  expect(value(transverseMassComoving(M, 0))).toBeCloseTo(M, 12);
});

test("the longitudinal coefficient is a third value, so 'the mass' is not one number", () => {
  // Without this the row reads as a two-way confusion. There are three coefficients at one speed.
  const longitudinal = value(longitudinalMass(M, BETA));
  expect(longitudinal).toBeCloseTo(GAMMA ** 3 * M, 12);
  expect(longitudinal).toBeCloseTo(1.953125, 12);
  expect(longitudinal).not.toBeCloseTo(value(transverseMassComoving(M, BETA)), 6);
  expect(longitudinal).not.toBeCloseTo(value(transverseMassLaboratory(M, BETA)), 6);
});
