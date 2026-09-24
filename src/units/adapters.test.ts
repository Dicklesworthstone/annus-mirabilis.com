import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  conversionFactor,
  convertExact,
  convertTemperatureDelta,
  convertTemperatureValue,
  convertValue,
  inverseConversionFactor,
  parseExactDecimal,
  UnitConversionError,
} from "./adapters.ts";

describe("exact conversions", () => {
  test("1.35e-2 P is exactly 1.35e-3 Pa*s (Einstein's printed suspension viscosity)", () => {
    expect(convertExact("1.35e-2", "P", "Pa*s")).toBe("0.00135");
  });
  test("1 ls is exactly 299792458 m", () => {
    expect(convertExact("1", "ls", "m")).toBe("299792458");
  });
  test("1 eV in J keeps every printed digit", () => {
    expect(convertExact("1", "eV", "J")).toBe("0.0000000000000000001602176634");
  });
  test("1 erg is exactly 1e-7 J", () => {
    expect(convertExact("1", "erg", "J")).toBe("0.0000001");
  });
  test("m to um, nm, cm are exact", () => {
    expect(conversionFactor("m", "um").exactness).toBe("exact");
    expect(conversionFactor("m", "nm").exactness).toBe("exact");
    expect(conversionFactor("m", "cm").exactness).toBe("exact");
  });
  test("the inverse factor for m to um is exactly 1e-6", () => {
    const { factor } = conversionFactor("um", "m");
    expect(factor.num).toBe(1n);
    expect(factor.den).toBe(1_000_000n);
  });
  test("1 eV*s in J*s keeps every printed digit, so h can be given in either", () => {
    expect(convertExact("1", "eV*s", "J*s")).toBe("0.0000000000000000001602176634");
    expect(conversionFactor("eV*s", "J*s").exactness).toBe("exact");
  });
  test("a count per second is its own family: never converted to or from hertz or an action", () => {
    expect(convertExact("2.5e18", "1/s", "1/s")).toBe("2500000000000000000");
    for (const other of ["Hz", "J*s"])
      assert.throws(() => convertValue(1, "1/s", other), { code: "family-mismatch" });
  });
  test("Hz to THz and g to kg are exact", () => {
    expect(conversionFactor("Hz", "THz").exactness).toBe("exact");
    expect(conversionFactor("g", "kg").exactness).toBe("exact");
  });
});

describe("conventional conversions", () => {
  test("1 statV is 299.792458 V, marked conventional", () => {
    expect(convertValue(1, "statV", "V")).toBe(299.792458);
    expect(conversionFactor("statV", "V").exactness).toBe("conventional");
  });
  test("1 G is 1e-4 T, marked conventional", () => {
    expect(convertValue(1, "G", "T")).toBe(1e-4);
    expect(conversionFactor("G", "T").exactness).toBe("conventional");
  });
  test("1 abV is 1e-8 V, marked conventional", () => {
    expect(convertValue(1, "abV", "V")).toBe(1e-8);
    expect(conversionFactor("abV", "V").exactness).toBe("conventional");
  });
  test("1 abC is 10 C, marked conventional", () => {
    expect(convertValue(1, "abC", "C")).toBe(10);
    expect(conversionFactor("abC", "C").exactness).toBe("conventional");
  });
  test("paper 1 section 8's printed 9.6e3 abC per gram-equivalent converts to 9.6e4 C", () => {
    expect(convertValue(9.6e3, "abC", "C")).toBe(9.6e4);
  });
  test("1 statV/cm is 29979.2458 V/m, marked conventional", () => {
    expect(convertValue(1, "statV/cm", "V/m")).toBeCloseTo(29979.2458, 6);
    expect(conversionFactor("statV/cm", "V/m").exactness).toBe("conventional");
  });
  test("1 statC is close to 3.3356409520e-10 C, marked conventional", () => {
    expect(convertValue(1, "statC", "C")).toBeCloseTo(3.335640952e-10, 18);
    expect(conversionFactor("statC", "C").exactness).toBe("conventional");
  });
});

describe("convertValue exactness for doubles", () => {
  test("returns the double nearest the exact rational product, verified against exact rational arithmetic", () => {
    for (const [value, from, to] of [
      [2.5, "m", "cm"],
      [1, "eV", "J"],
      [17, "m", "um"],
      [3, "P", "mPa*s"],
    ] as const) {
      const got = convertValue(value, from, to);
      const exact = parseExactDecimal(convertExact(String(value), from, to));
      const exactAsDouble = Number(exact.num) / Number(exact.den);
      expect(got).toBe(exactAsDouble);
    }
  });
  test("refuses a nonfinite value", () => {
    expect(() => convertValue(Number.NaN, "m", "cm")).toThrow(UnitConversionError);
    expect(() => convertValue(Number.POSITIVE_INFINITY, "m", "cm")).toThrow(UnitConversionError);
  });
});

