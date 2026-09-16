import { describe, expect, test } from "bun:test";
import type { ParameterSpec } from "../content/schemas/experiment.ts";
import { parseParameterValue } from "../experiments/controls/parse.ts";
import {
  generateSeed,
  isValidSeed,
  parseU64,
  U64_MAX_BIGINT,
} from "../experiments/controls/seed.ts";

describe("Parameter Controls 64-bit Decimal Seed Validation (am-inst-parameter-controls-cmj9, am-rt-u64-identities-7ce)", () => {
  const seedSpec: ParameterSpec = {
    id: "seed",
    label: "Seed",
    accessibleName: "Stream seed",
    accessibleDescription: "64-bit seed",
    quantityId: "streamSeed",
    displayUnit: "",
    modelDomain: {},
    visualRange: { min: 0, max: 1 },
    default: "1905",
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  };

  test("round-trips 0, 2^53, 2^53 +- 1, and 2^64 - 1", () => {
    const cases = [
      "0",
      "9007199254740991", // 2^53 - 1 (MAX_SAFE_INTEGER)
      "9007199254740992", // 2^53
      "9007199254740993", // 2^53 + 1
      "18446744073709551615", // 2^64 - 1 (U64_MAX)
    ];

    for (const c of cases) {
      expect(isValidSeed(c)).toBe(true);
      expect(parseU64(c)).toBe(c as any);

      const parsed = parseParameterValue(seedSpec, c);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.canonicalValue).toBe(c);
        expect(parsed.displayValue).toBe(c);
      }
    }
  });

  test("strictly rejects invalid strings: -1, leading whitespace ' 1', leading zero '01', exponent '1e3', 21-digit input, and 2^64", () => {
    const invalidInputs = [
      "-1",
      " 1",
      "1 ",
      "01",
      "00",
      "1e3",
      "1.0",
      "0x123",
      "18446744073709551616", // 2^64 (overflow)
      "999999999999999999999", // 21-digit number
      "abc",
      "",
    ];

    for (const inv of invalidInputs) {
      expect(isValidSeed(inv)).toBe(false);
      const parsed = parseParameterValue(seedSpec, inv);
      expect(parsed.ok).toBe(false);
    }
  });

  test("generateSeed produces valid ambient entropy 64-bit decimal seeds", () => {
    for (let i = 0; i < 10; i++) {
      const seed = generateSeed();
      expect(typeof seed).toBe("string");
      expect(isValidSeed(seed)).toBe(true);
      expect(BigInt(seed) >= 0n).toBe(true);
      expect(BigInt(seed) <= U64_MAX_BIGINT).toBe(true);
    }
  });
});
