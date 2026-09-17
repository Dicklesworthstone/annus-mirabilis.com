import { describe, expect, it } from "bun:test";
import {
  formatUncertainty,
  spokenUncertainty,
  type UncertaintySpec,
} from "./uncertainty.ts";

describe("Uncertainty Kinds and Formatting (am-ver-precision-display-5e5)", () => {
  it("formats standard uncertainty (1-sigma) with ± and correct spoken form", () => {
    const spec: UncertaintySpec = { kind: "standard", value: 0.05 };
    expect(formatUncertainty(spec)).toBe("± 0.05");
    expect(spokenUncertainty(spec, "m")).toBe("plus or minus 0.05 metres");
  });

  it("formats coverage-95 (expanded 2-sigma) with explicit coverage label", () => {
    const spec: UncertaintySpec = { kind: "coverage-95", value: 0.1 };
    expect(formatUncertainty(spec)).toBe("± 0.1 (95% coverage)");
    expect(spokenUncertainty(spec, "s")).toBe("plus or minus 0.1 seconds at ninety-five percent confidence");
  });

  it("formats strict bounds with enclosure brackets and distinct spoken wording", () => {
    const spec: UncertaintySpec = { kind: "bounds", lower: 0.75, upper: 0.85 };
    expect(formatUncertainty(spec)).toBe("[0.75, 0.85]");
    expect(spokenUncertainty(spec, "μm")).toBe("bounded between 0.75 and 0.85 micrometres");
  });

  it("formats rough estimate with approx.", () => {
    const spec: UncertaintySpec = { kind: "estimate" };
    expect(formatUncertainty(spec)).toBe("approx.");
    expect(spokenUncertainty(spec)).toBe("approximately");
  });

  it("formats discrete count with exact count", () => {
    const spec: UncertaintySpec = { kind: "discrete-count" };
    expect(formatUncertainty(spec)).toBe("(exact count)");
    expect(spokenUncertainty(spec)).toBe("exact count");
  });

  it("formats exact defined constant with defining relation", () => {
    const spec: UncertaintySpec = {
      kind: "exact-definition",
      definingRelation: "c = 299792458 m/s",
    };
    expect(formatUncertainty(spec)).toBe("(exact: c = 299792458 m/s)");
    expect(spokenUncertainty(spec)).toBe("exact by definition, c = 299792458 m/s");
  });

  it("strictly separates statistical intervals from strict bounds (never uses bounds wording for standard uncertainty)", () => {
    const standard: UncertaintySpec = { kind: "standard", value: 0.02 };
    const bounds: UncertaintySpec = { kind: "bounds", lower: 0.98, upper: 1.02 };

    const standardSpoken = spokenUncertainty(standard, "m");
    const boundsSpoken = spokenUncertainty(bounds, "m");

    expect(standardSpoken).toContain("plus or minus");
    expect(standardSpoken).not.toContain("bounded between");

    expect(boundsSpoken).toContain("bounded between");
    expect(boundsSpoken).not.toContain("plus or minus");
  });
});
