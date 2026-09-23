/**
 * One case per refusal in lineFit.ts. Each case asserts the code AND the message, because the
 * message is what the Millikan laboratory and the lq-08 data workbench show a reader, and it
 * must not change when a code is added.
 *
 * Every input differs from an accepted one in exactly one respect, so each case can only pass
 * by reaching its own site: with the site removed, the call either succeeds or is refused by a
 * later site under a different code.
 */

import { describe, expect, test } from "bun:test";
import { fitLine, fitOls, LineFitError } from "./lineFit.ts";

/** Runs `run` and returns whatever it threw, or undefined if it returned. */
function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (err) {
    return err;
  }
  return undefined;
}

function expectRefusal(run: () => unknown, code: string, message: string): void {
  const err = caught(run);
  expect(err).toBeInstanceOf(LineFitError);
  expect((err as LineFitError).code).toBe(code);
  expect((err as LineFitError).message).toBe(message);
}

describe("lineFit refusals", () => {
  test("control: three distinct finite points fit by both owners", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2.1 },
    ];
    expect(caught(() => fitOls(points))).toBeUndefined();
    expect(caught(() => fitLine(points, false))).toBeUndefined();
    expect(
      caught(() =>
        fitLine(
          points.map((p) => ({ ...p, sigma: 0.1 })),
          true,
        ),
      ),
    ).toBeUndefined();
  });

  test("ols-too-few-points: fitOls refuses two points", () => {
    expectRefusal(
      () =>
        fitOls([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]),
      "ols-too-few-points",
      "OLS fit requires at least 3 points; received 2",
    );
  });

  test("ols-zero-x-variance: fitOls refuses three points at one x", () => {
    expectRefusal(
      () =>
        fitOls([
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 1, y: 2 },
        ]),
      "ols-zero-x-variance",
      "Cannot fit OLS line: zero x-variance.",
    );
  });

  test("line-fit-row-count: fitLine refuses two rows", () => {
    expectRefusal(
      () =>
        fitLine(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          false,
        ),
      "line-fit-row-count",
      "Use 3 to 1000 rows.",
    );
  });

  test("line-fit-nonfinite-coordinate: fitLine refuses a NaN ordinate", () => {
    expectRefusal(
      () =>
        fitLine(
          [
            { x: 0, y: 0 },
            { x: 1, y: Number.NaN },
            { x: 2, y: 2 },
          ],
          false,
        ),
      "line-fit-nonfinite-coordinate",
      "Finite coordinates required.",
    );
  });

  test("line-fit-sigma-required: a weighted fit refuses a row with no sigma", () => {
    expectRefusal(
      () =>
        fitLine(
          [
            { x: 0, y: 0, sigma: 1 },
            { x: 1, y: 1 },
            { x: 2, y: 2, sigma: 1 },
          ],
          true,
        ),
      "line-fit-sigma-required",
      "Weighted fitting requires a positive finite sigma for every row.",
    );
  });

  test("line-fit-unresolved-x: fitLine refuses rows that share one x", () => {
    expectRefusal(
      () =>
        fitLine(
          [
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 1, y: 2 },
          ],
          false,
        ),
      "line-fit-unresolved-x",
      "Distinct, numerically resolved frequencies required.",
    );
  });

  test("line-fit-nonfinite-result: finite rows whose residual variance overflows are refused", () => {
    expectRefusal(
      () =>
        fitLine(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1e300 },
            { x: 2, y: -1e300 },
          ],
          false,
        ),
      "line-fit-nonfinite-result",
      "The requested fit exceeds finite numerical precision.",
    );
  });
});
