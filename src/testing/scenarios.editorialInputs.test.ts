import { describe, expect, test } from "bun:test";
import { createDeclaredConstantSet } from "../physics/reference/constants.ts";
import { checkEditorialInputs } from "./scenario-registry/editorialInputs.ts";

const set = createDeclaredConstantSet({
  id: "scenario-editorial-check",
  era: 1905,
  provenance: "Self-test.",
  precisionNote: "Self-test.",
  gasConstantProvenance: "measured-without-counting-molecules",
  entries: [
    {
      quantityId: "molarGasConstant",
      value: 8.31,
      exactDecimal: "8.31",
      unit: "J/(mol K)",
      kind: "declared-scenario",
      evidentialRole: "measured-observation",
      provenance: "Editorial R.",
      dependsOn: [],
      uncertainty: 0.005,
    },
  ],
});

describe("editorial inputs", () => {
  test("agreement after unit conversion passes", () => {
    const checks = checkEditorialInputs(
      [
        {
          quantityId: "molarGasConstant",
          value: 8.31e7,
          unit: "erg/(mol K)",
          source: "editorial",
          reason: "CGS form of the same R.",
        },
      ],
      set,
    );
    expect(checks[0]?.check).toBe("agreed");
  });

  test("a genuinely different value fails and names both sources", () => {
    const checks = checkEditorialInputs(
      [
        {
          quantityId: "molarGasConstant",
          value: 8.314,
          unit: "J/(mol K)",
          source: "scenario file",
          reason: "wrong R",
        },
      ],
      set,
    );
    expect(checks[0]?.check).toBe("value-mismatch");
    expect(checks[0]?.message.includes("scenario-editorial-check")).toBe(true);
    expect(checks[0]?.message.includes("scenario file")).toBe(true);
  });

  test("an entry the set does not declare is not-declared-in-set", () => {
    const checks = checkEditorialInputs(
      [
        {
          quantityId: "speedOfLight",
          value: 3e8,
          unit: "m/s",
          source: "editorial",
          reason: "not in set",
        },
      ],
      set,
    );
    expect(checks[0]?.check).toBe("not-declared-in-set");
  });

  test("a printed quantity used as an editorial input fails", () => {
    const checks = checkEditorialInputs(
      [
        {
          quantityId: "molarGasConstant",
          value: 8.31,
          unit: "J/(mol K)",
          source: "editorial",
          reason: "claimed editorial",
        },
      ],
      set,
      new Set(["molarGasConstant"]),
    );
    expect(checks[0]?.check).toBe("declared-printed");
  });

  /**
   * THE CHECK THAT DID NOT EXIST UNTIL A PLANT STAYED GREEN (2026-10-06).
   *
   * diffusion-modern-viscosity-17c declares the IAPWS viscosity of water at 17 C as an editorial input and
   * also passes it as the scenario's own `viscosity` input. Planting a DISAGREEMENT - declaring the paper's
   * 1.35e-3 while the input stayed at 1.0798059e-3 - was expected to fail and passed, because every check
   * above compares the declared value against the CONSTANT SET and water viscosity is in no constant set:
   * the answer was `not-declared-in-set` and nothing looked further. So a record could cite a source for a
   * number the run never used.
   *
   * The new branch is checked BEFORE the constant-set ones, because the branch that hid it returns early.
   */
  const viscosityEntry = (value: number) => ({
    quantityId: "viscosity",
    value,
    unit: "Pa s",
    source: "iapws-2008-water-viscosity",
    reason: "The modern reference value for the liquid the paper names.",
  });

  test("an editorial input that contradicts the scenario's own input for the same quantity fails", () => {
    const checks = checkEditorialInputs([viscosityEntry(0.00135)], set, new Set(), {
      viscosity: { value: 0.0010798059, unit: "Pa s" },
    });
    expect(checks[0]?.check).toBe("input-mismatch");
    // The message must name both numbers, since the whole failure is that two places disagree.
    expect(checks[0]?.message).toContain("0.00135");
    expect(checks[0]?.message).toContain("0.0010798059");
  });

  test("THE ACCEPT HALF: the same quantity agreeing passes, so the check is not blanket", () => {
    const checks = checkEditorialInputs([viscosityEntry(0.0010798059)], set, new Set(), {
      viscosity: { value: 0.0010798059, unit: "Pa s" },
    });
    expect(checks[0]?.check).not.toBe("input-mismatch");
    expect(checks[0]?.check).toBe("not-declared-in-set");
  });

  test("agreement is compared in SI, so a unit difference is not a disagreement", () => {
    // Declared in micrometres and used in metres: the same length, and the check must not fire. Without
    // this, the first test above would pass on an implementation that compared raw numbers.
    const checks = checkEditorialInputs(
      [
        {
          quantityId: "particleRadius",
          value: 0.5,
          unit: "um",
          source: "editorial",
          reason: "Half a micron, as the paper's diameter implies.",
        },
      ],
      set,
      new Set(),
      { particleRadius: { value: 5.0e-7, unit: "m" } },
    );
    expect(checks[0]?.check).not.toBe("input-mismatch");
  });

  test("a quantity the scenario does not pass as an input is unaffected", () => {
    // molarGasConstant is an editorial input of diffusion-einstein-1905-printed and is NOT one of its
    // inputs, which is the common case. Omitting the inputs argument entirely must behave as before.
    const entry = {
      quantityId: "molarGasConstant",
      value: 8.31,
      unit: "J/(mol K)",
      source: "editorial",
      reason: "As used with the paper's printed N.",
    };
    expect(checkEditorialInputs([entry], set)[0]?.check).toBe("agreed");
    expect(checkEditorialInputs([entry], set, new Set(), {})[0]?.check).toBe("agreed");
    // And present under a DIFFERENT key, which must not be read as the same quantity.
    expect(
      checkEditorialInputs([entry], set, new Set(), {
        temperature: { value: 290.15, unit: "K" },
      })[0]?.check,
    ).toBe("agreed");
  });
});
