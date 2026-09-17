import { describe, it } from "bun:test";
import { formatConstantSetDependentValue, type ConstantSetDependentValue } from "./format.ts";

describe("Type-level tests for ConstantSetDependentValue (am-ver-precision-display-5e5)", () => {
  it("compiles when constantSetId is provided", () => {
    const valid: ConstantSetDependentValue = {
      value: 1.0,
      unit: "m",
      constantSetId: "modern-si-2019",
    };
    formatConstantSetDependentValue(valid);
  });

  // Type-level assertion:
  // The following line would fail TypeScript compilation if uncommented:
  // const invalid: ConstantSetDependentValue = { value: 1.0, unit: "m" };
});
