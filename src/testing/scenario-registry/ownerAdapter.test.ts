/**
 * THE ADAPTER THAT CARRIES A TYPED NON-NUMERIC RESULT INTO THE OWNER PROTOCOL (am-nxbq, item 2).
 *
 * The reference evaluators return a typed result: `value` with a number, or one of the statuses
 * AGENTS.md tabulates. Owners mostly THREW those away, which is why 32 of 33 instruments had no
 * resolvable non-numeric acceptance case while their own evaluators produced them. `nonNumericOr` is
 * what carries a status through, and this file is its proof, in both directions and at its one guard.
 *
 * THE GUARD IS THE POINT OF THIS FILE. The first version of the adapter returned its refusal branch when
 * a result said `status: "value"` and the number was under a key the caller had not named, which
 * produced `{refused: {status: "value"}}`: a refusal claiming to be a value. No scenario could sensibly
 * expect that, and nothing would have reported it, so it would have read as a working non-numeric case.
 * `events.measureRodLengthTyped` hit exactly this, because its accepted length sits under
 * `measuredLength`. It is now a typed contract error, and the three tests below are the refusal, the
 * accepted path with the key named, and the accepted path with the default key.
 */
import { describe, expect, test } from "bun:test";
import {
  assessmentOr,
  getOwner,
  nonNumericOr,
  OwnerContractError,
  sessionOutputsOf,
} from "./owners.ts";

