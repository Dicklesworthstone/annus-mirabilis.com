import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDecimalForLocale,
  formatWithUnit,
  parseLocaleDecimal,
  toSuperscriptDigits,
} from "./numberLocale.ts";

test("numberLocale: formats scientific notation with superscript exponents and locale separators", () => {
  const avogadro = 6.17e23;
  assert.equal(formatDecimalForLocale(avogadro, "en"), "6.17 × 10²³");
  assert.equal(formatDecimalForLocale(avogadro, "de"), "6,17 × 10²³");
});

test("numberLocale: formats standard decimals with exact locale separators", () => {
  const viscosity = 0.4814;
  assert.equal(formatDecimalForLocale(viscosity, "en"), "0.4814");
  assert.equal(formatDecimalForLocale(viscosity, "de"), "0,4814");
});

test("numberLocale: parses locale decimal correctly", () => {
  const valDe = parseLocaleDecimal("0,48", "de");
  assert.equal(valDe, 0.48);

  const valEn = parseLocaleDecimal("0.4814", "en");
  assert.equal(valEn, 0.4814);
});

test("numberLocale: rejects ambiguous or mismatched decimal separators with readable errors", () => {
  // Comma in English is not a decimal separator
  assert.throws(
    () => parseLocaleDecimal("0,48", "en"),
    (err: any) => {
      assert.match(err.message, /comma is not a valid decimal separator/i);
      return true;
    },
  );

  // Period followed by 3 digits in German is ambiguous with grouping separator
  assert.throws(
    () => parseLocaleDecimal("1.234", "de"),
    (err: any) => {
      assert.match(err.message, /ambiguous/i);
      return true;
    },
  );
});

test("numberLocale: normalizes negative zero to canonical positive zero", () => {
  const parsed = parseLocaleDecimal("-0", "de");
  assert.equal(parsed, 0);
  assert.equal(Object.is(parsed, -0), false);
  assert.equal(Object.is(parsed, 0), true);
});

test("numberLocale: rejects NaN and Infinity", () => {
  assert.throws(
    () => parseLocaleDecimal("NaN", "en"),
    (err: any) => {
      assert.match(err.message, /NaN and Infinity are rejected/i);
      return true;
    },
  );

  assert.throws(
    () => parseLocaleDecimal("Infinity", "de"),
    (err: any) => {
      assert.match(err.message, /NaN and Infinity are rejected/i);
      return true;
    },
  );

  assert.throws(
    () => parseLocaleDecimal("-Infinity", "en"),
    (err: any) => {
      assert.match(err.message, /NaN and Infinity are rejected/i);
      return true;
    },
  );
});

test("numberLocale: formats SI units with narrow no-break space (U+202F)", () => {
  const formatted = formatWithUnit(0.4814, "mPa·s", "de");
  assert.equal(formatted, "0,4814\u202FmPa·s");
  assert.equal(formatted.includes("\u202F"), true);
});

test("numberLocale: parses scientific notation with superscript exponents", () => {
  const parsedEn = parseLocaleDecimal("6.17 × 10²³", "en");
  assert.equal(parsedEn, 6.17e23);

  const parsedDe = parseLocaleDecimal("6,17 × 10²³", "de");
  assert.equal(parsedDe, 6.17e23);
});

test("numberLocale: superscript digit converter", () => {
  assert.equal(toSuperscriptDigits(23), "²³");
  assert.equal(toSuperscriptDigits("-10"), "⁻¹⁰");
  assert.equal(toSuperscriptDigits(0), "⁰");
});
