/**
 * EVERY REFUSAL THROW SITE IN owners.ts, DRIVEN (am-muyh, and am-ksl3 for the citations).
 *
 * WHY THIS FILE EXISTS AND WHAT IT REPLACED. Twenty-two acceptance-case batches added six parameter
 * builders to owners.ts, each with its own copy of the same two throws, and the untested-refusal ratchet
 * refused the file: 23 untested sites under five codes, with no recorded baseline. Raising a baseline
 * would have recorded the duplication as a debt; collapsing the six builders into one `ownerParams` and
 * one `refuseUnknownInputs` removed eleven of the sites outright, and this file drives the twelve that
 * remain. That order matters - the ratchet was asking for the refactor, and only what survived it needs a
 * test.
 *
 * WHY EVERY TITLE CARRIES A LINE. am-ksl3: where one code appears at several sites in a file, an
 * UNCITED test credits none of them, because naming `owner-value-key-unnamed` cannot say which of its
 * five sites was driven. Four of this file's five codes are multi-site, so each title names
 * `(owners.ts:LINE)`. The citations are therefore load-bearing and will go stale if owners.ts moves: the
 * ratchet audits them and reports a citation that no longer lands on a site with that code, so a stale
 * one is visible rather than silently uncredited.
 *
 * AND THAT IS WHY THIS DOCBLOCK SAYS "owners.ts lines 658 and 721" RATHER THAN THE PARENTHESISED FORM.
 * The audit reads a citation's own BLOCK to check it names the matching code, splitting the file on
 * `test(`, so everything above the first test is one block - and this docblock names
 * owner-value-key-unnamed while explaining am-ksl3. A `(owners.ts:721)` up here was therefore read as a
 * citation from a block that never names owner-session-output-absent, and reported as code-mismatched.
 * Prose about a line is not a citation of it, and the form is what distinguishes them.
 *
 * TWO OF THE TWELVE ARE NOT MINE. `nonNumericOr` and `sessionOutputsOf`, at owners.ts lines 658 and 721,
 * predate this work and were credited while their codes had one site each. Adding further sites under the
 * same codes withdrew that credit, which is am-ksl3 behaving as designed rather than a regression in
 * them; they are driven here for the same reason as the rest.
 *
 * WHAT THESE TESTS ARE NOT. They assert that each guard fires and names its code. They do not assert that
 * the guard is in the right place, and a guard that fired on every input would pass every test here. The
 * accept half is what excludes that, so each refusal is paired with a call that must NOT throw.
 */
import { describe, expect, test } from "bun:test";
import {
  getOwner,
  type MillikanDocument,
  millikanObservations,
  nonNumericOr,
  OwnerContractError,
  sessionOutputsOf,
  sr12VectorComponent,
  trajectoryFinalPair,
} from "./owners.ts";