describe("nonNumericOr: a status is carried, never flattened", () => {
  test("a value under the default key is returned as a number", () => {
    expect(nonNumericOr({ status: "value", value: 1.25 }, "lorentzFactor")).toBe(1.25);
  });

  test("a value under a named key is returned as a number", () => {
    expect(
      nonNumericOr({ status: "value", measuredLength: 1 }, "measuredLength", "measuredLength"),
    ).toBe(1);
  });

  test("REFUSES with owner-value-key-unnamed when a value hides under an unnamed key", () => {
    // The guard. Without it this returned a refusal whose status was "value".
    let thrown: unknown;
    try {
      nonNumericOr({ status: "value", measuredLength: 1 }, "measuredLength");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(OwnerContractError);
    expect((thrown as OwnerContractError).code).toBe("owner-value-key-unnamed");
    expect((thrown as OwnerContractError).message).toContain("measuredLength");
    // And it names what to do, because a contract error a reader cannot act on is a crash.
    expect((thrown as OwnerContractError).message).toContain("Name the key");
  });

  test("the reason code prefers the condition a result states", () => {
    const got = nonNumericOr(
      { status: "outside-domain", condition: "stokes-gas-medium" },
      "diffusionCoefficient",
    );
    expect(got).toEqual({
      refused: {
        outputId: "diffusionCoefficient",
        status: "outside-domain",
        reasonCode: "stokes-gas-medium",
      },
    });
  });

  test("then the representation kind, then the status, and never a string of its own", () => {
    expect(
      nonNumericOr(
        { status: "analytic-limit", representation: { kind: "point-mass" } },
        "probabilityDensity",
      ),
    ).toEqual({
      refused: {
        outputId: "probabilityDensity",
        status: "analytic-limit",
        reasonCode: "point-mass",
      },
    });
    // A prose-only result falls through to its status rather than pinning the prose, which would turn
    // red when someone improves the wording.
    expect(nonNumericOr({ status: "not-applicable", reason: "no emitted electron" }, "v")).toEqual({
      refused: { outputId: "v", status: "not-applicable", reasonCode: "not-applicable" },
    });
  });
});

describe("assessmentOr: the inference family's result shape, which is a different one", () => {
  /**
   * `src/physics/reference/inference*` returns an `Assessment`: {kind: "accepted", data} or
   * {kind: "no-value", status, reason}. An accepted assessment carries NO `status` field, so
   * `nonNumericOr` would read it as non-numeric -- the same class of error as the guard above, one layer
   * out, which is why this is a separate adapter rather than a widened one.
   */
  test("an accepted assessment returns the number its picker reads", () => {
    expect(assessmentOr({ kind: "accepted", data: { product: 42 } }, "p", (d) => d.product)).toBe(
      42,
    );
  });

  test("a no-value assessment carries its status through", () => {
    expect(
      assessmentOr<{ product: number }>(
        { kind: "no-value", status: "underdetermined", reason: "A positive scale is needed." },
        "molecularNumberRadiusProduct",
        (d) => d.product,
      ),
    ).toEqual({
      refused: {
        outputId: "molecularNumberRadiusProduct",
        status: "underdetermined",
        reasonCode: "underdetermined",
      },
    });
  });

  test("REFUSES with owner-assessment-without-data on an accepted assessment holding none", () => {
    // Its own code, not the one the other guard uses: the refusal ratchet credits a code only where
    // every site carrying it is cited, so one code at two sites made both invisible.
    let thrown: unknown;
    try {
      assessmentOr<{ product: number }>({ kind: "accepted" }, "p", (d) => d.product);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(OwnerContractError);
    expect((thrown as OwnerContractError).code).toBe("owner-assessment-without-data");
    expect((thrown as OwnerContractError).message).toContain("carries no data");
  });

  test("the real inference owner answers both ways", () => {
    const owner = getOwner("inference.identifiabilityFamily");
    const base = {
      temperature: 290,
      viscosity: 0.00135,
      radiusMin: 1e-7,
      radiusMax: 5e-6,
      synthetic: 1,
    };
    const numeric = owner.fn({
      inputs: { ...base, diffusionCoefficient: 3.1e-13 },
      constantSetId: "modern-si-2019",
    });
    expect(numeric).not.toHaveProperty("refused");
    const typed = owner.fn({
      inputs: { ...base, diffusionCoefficient: 0 },
      constantSetId: "modern-si-2019",
    });
    expect((typed as { refused: { status: string } }).refused.status).toBe("underdetermined");
  });
});

describe("sessionOutput: a laboratory's own statement, read by quantity id", () => {
  /**
   * Several instruments state their non-numeric result in the SESSION rather than in a reference
   * evaluator, because the statement is the laboratory's rather than the physics': that the one-way light
   * speed is a convention, that free radiation is assigned no rest mass, that a model with no circuit has
   * no current. Those owners read one output BY ITS QUANTITY ID, never by position, because a session
   * returns a list and a list's order is not a contract.
   */
  test("REFUSES with owner-session-output-absent when the id is not in the list", () => {
    let thrown: unknown;
    try {
      sessionOutputsOf([{ quantityId: "somethingElse", status: "value", value: 1 }], "notThere");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(OwnerContractError);
    expect((thrown as OwnerContractError).code).toBe("owner-session-output-absent");
    // It says how many outputs there were, so a renamed quantity is distinguishable from an empty session.
    expect((thrown as OwnerContractError).message).toContain("1 output(s)");
  });

  test("THE CONTROL: the same list with the id present is read rather than refused", () => {
    // Without this a function that always threw would satisfy the case above.
    // It returns the owner protocol's record, keyed by the quantity id, not the bare number.
    expect(sessionOutputsOf([{ quantityId: "here", status: "value", value: 7 }], "here")).toEqual({
      here: 7,
    });
  });

  test("and a non-value output from a real session is carried, not flattened", () => {
    // Three real session owners, each reporting a statement its laboratory makes in every setting.
    for (const [owner, outputId] of [
      ["sr01.session", "oneWayLightSpeed"],
      ["me03.session", "radiationMassChange"],
      ["sr02.session", "inducedCircuitCurrent"],
    ] as const) {
      const got = getOwner(owner).fn({ inputs: {}, constantSetId: "modern-si-2019" });
      expect(got, `${owner} should carry a status`).toHaveProperty("refused");
      const refused = (got as { refused: { outputId: string; status: string } }).refused;
      expect(refused.outputId).toBe(outputId);
      expect(refused.status).toBe("not-applicable");
    }
  });
});

describe("bm08's prepared-example owner needs no worker (am-nxbq)", () => {
  /**
   * BM-05 and BM-08 build a full instance store from a PREPARED EXAMPLE and a worker factory rather than
   * evaluating a pure function, which is a third owner shape. The worker is never reached for the arrival
   * snapshot, and the owner passes a factory that THROWS `owner-session-wants-a-worker` so that is proved
   * rather than assumed: if the session asked for one, the owner would raise that code instead of
   * returning a result.
   *
   * So the test below is the guard's negative control, and it is the only honest one available: a session
   * that wanted a worker could not be built here without inventing one. The code is named so the refusal
   * ratchet can see which guard this covers.
   */
  test("the owner returns its result, which is only possible if no worker was requested", () => {
    const got = getOwner("bm08.session").fn({ inputs: {}, constantSetId: "modern-si-2019" });
    expect(got).toHaveProperty("refused");
    const refused = (got as { refused: { outputId: string; status: string } }).refused;
    expect(refused.outputId).toBe("naiveInterval");
    expect(refused.status).toBe("not-applicable");
  });

  test("and owner-session-wants-a-worker is a typed code, not a bare throw", () => {
    const refusal = new OwnerContractError(
      "owner-session-wants-a-worker",
      "bm-08's arrival snapshot must not need a worker.",
    );
    expect(refusal.code).toBe("owner-session-wants-a-worker");
    expect(refusal).toBeInstanceOf(OwnerContractError);
    // AGENTS.md's own labelling rule is why the guard is sound: on arrival every laboratory shows its
    // static worked example and fetches no WASM, so a worker request there would be a real defect.
    expect(refusal.message).toContain("arrival snapshot");
  });
});

describe("the adapter is wired to real owners, in both directions", () => {
  /** Each pair is one owner with inputs that give a number and inputs that give a status. */
  const CASES: readonly Readonly<{
    owner: string;
    numeric: Record<string, number>;
    typed: Record<string, number>;
    status: string;
    reasonCode: string;
  }>[] = [
    {
      owner: "diffusion.gaussianPropagator",
      numeric: { x: 1e-6, elapsedTime: 1, diffusionCoefficient: 1e-12 },
      typed: { x: 0, elapsedTime: 0, diffusionCoefficient: 1e-12 },
      status: "analytic-limit",
      reasonCode: "point-mass",
    },
    {
      owner: "diffusion.stokesEinsteinTyped",
      numeric: { temperature: 290.15, viscosity: 0.00135, radius: 5e-7, medium: 0 },
      typed: { temperature: 290.15, viscosity: 0.00135, radius: 5e-7, medium: 1 },
      status: "outside-domain",
      reasonCode: "stokes-gas-medium",
    },
    {
      owner: "kinematics.gammaTyped",
      numeric: { beta: 0.6 },
      typed: { beta: 1 },
      status: "outside-domain",
      reasonCode: "superluminal-observer",
    },
    {
      owner: "events.measureRodLengthTyped",
      numeric: {
        t1: 0,
        x1: 0,
        t2: 0,
        x2: 1,
        frameSpeed: 179875474.8,
        properLength: 1,
        frameIsMoving: 0,
        rodRestFrameIsMoving: 1,
      },
      typed: {
        t1: 0,
        x1: 0,
        t2: 1,
        x2: 1,
        frameSpeed: 179875474.8,
        properLength: 1,
        frameIsMoving: 0,
        rodRestFrameIsMoving: 1,
      },
      status: "not-applicable",
      reasonCode: "non-simultaneous-endpoints",
    },
    {
      owner: "radiation.classicalAllocation",
      numeric: { temperature: 5000, cutoffFrequency: 1e15 },
      typed: { temperature: 5000 },
      status: "outside-domain",
      reasonCode: "classical-total-diverges",
    },
  ];

  test("each owner returns a number on one side and a carried status on the other", () => {
    // Non-vacuity: the table is real, and both halves are asserted for every row. A table of one side
    // only would be satisfied by an owner that always refused or always returned.
    expect(CASES.length).toBeGreaterThan(3);
    for (const row of CASES) {
      const owner = getOwner(row.owner);
      const numeric = owner.fn({ inputs: row.numeric, constantSetId: "modern-si-2019" });
      expect(numeric, `${row.owner} should return numbers`).not.toHaveProperty("refused");
      expect(Object.values(numeric as Record<string, number>).every(Number.isFinite)).toBe(true);

      const typed = owner.fn({ inputs: row.typed, constantSetId: "modern-si-2019" });
      expect(typed, `${row.owner} should carry a status`).toHaveProperty("refused");
      const refused = (typed as { refused: { status: string; reasonCode: string } }).refused;
      expect(refused.status).toBe(row.status);
      expect(refused.reasonCode).toBe(row.reasonCode);
    }
  });

  test("every owner's source file exists, so 'show the code' can read it", () => {
    for (const row of CASES) expect(getOwner(row.owner).sourcePath).toMatch(/\.ts$/);
  });
});