describe("family and unit safety", () => {
  test("refuses to convert across families", () => {
    expect(() => convertValue(1, "m", "Pa*s")).toThrow(UnitConversionError);
  });
  test("refuses an unknown unit", () => {
    expect(() => convertValue(1, "m", "furlong")).toThrow(UnitConversionError);
  });
  test("a non-terminating decimal result throws instead of silently truncating", () => {
    // statC's factor has den = 10 * c, which is not a power of 2 or 5.
    expect(() => convertExact("1", "statC", "C")).toThrow(/no finite decimal representation/);
  });
});

describe("inverse factors for sensitivity conversion", () => {
  test("inverseConversionFactor is the reciprocal of conversionFactor and shares its exactness", () => {
    const forward = conversionFactor("m", "um");
    const inverse = inverseConversionFactor("m", "um");
    expect(inverse.factor.num).toBe(forward.factor.den);
    expect(inverse.factor.den).toBe(forward.factor.num);
    expect(inverse.exactness).toBe(forward.exactness);
  });
});

describe("temperature", () => {
  test("the exact affine offset applies to an absolute temperature", () => {
    expect(convertTemperatureValue(17, "degC", "K")).toBe(290.15);
    expect(convertTemperatureValue(290.15, "K", "degC")).toBeCloseTo(17, 10);
  });
  test("the offset never applies to a temperature difference or sensitivity", () => {
    expect(convertTemperatureDelta(1, "degC", "K")).toBe(1);
    expect(convertTemperatureDelta(1, "K", "degC")).toBe(1);
  });
  test("same-unit temperature conversion is the identity", () => {
    expect(convertTemperatureValue(42, "K", "K")).toBe(42);
  });
});

describe("parseExactDecimal", () => {
  test("round-trips integers, decimals, and exponents exactly, reduced to lowest terms", () => {
    expect(parseExactDecimal("1.602176634e-19")).toEqual({
      num: 801088317n,
      den: 5_000_000_000_000_000_000_000_000_000n,
    });
    expect(parseExactDecimal("-3")).toEqual({ num: -3n, den: 1n });
    expect(parseExactDecimal("0.1")).toEqual({ num: 1n, den: 10n });
  });
  test("rejects a non-decimal string", () => {
    expect(() => parseExactDecimal("not-a-number")).toThrow(UnitConversionError);
  });
});

