import { describe, expect, it } from "bun:test";
import {
  applyLocale,
  formatCleanNumber,
  formatConstantSetComparison,
  formatConstantSetDependentValue,
  formatGuardDigit,
  formatQuantityValue,
  formatSignificantFigures,
} from "./format.ts";

describe("Precision & Format Display (am-ver-precision-display-5e5)", () => {
  it("suppresses IEEE-754 floating noise", () => {
    expect(formatCleanNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatCleanNumber(0.30000000000000004)).toBe("0.3");
    expect(formatCleanNumber(1.0000000000000002)).toBe("1");
  });

  it("formats Einstein Brownian displacement examples under historical and modern constant sets", () => {
    // Einstein 1905 printed values:
    // t = 1 s: sqrt(<x^2>) = 0.7947833 μm
    // t = 60 s: sqrt(<x^2>) = 6.156365 μm
    const historicalT1 = 0.7947833;
    const historicalT60 = 6.156365;

    // 1. Default approximate format (1 sig fig): "about 0.8" and "about 6"
    expect(formatSignificantFigures(historicalT1, 1)).toBe("0.8");
    expect(formatSignificantFigures(historicalT60, 1)).toBe("6");

    // 2. With marked guard digit (2 sig figs + guard digit or 2 sig figs):
    // t = 1 s -> "0.79", t = 60 s -> "6.2" (rounded from 6.156..., NEVER "6.1")
    expect(formatSignificantFigures(historicalT1, 2)).toBe("0.79");
    expect(formatSignificantFigures(historicalT60, 2)).toBe("6.2");

    // Guard digit marking
    const guardT1 = formatGuardDigit(historicalT1, 2);
    expect(guardT1.formatted).toBe("0.795"); // 3 digits with guard digit

    const guardT60 = formatGuardDigit(historicalT60, 2);
    expect(guardT60.formatted).toBe("6.16"); // 3 digits with guard digit

    // Modern SI 2019 values:
    // t = 1 s: 0.7935339 μm
    // t = 60 s: 6.146687 μm
    const modernT1 = 0.7935339;
    const modernT60 = 6.146687;

    expect(formatSignificantFigures(modernT1, 2)).toBe("0.79");
    // Under modern SI, 6.146687 rounds to 6.1 at 2 sig figs:
    expect(formatSignificantFigures(modernT60, 2)).toBe("6.1");

    // Constant-set comparison
    const comparisonT1 = formatConstantSetComparison(historicalT1, modernT1, "μm", { sigFigs: 3 });
    expect(comparisonT1).toBe("0.795 vs. 0.794 μm (below input precision)");

    const comparisonT60 = formatConstantSetComparison(historicalT60, modernT60, "μm", {
      sigFigs: 3,
    });
    expect(comparisonT60).toBe("6.16 vs. 6.15 μm (below input precision)");
  });

  it("formats constant-set-dependent quantities with explicit labels", () => {
    const formatted = formatConstantSetDependentValue(
      {
        value: 0.7947833,
        unit: "μm",
        constantSetId: "einstein-1905-brownian-printed",
        constantSetLabel: "Einstein 1905",
      },
      { sigFigs: 2 },
    );
    expect(formatted).toBe("0.79 μm (Einstein 1905)");
  });

  it("formats scientific notation for very small and very large magnitudes", () => {
    expect(formatSignificantFigures(5.2e-13, 3)).toBe("5.20 × 10^-13");
    expect(formatSignificantFigures(3.0e8, 3)).toBe("3.00 × 10^8");
  });

  it("supports German locale with decimal comma without changing numeric transport", () => {
    expect(formatSignificantFigures(0.79478, 3, { locale: "de-DE" })).toBe("0,795");
    expect(formatCleanNumber(12.345, 3, "de-DE")).toBe("12,345");
  });
});
