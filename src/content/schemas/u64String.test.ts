import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { U64ValidationError, validateU64String } from "./u64String.ts";

const fixturePath = resolve(process.cwd(), "src/testing/fixtures/u64-boundaries.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

test("u64String: valid canonical decimal strings validate successfully", () => {
  const validCases: string[] = [
    ...fixture.valid,
    "0",
    "1",
    "42",
    "9007199254740991", // 2^53 - 1 (JS max safe integer)
    "9007199254740992", // 2^53
    "9007199254740993", // 2^53 + 1
    "10000000000000000000",
    "18446744073709551614", // 2^64 - 2
    "18446744073709551615", // 2^64 - 1 (max u64)
  ];

  for (const s of validCases) {
    assert.equal(validateU64String(s), s);
  }
});

test("u64String: numbers and non-strings are rejected", () => {
  const nonStrings = [
    0,
    42,
    9007199254740992,
    null,
    undefined,
    true,
    {},
    [],
    18446744073709551615n, // BigInt must be passed as string
  ];

  for (const input of nonStrings) {
    assert.throws(
      () => validateU64String(input),
      (err: any) => {
        assert.ok(err instanceof U64ValidationError);
        assert.equal(err.code, "u64-not-string");
        return true;
      },
    );
  }
});

test("u64String: format violations from fixture and inline cases are rejected", () => {
  const formatViolations: string[] = [
    ...fixture.formatViolations,
    "",
    " ",
    " 0",
    "0 ",
    " 123 ",
    "+0",
    "+1",
    "-1",
    "-0",
    "00",
    "01",
    "007",
    "1.0",
    "3.14",
    "1e10",
    "0x10",
    "1_000_000",
    "NaN",
    "Infinity",
    "18446744073709551615\n",
    "18446744073709551615\0",
    "١٢٣", // non-ASCII digits
  ];

  for (const s of formatViolations) {
    assert.throws(
      () => validateU64String(s),
      (err: any) => {
        assert.ok(err instanceof U64ValidationError);
        assert.equal(err.code, "u64-invalid-format");
        return true;
      },
    );
  }
});

test("u64String: values exceeding 2^64-1 from fixture and inline cases are rejected", () => {
  const overflows: string[] = [
    ...fixture.overflows,
    "18446744073709551616", // 2^64
    "18446744073709551617", // 2^64 + 1
    "184467440737095516150",
    "99999999999999999999",
    "100000000000000000000", // 21 chars
  ];

  for (const s of overflows) {
    assert.throws(
      () => validateU64String(s),
      (err: any) => {
        assert.ok(err instanceof U64ValidationError);
        assert.equal(err.code, "u64-overflow");
        return true;
      },
    );
  }
});