describe("adapters refusal throw sites (am-muyh)", () => {
  test("adapters: (adapters.ts:97) unknown-unit raised when unit definition is missing", () => {
    expect(() => conversionFactor("nonexistent-unit", "m")).toThrow(UnitConversionError);
    try {
      conversionFactor("nonexistent-unit", "m");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("unknown-unit");
      expect((e as UnitConversionError).message).toContain('Unknown unit "nonexistent-unit"');
    }

    // Accept known units
    const accepted = conversionFactor("m", "cm");
    expect(accepted.factor.num).toBe(100n);
    expect(accepted.factor.den).toBe(1n);
    expect(accepted.exactness).toBe("exact");
  });

  test("adapters: (adapters.ts:111) family-mismatch raised when units belong to different dimension families", () => {
    expect(() => conversionFactor("m", "Pa*s")).toThrow(UnitConversionError);
    try {
      conversionFactor("m", "Pa*s");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("family-mismatch");
      expect((e as UnitConversionError).message).toContain(
        'Cannot convert "m" (length) to "Pa*s" (viscosity)',
      );
    }

    // Accept same-family conversion
    const accepted = conversionFactor("m", "um");
    expect(accepted.factor.num).toBe(1_000_000n);
    expect(accepted.factor.den).toBe(1n);
    expect(accepted.exactness).toBe("exact");
  });

  test("adapters: (adapters.ts:158) non-terminating-decimal raised when exact rational factor cannot terminate in base 10", () => {
    expect(() => convertExact("1", "statC", "C")).toThrow(UnitConversionError);
    try {
      convertExact("1", "statC", "C");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("non-terminating-decimal");
      expect((e as UnitConversionError).message).toContain("has no finite decimal representation");
    }

    // Accept terminating decimal conversion
    const accepted = convertExact("1.35e-2", "P", "Pa*s");
    expect(accepted).toBe("0.00135");
  });

  test("adapters: (adapters.ts:183) invalid-decimal raised when decimal string format is unparseable", () => {
    expect(() => parseExactDecimal("not-a-finite-decimal")).toThrow(UnitConversionError);
    try {
      parseExactDecimal("not-a-finite-decimal");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("invalid-decimal");
      expect((e as UnitConversionError).message).toContain(
        '"not-a-finite-decimal" is not a finite decimal number',
      );
    }

    // Accept valid decimal string
    const accepted = parseExactDecimal("1.602176634e-19");
    expect(accepted.num).toBe(801088317n);
    expect(accepted.den).toBe(5_000_000_000_000_000_000_000_000_000n);
  });

  test("adapters: (adapters.ts:209) nonfinite-value raised when convertValue receives NaN or Infinity", () => {
    expect(() => convertValue(Number.NaN, "m", "cm")).toThrow(UnitConversionError);
    expect(() => convertValue(Number.POSITIVE_INFINITY, "m", "cm")).toThrow(UnitConversionError);
    try {
      convertValue(Number.NaN, "m", "cm");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("nonfinite-value");
      expect((e as UnitConversionError).message).toContain("Only finite values can be converted");
    }

    // Accept finite number
    const accepted = convertValue(2.5, "m", "cm");
    expect(accepted).toBe(250);
  });

  test("adapters: (adapters.ts:225) nonfinite-value raised when convertTemperatureValue receives NaN or Infinity", () => {
    expect(() => convertTemperatureValue(Number.NaN, "K", "degC")).toThrow(UnitConversionError);
    expect(() => convertTemperatureValue(Number.NEGATIVE_INFINITY, "degC", "K")).toThrow(
      UnitConversionError,
    );
    try {
      convertTemperatureValue(Number.NaN, "K", "degC");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("nonfinite-value");
      expect((e as UnitConversionError).message).toContain(
        "Only finite temperatures can be converted",
      );
    }

    // Accept finite temperature
    const accepted = convertTemperatureValue(290.15, "K", "degC");
    expect(accepted).toBeCloseTo(17, 10);
  });

  test("adapters: (adapters.ts:230) unknown-unit raised when convertTemperatureValue receives an unhandled temperature unit pair", () => {
    expect(() => convertTemperatureValue(300, "degF" as unknown as "K", "degC")).toThrow(
      UnitConversionError,
    );
    try {
      convertTemperatureValue(300, "degF" as unknown as "K", "degC");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("unknown-unit");
      expect((e as UnitConversionError).message).toContain(
        'Unknown temperature unit pair "degF" -> "degC"',
      );
    }

    // Accept valid temperature unit pairs
    expect(convertTemperatureValue(0, "degC", "K")).toBe(273.15);
    expect(convertTemperatureValue(273.15, "K", "degC")).toBe(0);
  });

  test("adapters: (adapters.ts:245) nonfinite-value raised when convertTemperatureDelta receives NaN or Infinity", () => {
    expect(() => convertTemperatureDelta(Number.NaN, "K", "degC")).toThrow(UnitConversionError);
    expect(() => convertTemperatureDelta(Number.POSITIVE_INFINITY, "degC", "K")).toThrow(
      UnitConversionError,
    );
    try {
      convertTemperatureDelta(Number.NaN, "K", "degC");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("nonfinite-value");
      expect((e as UnitConversionError).message).toContain(
        "Only finite differences can be converted",
      );
    }

    // Accept finite temperature difference
    const accepted = convertTemperatureDelta(5, "degC", "K");
    expect(accepted).toBe(5);
  });

  test("adapters: (adapters.ts:247) unknown-unit raised when convertTemperatureDelta receives invalid temperature units", () => {
    expect(() => convertTemperatureDelta(5, "m" as unknown as "K", "degC")).toThrow(
      UnitConversionError,
    );
    expect(() => convertTemperatureDelta(5, "K", "Pa*s" as unknown as "degC")).toThrow(
      UnitConversionError,
    );
    try {
      convertTemperatureDelta(5, "m" as unknown as "K", "degC");
      assert.fail("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).code).toBe("unknown-unit");
      expect((e as UnitConversionError).message).toContain(
        'Unknown temperature unit pair "m" -> "degC"',
      );
    }

    // Accept valid temperature unit pairs
    expect(convertTemperatureDelta(1, "degC", "K")).toBe(1);
    expect(convertTemperatureDelta(1, "K", "degC")).toBe(1);
  });
});
