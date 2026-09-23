import { describe, expect, test } from "bun:test";
import {
  exponentialParts,
  exponentialSpoken,
  exponentialText,
  naturalLogSpoken,
  partsFromNaturalLog,
} from "./scientific.ts";

const M = "−";

describe("exponentialParts", () => {
  // Inputs are the toExponential calls behind strings measured on the 14:24:47 build.
  test("a mean energy keeps its six fraction digits and gains a real power of ten", () => {
    expect(exponentialParts(2.070974e-20, 6)).toEqual({
      kind: "scientific",
      mantissa: "2.070974",
      exponent: `${M}20`,
    });
  });

  test("a share near one is written as the decimal it is", () => {
    // Printed as "9.990000e-1" on /lab/lq-02/.
    expect(exponentialParts(0.999, 6)).toEqual({ kind: "plain", text: "0.9990000" });
  });

  test("an exponent of zero draws no power of ten", () => {
    expect(exponentialParts(6.439187, 6)).toEqual({ kind: "plain", text: "6.439187" });
    expect(exponentialParts(0, 6)).toEqual({ kind: "plain", text: "0.000000" });
  });

  test("negative values use the minus sign, not a hyphen", () => {
    const parts = exponentialParts(-1.799e8, 3);
    expect(parts).toEqual({ kind: "scientific", mantissa: `${M}1.799`, exponent: "8" });
    expect(exponentialParts(-0.36, 3)).toEqual({ kind: "plain", text: `${M}0.3600` });
  });

  test("a positive shift never invents digits the caller did not keep", () => {
    // 1.0e+3 kept two significant figures; "1000" would claim four.
    expect(exponentialParts(1000, 1).kind).toBe("scientific");
    // 5.0e+1 fills its one shifted place with a kept digit.
    expect(exponentialParts(50, 1)).toEqual({ kind: "plain", text: "50" });
    expect(exponentialParts(507223.7, 6)).toEqual({
      kind: "scientific",
      mantissa: "5.072237",
      exponent: "5",
    });
  });

  test("no finite value comes back carrying toExponential's 'e'", () => {
    const samples = [
      [1.3806e-23, 4],
      [4.047373e-6, 6],
      [6.2e-2, 4],
      [1e14, 3],
      [-2.5017e-9, 4],
      [8.8776e11, 4],
      [3.7, undefined],
      [1e-4, undefined],
    ] as const;
    for (const [value, digits] of samples) {
      const parts = exponentialParts(value, digits);
      const shown = parts.kind === "plain" ? parts.text : parts.mantissa + parts.exponent;
      expect(shown).not.toMatch(/e/i);
      expect(shown).not.toContain("-");
    }
    expect(samples.length).toBeGreaterThan(0);
  });

  test("the digits are exactly toExponential's, so precision is unchanged", () => {
    for (const digits of [0, 2, 4, 6, 8]) {
      const value = 6.02214076e23;
      const parts = exponentialParts(value, digits);
      expect(parts.kind).toBe("scientific");
      if (parts.kind === "scientific") {
        expect(parts.mantissa).toBe(value.toExponential(digits).split("e")[0]);
      }
    }
  });

  test("non-finite input is passed through for the caller to refuse", () => {
    expect(exponentialParts(Number.NaN, 3)).toEqual({ kind: "plain", text: "NaN" });
  });
});

describe("spoken and one-line forms", () => {
  test("the spoken form says 'to the power', never a bare minus after ten", () => {
    expect(exponentialSpoken(2.070974e-20, 6)).toBe("2.070974 times 10 to the power minus 20");
    expect(exponentialSpoken(-0.36, 3)).toBe("minus 0.3600");
  });

  test("the one-line form marks the exponent", () => {
    expect(exponentialText(2.070974e-20, 6)).toBe(`2.070974 × 10^${M}20`);
    expect(exponentialText(0.999, 6)).toBe("0.9990000");
  });
});

describe("partsFromNaturalLog", () => {
  // /lab/lq-03/ at a 1e300 Hz probe printed "below double-precision range; ln(value) =
  // -9.598486147758314e+285 (natural log of …)", and "below" for the classical ln of +2644 too.
  test("a number beyond double precision is a power of ten, above the range as well as below it", () => {
    expect(partsFromNaturalLog(2644.13217, 3)).toEqual({
      kind: "scientific",
      mantissa: "2.148",
      exponent: "1148",
    });
    expect(partsFromNaturalLog(-921.034037, 3)).toEqual({
      kind: "scientific",
      mantissa: "1.000",
      exponent: `${M}400`,
    });
  });

  test("it agrees with toExponential wherever the number is representable", () => {
    for (const v of [1.5e-200, 2.070974e-20, 6.02214076e23, 9.1e250]) {
      const direct = exponentialParts(v, 3);
      expect(direct.kind).toBe("scientific");
      if (direct.kind !== "scientific") continue;
      expect(partsFromNaturalLog(Math.log(v), 3)).toEqual({
        kind: "scientific",
        mantissa: direct.mantissa,
        exponent: direct.exponent,
      });
    }
  });

  test("a mantissa that rounds up to ten carries into the exponent", () => {
    expect(partsFromNaturalLog(Math.log(9.9996e5), 3)).toEqual({
      kind: "scientific",
      mantissa: "1.000",
      exponent: "6",
    });
  });

  test("past the precision of the exponent only the exponent is written, itself in scientific form", () => {
    expect(partsFromNaturalLog(-9.598486147758314e285, 3)).toEqual({
      kind: "power",
      exponent: { kind: "scientific", mantissa: `${M}4.169`, exponent: "285" },
    });
    expect(naturalLogSpoken(-9.598486147758314e285, 3)).toBe(
      "10 to the power minus 4.169 times 10 to the power 285",
    );
  });
});
