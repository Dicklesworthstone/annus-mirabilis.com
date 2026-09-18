import { describe, expect, test } from "bun:test";
import { logPhilox } from "./philox.log.ts";
import { philox4x32_10 } from "./philox.ts";
import vectors from "./philox.vectors.json";

describe("Philox Random123 Known-Answer Tests (Load-Bearing Authority)", () => {
  const kats = [
    {
      name: "zero_block",
      counter: [0, 0, 0, 0],
      key: [0, 0],
      expected: [0x6627e8d5, 0xe169c58d, 0xbc57ac4c, 0x9b00dbd8],
    },
    {
      name: "all_ones",
      counter: [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
      key: [0xffffffff, 0xffffffff],
      expected: [0x408f276d, 0x41c83b0e, 0xa20bc7c6, 0x6d5451fd],
    },
    {
      name: "pi_digits",
      counter: [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344],
      key: [0xa4093822, 0x299f31d0],
      expected: [0xd16cfe09, 0x94fdcceb, 0x5001e420, 0x24126ea1],
    },
  ];

  for (const kat of kats) {
    test(`matches published Random123 KAT: ${kat.name}`, () => {
      const t0 = performance.now();
      const actual = philox4x32_10(kat.counter, kat.key);
      const passed = Array.from(actual).every((v, i) => v === kat.expected[i]);
      logPhilox({
        testId: `kat-${kat.name}`,
        seed: "0",
        streamVersion: "philox4x32-10-v1",
        expected: kat.expected.map((w) => w.toString(16).padStart(8, "0")),
        actual: Array.from(actual).map((w) => w.toString(16).padStart(8, "0")),
        comparisonKind: "bitwise",
        tolerance: null,
        outcome: passed ? "passed" : "failed",
        durationMs: performance.now() - t0,
        message: `Random123 published known-answer ${kat.name} bitwise check`,
        extra: {
          field: "block",
          vectorFileDigest: vectors.provenance.sha256,
        },
      });
      expect(Array.from(actual)).toEqual(kat.expected);
    });
  }

  test("vectors file knownAnswers array contains all 3 KATs and matches bitwise", () => {
    expect(vectors.knownAnswers.length).toBe(3);
    for (const ka of vectors.knownAnswers) {
      const counter = ka.counter.map((h: string) => Number.parseInt(h, 16));
      const key = ka.key.map((h: string) => Number.parseInt(h, 16));
      const expectedBlock = ka.block.map((h: string) => Number.parseInt(h, 16));
      const actual = philox4x32_10(counter, key);
      expect(Array.from(actual)).toEqual(expectedBlock);
    }
  });
});
