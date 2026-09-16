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
});
