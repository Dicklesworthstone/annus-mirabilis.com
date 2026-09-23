/**
 * One case per refusal in photoelectricData.ts. Each case asserts the code AND the message,
 * because the lq-08 data workbench shows the message to a reader and it must not change when a
 * code is added.
 *
 * Every case changes ROWS, EQUAL or REFERENCE, which the control proves are accepted, only as
 * far as it must to reach its own site: one field for the validation sites, and the constants
 * (plus the rows, for the last) for the two overflow sites. With a site removed, the analysis
 * either succeeds or is refused by a later site under a different code.
 */

import { describe, expect, test } from "bun:test";
import {
  analyzePhotoelectricData,
  type FitOptions,
  PhotoelectricDataError,
  type PhotoelectricObservation,
  type PhotoelectricReference,
} from "./photoelectricData.ts";

const REFERENCE: PhotoelectricReference = {
  constantSetId: "test-si",
  elementaryCharge: 1.602176634e-19,
  planckConstant: 6.62607015e-34,
  speedOfLight: 299792458,
};
const ROW1: PhotoelectricObservation = { row: 1, frequencyTHz: 600, stoppingV: 0.5 };
const ROW2: PhotoelectricObservation = { row: 2, frequencyTHz: 700, stoppingV: 0.9 };
const ROW3: PhotoelectricObservation = { row: 3, frequencyTHz: 800, stoppingV: 1.31 };
const ROWS: readonly PhotoelectricObservation[] = [ROW1, ROW2, ROW3];
const EQUAL: FitOptions = { weighting: "equal", offset: { kind: "unknown" } };

/** Runs `run` and returns whatever it threw, or undefined if it returned. */
function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (err) {
    return err;
  }
  return undefined;
}

function expectRefusal(
  rows: readonly PhotoelectricObservation[],
  options: FitOptions,
  reference: PhotoelectricReference,
  code: string,
  message: string,
): void {
  const err = caught(() => analyzePhotoelectricData(rows, options, reference));
  expect(err).toBeInstanceOf(PhotoelectricDataError);
  expect((err as PhotoelectricDataError).code).toBe(code);
  expect((err as PhotoelectricDataError).message).toBe(message);
}

describe("photoelectricData refusals", () => {
  test("control: the base record is accepted with a positive slope", () => {
    const fit = analyzePhotoelectricData(ROWS, EQUAL, REFERENCE);
    expect(fit.status).toBe("value");
  });

  test("photoelectric-reference-invalid: a zero elementary charge is refused", () => {
    expectRefusal(
      ROWS,
      EQUAL,
      { ...REFERENCE, elementaryCharge: 0 },
      "photoelectric-reference-invalid",
      "The reference constants must come from a declared positive finite calibration.",
    );
  });

  test("photoelectric-weighting-unknown: an undeclared weighting is refused", () => {
    expectRefusal(
      ROWS,
      { ...EQUAL, weighting: "median" } as unknown as FitOptions,
      REFERENCE,
      "photoelectric-weighting-unknown",
      "Unknown weighting model.",
    );
  });

  test("photoelectric-offset-model-unknown: an undeclared offset model is refused", () => {
    expectRefusal(
      ROWS,
      { ...EQUAL, offset: { kind: "guessed" } } as unknown as FitOptions,
      REFERENCE,
      "photoelectric-offset-model-unknown",
      "Unknown offset model.",
    );
  });

  test("photoelectric-offset-out-of-range: a 20000 V known offset is refused", () => {
    expectRefusal(
      ROWS,
      { weighting: "equal", offset: { kind: "known", volts: 20000, sigmaV: 0 } },
      REFERENCE,
      "photoelectric-offset-out-of-range",
      "Use an offset within ±10000 V and a nonnegative standard uncertainty up to 10000 V.",
    );
  });

  test("photoelectric-row-count: two observations are refused", () => {
    expectRefusal(
      ROWS.slice(0, 2),
      EQUAL,
      REFERENCE,
      "photoelectric-row-count",
      "Select 3 to 1000 observations.",
    );
  });

  test("photoelectric-row-identity: a repeated row identity is refused", () => {
    expectRefusal(
      [ROW1, { ...ROW2, row: 1 }, ROW3],
      EQUAL,
      REFERENCE,
      "photoelectric-row-identity",
      "Each observation needs a unique positive row identity.",
    );
  });

  test("photoelectric-observation-out-of-range: a zero frequency is refused", () => {
    expectRefusal(
      [ROW1, { ...ROW2, frequencyTHz: 0 }, ROW3],
      EQUAL,
      REFERENCE,
      "photoelectric-observation-out-of-range",
      "Observation outside the admitted frequency or voltage range.",
    );
  });

  test("photoelectric-sigma-invalid: a zero voltage uncertainty is refused", () => {
    expectRefusal(
      [ROW1, { ...ROW2, sigmaV: 0 }, ROW3],
      EQUAL,
      REFERENCE,
      "photoelectric-sigma-invalid",
      "Invalid voltage standard uncertainty.",
    );
  });

  test("photoelectric-sigma-required: uncertainty weighting without sigma_V is refused", () => {
    expectRefusal(
      ROWS,
      { ...EQUAL, weighting: "declared-sigma" },
      REFERENCE,
      "photoelectric-sigma-required",
      "Supply sigma_V for every row before selecting uncertainty weighting.",
    );
  });

  test("photoelectric-reference-comparison-nonfinite: h/e overflowing binary64 is refused", () => {
    expectRefusal(
      ROWS,
      EQUAL,
      { ...REFERENCE, planckConstant: 1e300, elementaryCharge: 1e-300 },
      "photoelectric-reference-comparison-nonfinite",
      "Reference comparison is not numerically representable.",
    );
  });

  test("photoelectric-inferred-nonfinite: an h estimate overflowing binary64 is refused", () => {
    // e = 1e308 times a 5e9 V/THz slope overflows before the division by 1e12, while h/e stays
    // finite (1e300 / 1e308 * 1e12 = 1e4), so the reference comparison above does not fire first.
    expectRefusal(
      [
        { row: 1, frequencyTHz: 1e-6, stoppingV: 0 },
        { row: 2, frequencyTHz: 2e-6, stoppingV: 5000 },
        { row: 3, frequencyTHz: 3e-6, stoppingV: 10000 },
      ],
      EQUAL,
      { ...REFERENCE, planckConstant: 1e300, elementaryCharge: 1e308 },
      "photoelectric-inferred-nonfinite",
      "An inferred quantity exceeds numerical precision.",
    );
  });
});