/** The code a thrown OwnerContractError carries, or a readable failure if it threw something else. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof OwnerContractError) return err.code;
    return `threw a ${(err as Error)?.constructor?.name ?? typeof err}, not an OwnerContractError`;
  }
  return "did not throw";
}

const MODERN = { constantSetId: "modern-si-2019" } as const;

describe("ownerParams: the shared builder for every laboratory with a categorical control", () => {
  test("(owners.ts:313) a categorical code that names no category is refused by name", () => {
    // SR-05 has three worldlines, so 9 is outside the list and the builder must say so rather than
    // silently taking the default, which would run the case at out-and-back while it claimed a circle.
    expect(
      codeOf(() => getOwner("sr05.clockReadings").fn({ inputs: { worldlineCode: 9 }, ...MODERN })),
    ).toBe("owner-mode-code-unknown");
  });

  test("(owners.ts:322) an input the laboratory has no parameter for is refused, not dropped", () => {
    // The accept half is below. This is the shape that matters most: an input silently ignored leaves
    // the scenario running at the defaults and PASSING while testing something other than it says.
    expect(
      codeOf(() =>
        getOwner("sr05.clockReadings").fn({ inputs: { speedOfLightInAVacuum: 1 }, ...MODERN }),
      ),
    ).toBe("owner-input-unknown");
  });

  test("every valid code and every real parameter is accepted, so the two guards above are not blanket", () => {
    for (const worldlineCode of [0, 1, 2]) {
      const got = getOwner("sr05.clockReadings").fn({
        inputs: { worldlineCode, speed: 0.6, coordinateDuration: 10 },
        ...MODERN,
      });
      expect(typeof got).toBe("object");
      expect("refused" in (got as object)).toBe(false);
    }
    // And a laboratory with four categories at once, to show the loop is over the map rather than one key.
    const sr13 = getOwner("sr13.dynamics").fn({
      inputs: {
        conventionCode: 1,
        massCode: 1,
        particleCode: 0,
        overlayCode: 2,
        initialSpeed: 0.6,
      },
      ...MODERN,
    });
    expect("refused" in (sr13 as object)).toBe(false);
  });
});

describe("refuseUnknownInputs: the same guard for owners that read a fixed list", () => {
  test("(owners.ts:494) an input outside the owner's declared list is refused by name", () => {
    expect(
      codeOf(() => getOwner("bm08.cameraMoments").fn({ inputs: { temperature: 300 }, ...MODERN })),
    ).toBe("owner-input-unknown");
  });

  test("(owners.ts:494) an owner that reads NO scenario input refuses any at all", () => {
    // The Millikan owner's rows come from the dataset file, so there is nothing a scenario may set.
    // Same site, different population: an empty known-list must still refuse rather than accept everything.
    expect(
      codeOf(() =>
        getOwner("photoelectric.millikanSodiumSlope").fn({ inputs: { rows: 5 }, ...MODERN }),
      ),
    ).toBe("owner-input-unknown");
  });

  test("the declared inputs are accepted, and the no-input owner accepts an empty record", () => {
    const moments = getOwner("bm08.cameraMoments").fn({
      inputs: { sigma: 2e-7, exposure: 0, d: 1, dt: 1 },
      ...MODERN,
    });
    expect("refused" in (moments as object)).toBe(false);
    const millikan = getOwner("photoelectric.millikanSodiumSlope").fn({ inputs: {}, ...MODERN });
    expect("refused" in (millikan as object)).toBe(false);
  });
});

describe("millikanObservations: reading the dataset's own declared rows", () => {
  // Named separately because MillikanDocument's `rows` and `fits` are OPTIONAL, and
  // exactOptionalPropertyTypes forbids handing a possibly-undefined value to an optional property. Reading
  // them off `good` would do exactly that.
  const rows = [
    { cells: [{ value: 5461 }, { value: "5.474e14" }, { value: -2.05 }] },
    { cells: [{ value: 4339 }, { value: "6.925e14" }, { value: -1.492 }] },
  ];
  const fits = [{ id: "millikan-1916-fig6-five-lines", rowsUsed: [0, 1] }];
  const good: MillikanDocument = { rows, fits };

  test("(owners.ts:406) a document with no rows is refused, and so is one with no declared fit", () => {
    expect(codeOf(() => millikanObservations({ rows: [], fits }))).toBe(
      "owner-session-output-absent",
    );
    // The other half of the same site's condition: rows present, the declared fit absent.
    expect(codeOf(() => millikanObservations({ rows, fits: [] }))).toBe(
      "owner-session-output-absent",
    );
    // And a fit under a DIFFERENT id does not count as the declared one.
    expect(
      codeOf(() => millikanObservations({ rows, fits: [{ id: "other", rowsUsed: [0] }] })),
    ).toBe("owner-session-output-absent");
  });

  test("(owners.ts:419) a declared row whose frequency or intercept is not a number is refused", () => {
    expect(
      codeOf(() =>
        millikanObservations({
          rows: [{ cells: [{ value: 5461 }, { value: "not a frequency" }, { value: -2.05 }] }],
          fits: [{ id: "millikan-1916-fig6-five-lines", rowsUsed: [0] }],
        }),
      ),
    ).toBe("owner-value-key-unnamed");
    // A row the declared fit names but the rows array does not hold reaches the same guard, because an
    // absent row yields no cells and so no numbers - which is the case a silent `?? 0` would hide.
    expect(
      codeOf(() =>
        millikanObservations({
          rows,
          fits: [{ id: "millikan-1916-fig6-five-lines", rowsUsed: [9] }],
        }),
      ),
    ).toBe("owner-value-key-unnamed");
  });

  test("a well-formed document yields 1-BASED row identities, since the fit refuses a zero", () => {
    const observations = millikanObservations(good);
    expect(observations.map((o) => o.row)).toEqual([1, 2]);
    expect(observations[0]?.frequencyTHz).toBeCloseTo(547.4, 6);
    expect(observations[0]?.stoppingV).toBe(-2.05);
  });
});

describe("trajectoryFinalPair: the last (x, y) of a flat trajectory array", () => {
  const pair = (value: unknown, status = "value") => [
    { quantityId: "trajectoryPositions", status, value },
  ];

  test("(owners.ts:437) an absent or refused trajectory has no final position", () => {
    expect(codeOf(() => trajectoryFinalPair([]))).toBe("owner-session-output-absent");
    expect(codeOf(() => trajectoryFinalPair(pair({ 0: 1, 1: 2 }, "outside-domain")))).toBe(
      "owner-session-output-absent",
    );
  });

  test("(owners.ts:444) a length that is not a whole number of pairs is refused", () => {
    expect(codeOf(() => trajectoryFinalPair(pair({ 0: 1, 1: 2, 2: 3, length: 3 })))).toBe(
      "owner-value-key-unnamed",
    );
    // Shorter than one pair, which is the other side of the same condition.
    expect(codeOf(() => trajectoryFinalPair(pair({ 0: 1, length: 1 })))).toBe(
      "owner-value-key-unnamed",
    );
  });

  test("(owners.ts:451) a final pair that is not two numbers is refused", () => {
    expect(
      codeOf(() => trajectoryFinalPair(pair({ 0: 1, 1: "two" as unknown as number, length: 2 }))),
    ).toBe("owner-value-key-unnamed");
  });

  test("a well-formed array gives its last pair, so none of the three guards is blanket", () => {
    expect(trajectoryFinalPair(pair({ 0: 1, 1: 2, 2: 3, 3: 4, length: 4 }))).toEqual([3, 4]);
  });
});

describe("sr12VectorComponent: one component of a vector output", () => {
  test("(owners.ts:467) an output the snapshot does not carry is refused by name", () => {
    expect(codeOf(() => sr12VectorComponent([], "currentDensityMoving", 0))).toBe(
      "owner-session-output-absent",
    );
  });

  test("(owners.ts:475) an accepted value whose component is not a number is refused", () => {
    expect(
      codeOf(() =>
        sr12VectorComponent(
          [{ quantityId: "currentDensityMoving", status: "value", value: { 0: "x" } }],
          "currentDensityMoving",
          0,
        ),
      ),
    ).toBe("owner-value-key-unnamed");
    // An index past the end reaches the same guard rather than returning undefined as a number.
    expect(
      codeOf(() =>
        sr12VectorComponent(
          [{ quantityId: "currentDensityMoving", status: "value", value: { 0: 1 } }],
          "currentDensityMoving",
          7,
        ),
      ),
    ).toBe("owner-value-key-unnamed");
  });

  test("a vector component is returned, and a REFUSED vector is passed through rather than thrown", () => {
    expect(
      sr12VectorComponent(
        [{ quantityId: "currentDensityMoving", status: "value", value: { 0: 1.25, 1: 0, 2: 0 } }],
        "currentDensityMoving",
        0,
      ),
    ).toBe(1.25);
    const refused = sr12VectorComponent(
      [
        {
          quantityId: "currentDensityMoving",
          status: "outside-domain",
          condition: "superluminal-speed",
        },
      ],
      "currentDensityMoving",
      0,
    );
    expect(typeof refused).toBe("object");
    expect((refused as { refused: { reasonCode: string } }).refused.reasonCode).toBe(
      "superluminal-speed",
    );
  });
});

describe("the two sites that predate this work, driven for the same reason", () => {
  test("(owners.ts:658) nonNumericOr refuses a value result with no number under the named key", () => {
    // owner-value-key-unnamed. A "value" result whose number is under a key the caller did not name is a
    // CALLER error, and the guard exists because the first version returned a refusal claiming status
    // "value" - which no scenario could sensibly expect and which read as a working non-numeric case.
    expect(codeOf(() => nonNumericOr({ status: "value", endpoints: [1, 2] }, "someOutput"))).toBe(
      "owner-value-key-unnamed",
    );
  });

  test("(owners.ts:721) sessionOutputsOf refuses an output the snapshot does not carry", () => {
    // owner-session-output-absent.
    expect(codeOf(() => sessionOutputsOf([{ quantityId: "a" }], "notPresent"))).toBe(
      "owner-session-output-absent",
    );
  });

  test("both accept their well-formed case", () => {
    expect(nonNumericOr({ status: "value", value: 42 }, "someOutput")).toBe(42);
    expect(sessionOutputsOf([{ quantityId: "a", status: "value", value: 7 }], "a")).toEqual({
      a: 7,
    });
  });
});
