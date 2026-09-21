import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatU64,
  fromU64LittleEndianBytes,
  MAX_SAFE_INTEGER_BIGINT,
  parseU64,
  randomU64Seed,
  toBigIntU64,
  toSafeIndex,
  toU64LittleEndianBytes,
  toU64String,
  type U64,
  U64_MAX_BIGINT,
  type U64String,
  U64ValidationError,
} from "../../experiments/identity/u64.ts";

const fixturePath = resolve(process.cwd(), "src/testing/fixtures/u64-boundaries.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("u64 identities: canonical decimal grammar, conversions, and boundary checks", () => {
  it("accepts all valid boundary vectors and performs byte-identical round trips", () => {
    for (const s of fixture.valid as string[]) {
      const parsed = parseU64(s);
      expect(parsed).toBe(s as U64String);

      // BigInt conversion
      const big = toBigIntU64(s);
      expect(big).toBe(BigInt(s) as U64);

      // Format back to string
      const formatted = formatU64(big);
      expect(formatted).toBe(s);

      // toU64String round trip
      expect(toU64String(big)).toBe(s as U64String);
      expect(toU64String(parsed)).toBe(s as U64String);

      // Little-endian 8-byte binary round trip
      const leBytes = toU64LittleEndianBytes(s);
      expect(leBytes.byteLength).toBe(8);
      const fromBytes = fromU64LittleEndianBytes(leBytes);
      expect(fromBytes).toBe(big);

      // Structured clone preserves identity
      const clonedStr = structuredClone(parsed);
      expect(clonedStr).toBe(s as U64String);
      const clonedBig = structuredClone(big);
      expect(clonedBig).toBe(big);
    }
  });

  it("strictly preserves distinction between 2^53 (9007199254740992) and 2^53+1 (9007199254740993)", () => {
    const s1 = "9007199254740992";
    const s2 = "9007199254740993";

    const p1 = parseU64(s1);
    const p2 = parseU64(s2);
    expect(p1).not.toBe(p2);

    const b1 = toBigIntU64(s1);
    const b2 = toBigIntU64(s2);
    expect(b1).not.toBe(b2);
    expect(b2 - b1).toBe(1n);

    const bytes1 = toU64LittleEndianBytes(s1);
    const bytes2 = toU64LittleEndianBytes(s2);
    expect(Buffer.compare(Buffer.from(bytes1), Buffer.from(bytes2))).not.toBe(0);
  });

  it("rejects all format violations with u64-invalid-format", () => {
    for (const invalid of fixture.formatViolations as string[]) {
      expect(() => parseU64(invalid)).toThrow(U64ValidationError);
      try {
        parseU64(invalid);
      } catch (err: unknown) {
        expect((err as U64ValidationError).code).toBe("u64-invalid-format");
      }
    }
  });

  it("rejects non-string types with u64-not-string or u64-invalid-type (u64.ts:65)", () => {
    const nonStrings = [
      0,
      1,
      42,
      9007199254740992,
      null,
      undefined,
      true,
      false,
      {},
      [],
      18446744073709551615n, // BigInt must be parsed via toBigIntU64 or string
    ];

    for (const val of nonStrings) {
      expect(() => parseU64(val)).toThrow(U64ValidationError);
      try {
        parseU64(val);
      } catch (err: unknown) {
        expect((err as U64ValidationError).code).toBe("u64-not-string");
        // parseU64's own sentence. toBigIntU64 emits the same code at :117 with a different one,
        // so the code alone would not say which site this test proves.
        expect((err as U64ValidationError).message).toContain("Expected a canonical string");
      }
    }
  });

  it("rejects overflows with u64-overflow (u64.ts:82)", () => {
    for (const overflow of fixture.overflows as string[]) {
      expect(() => parseU64(overflow)).toThrow(U64ValidationError);
      try {
        parseU64(overflow);
      } catch (err: unknown) {
        expect((err as U64ValidationError).code).toBe("u64-overflow");
        // parseU64's own sentence; :102 and :141 emit the same code from the bigint conversions.
        expect((err as U64ValidationError).message).toContain("exceeds 2^64 - 1");
      }
    }
  });

  it("enforces toSafeIndex (< 2^53) boundary condition", () => {
    // Safe values below 2^53
    expect(toSafeIndex("0")).toBe(0);
    expect(toSafeIndex("1")).toBe(1);
    expect(toSafeIndex("4294967295")).toBe(4294967295);
    expect(toSafeIndex("9007199254740991")).toBe(Number(MAX_SAFE_INTEGER_BIGINT));
    expect(toSafeIndex(9007199254740991n)).toBe(9007199254740991);

    // Unsafe values >= 2^53
    const unsafeValues = [
      "9007199254740992",
      "9007199254740993",
      "10000000000000000000",
      "18446744073709551614",
      "18446744073709551615",
      9007199254740992n,
      9007199254740993n,
      U64_MAX_BIGINT,
    ];

    for (const unsafe of unsafeValues) {
      expect(() => toSafeIndex(unsafe)).toThrow(U64ValidationError);
      try {
        toSafeIndex(unsafe);
      } catch (err: unknown) {
        expect((err as U64ValidationError).code).toBe("u64-unsafe-index");
      }
    }
  });

  it("verifies little-endian 8-byte buffer validation", () => {
    const invalidBuffers = [
      new Uint8Array(0),
      new Uint8Array(4),
      new Uint8Array(7),
      new Uint8Array(9),
      new Uint8Array(16),
    ];

    for (const buf of invalidBuffers) {
      expect(() => fromU64LittleEndianBytes(buf)).toThrow(U64ValidationError);
      try {
        fromU64LittleEndianBytes(buf);
      } catch (err: unknown) {
        expect((err as U64ValidationError).code).toBe("u64-invalid-bytes");
      }
    }
  });

  it("generates ambient entropy seeds using crypto.getRandomValues without Math.random", () => {
    const mathRandomCalled = { count: 0 };
    const originalRandom = Math.random;
    Math.random = () => {
      mathRandomCalled.count++;
      return originalRandom();
    };

    try {
      const seed1 = randomU64Seed();
      const seed2 = randomU64Seed();

      expect(typeof seed1).toBe("string");
      expect(parseU64(seed1)).toBe(seed1);
      expect(typeof seed2).toBe("string");
      expect(parseU64(seed2)).toBe(seed2);

      // Two consecutive seeds from ambient entropy should be distinct
      expect(seed1).not.toBe(seed2);

      // Math.random must never be touched
      expect(mathRandomCalled.count).toBe(0);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("reject: (u64.ts:149) throws u64-invalid-type when toU64String receives non-bigint non-string", () => {
    expect(() => toU64String(123 as any)).toThrow(U64ValidationError);
    try {
      toU64String(123 as any);
    } catch (err: unknown) {
      expect((err as U64ValidationError).code).toBe("u64-invalid-type");
    }
  });

  /**
   * The four sites in u64.ts that survived deletion, and the two that were driven but uncited.
   *
   * Every one of these codes appears at more than one site - u64-overflow at three, u64-not-string
   * at two, u64-invalid-type at two - so a test asserting the code alone cannot say which line it
   * proves, and under am-ksl3 none of them is credited. Each arm below names the function it is
   * about and asserts the sentence that only that site emits.
   *
   * These are the boundaries AGENTS.md names for 64-bit identities: 2^53 and its neighbours, zero,
   * 2^64-1, invalid signs, and overflow. A number reaching toBigIntU64 is the dangerous one,
   * because it is silently lossy above 2^53-1 rather than wrong in a way anyone would notice.
   */
  describe("the overflow and type arms of the conversions", () => {
    it("reject: (u64.ts:102) toBigIntU64 refuses a bigint above 2^64-1", () => {
      const justOver = U64_MAX_BIGINT + 1n;
      expect(() => toBigIntU64(justOver)).toThrow(U64ValidationError);
      try {
        toBigIntU64(justOver);
      } catch (err: unknown) {
        const e = err as U64ValidationError;
        expect(e.code).toBe("u64-overflow");
        expect(e.message).toContain("out of unsigned 64-bit range");
        expect(e.message).toContain(justOver.toString());
      }
      // The boundary itself is accepted, so this is an off-by-one test and not a ban on large values.
      expect(toBigIntU64(U64_MAX_BIGINT)).toBe(U64_MAX_BIGINT as U64);
      // And the low end: unsigned means zero is legal and -1 is not.
      expect(toBigIntU64(0n)).toBe(0n as U64);
      expect(() => toBigIntU64(-1n)).toThrow(U64ValidationError);
    });

    it("reject: (u64.ts:117) toBigIntU64 refuses a NUMBER, naming the precision it would lose", () => {
      // The site that matters most in this file. A number is not merely the wrong type: above
      // 2^53-1 it has already lost the value before the call, so accepting one would silently
      // identify a different random stream.
      expect(() => toBigIntU64(1905)).toThrow(U64ValidationError);
      try {
        toBigIntU64(1905);
      } catch (err: unknown) {
        const e = err as U64ValidationError;
        expect(e.code).toBe("u64-not-string");
        expect(e.message).toContain("lose precision above 2^53-1");
        expect(e.message).toContain("1905");
      }
      // Even a number that IS exactly representable is refused: the rule is about the type, so
      // that no caller learns the habit on a small seed and keeps it on a large one.
      expect(() => toBigIntU64(Number(MAX_SAFE_INTEGER_BIGINT))).toThrow(U64ValidationError);
      // The same value as a canonical string is accepted, which is what makes this a type rule
      // rather than a range one.
      expect(toBigIntU64("1905")).toBe(1905n as U64);
    });

    it("reject: (u64.ts:124) toBigIntU64 refuses anything that is not a string or bigint", () => {
      for (const bad of [null, undefined, {}, [], true]) {
        expect(() => toBigIntU64(bad)).toThrow(U64ValidationError);
        try {
          toBigIntU64(bad);
        } catch (err: unknown) {
          const e = err as U64ValidationError;
          expect(e.code).toBe("u64-invalid-type");
          // NOT the number arm at :117, which has its own code and its own sentence.
          expect(e.message).toContain("Expected string or bigint");
          expect(e.message).not.toContain("lose precision");
        }
      }
    });

    it("reject: (u64.ts:141) toU64String refuses a bigint above 2^64-1", () => {
      // Distinct from :102: same code and same sentence, different function. The citation is the
      // only thing that tells them apart, so this arm exists to hold one of the two.
      const justOver = U64_MAX_BIGINT + 1n;
      expect(() => toU64String(justOver)).toThrow(U64ValidationError);
      try {
        toU64String(justOver);
      } catch (err: unknown) {
        const e = err as U64ValidationError;
        expect(e.code).toBe("u64-overflow");
        expect(e.message).toContain("out of unsigned 64-bit range");
      }
      expect(toU64String(U64_MAX_BIGINT)).toBe(U64_MAX_BIGINT.toString() as U64String);
      expect(() => toU64String(-1n)).toThrow(U64ValidationError);
    });
  });
});
