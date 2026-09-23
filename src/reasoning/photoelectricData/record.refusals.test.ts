/**
 * Every refusal in parseVoltageCsv, driven by the input that reaches it, asserting the code AND
 * the exact message a reader sees. The messages are unique per site, so a case that asserted a
 * code reached from a different line would fail on its message.
 */
import { describe, expect, test } from "bun:test";
import { PhotoelectricRecordError, parseVoltageCsv, RECORD_BYTE_LIMIT } from "./record.ts";

const C = 299792458;
const HEADER = "frequency_THz,stopping_V";

function refusalFrom(run: () => unknown): PhotoelectricRecordError {
  try {
    run();
  } catch (error) {
    if (error instanceof PhotoelectricRecordError) return error;
    throw new Error(`expected a PhotoelectricRecordError, got ${String(error)}`);
  }
  throw new Error("expected a refusal, and the record was accepted");
}

describe("parseVoltageCsv refusals", () => {
  test("a well-formed record is accepted (control for the cases below)", () => {
    const record = parseVoltageCsv(`${HEADER}\n500,0.5\n600,0.9\n700,1.3\n`, C);
    expect(record.rows.length).toBe(3);
  });

  test("record-number-invalid: a blank or formula cell", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n500,=A1\n600,0.9\n700,1.3\n`, C));
    expect(e.code).toBe("record-number-invalid");
    expect(e.message).toBe(
      "Line 2: expected a finite decimal number, not a blank, formula or non-detection.",
    );
  });

  test("record-number-not-finite: a decimal that overflows binary64", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n1e999,0.5\n600,0.9\n700,1.3\n`, C));
    expect(e.code).toBe("record-number-not-finite");
    expect(e.message).toBe("Line 2: number is not finite.");
  });

  test("record-too-large: more than the 128 KiB local-file limit", () => {
    const e = refusalFrom(() => parseVoltageCsv("x".repeat(RECORD_BYTE_LIMIT + 1), C));
    expect(e.code).toBe("record-too-large");
    expect(e.message).toBe("The CSV exceeds the 128 KiB local-file limit.");
  });

  test("record-light-speed-invalid: no positive light-speed calibration", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n500,0.5\n`, 0));
    expect(e.code).toBe("record-light-speed-invalid");
    expect(e.message).toBe("A declared positive light-speed calibration is required.");
  });

  test("record-blank: nothing but blank lines", () => {
    const e = refusalFrom(() => parseVoltageCsv("\n  \n", C));
    expect(e.code).toBe("record-blank");
    expect(e.message).toBe("Paste a header and at least three measured stopping potentials.");
  });

  test("record-header-invalid: an undeclared column", () => {
    const e = refusalFrom(() => parseVoltageCsv("frequency_THz,voltage\n500,0.5\n", C));
    expect(e.code).toBe("record-header-invalid");
    expect(e.message).toBe(
      "Use frequency_THz,stopping_V (or frequency_Hz / wavelength_nm), optionally followed by sigma_V. No other columns are inferred.",
    );
  });

  test("record-too-many-rows: a 1001st observation", () => {
    const rows = Array.from({ length: 1001 }, (_, i) => `${500 + i},0.5`).join("\n");
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n${rows}\n`, C));
    expect(e.code).toBe("record-too-many-rows");
    expect(e.message).toBe("Use at most 1000 observations.");
  });

  test("record-field-count: a row with a field the header does not declare", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n500,0.5,0.1\n`, C));
    expect(e.code).toBe("record-field-count");
    expect(e.message).toBe("Line 2: expected 2 numeric fields.");
  });

  test("record-axis-not-positive: a zero frequency", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n0,0.5\n`, C));
    expect(e.code).toBe("record-axis-not-positive");
    expect(e.message).toBe("Line 2: frequency or wavelength must be positive.");
  });

  test("record-out-of-range: a frequency above 10^6 THz", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n2000000,0.5\n`, C));
    expect(e.code).toBe("record-out-of-range");
    expect(e.message).toBe(
      "Line 2: admitted range is 10⁻⁶ to 10⁶ THz and ±10000 V. Check the units.",
    );
  });

  test("record-sigma-out-of-range: a zero sigma_V", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER},sigma_V\n500,0.5,0\n`, C));
    expect(e.code).toBe("record-sigma-out-of-range");
    expect(e.message).toBe("Line 2: sigma_V must be between 10⁻⁹ and 10000 V.");
  });

  test("record-too-few-rows: two observations", () => {
    const e = refusalFrom(() => parseVoltageCsv(`${HEADER}\n500,0.5\n600,0.9\n`, C));
    expect(e.code).toBe("record-too-few-rows");
    expect(e.message).toBe(
      "Use at least three observations; two points cannot estimate residual scatter.",
    );
  });
});
