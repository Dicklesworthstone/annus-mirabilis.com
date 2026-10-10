/**
 * ROW 12: "A large seed can be carried as a JSON number" (am-ver-adversarial-audit-1ef).
 *
 * The fixture is 9007199254740993, which is 2^53 + 1. AGENTS.md's runtime contract requires seeds
 * to travel as canonical decimal strings and to be decoded with BigInt, "and never hash a rounded
 * decimal display of a seed". This row proves the requirement bites.
 *
 * NOTHING THROWS on the wrong path, which is the whole reason the error is plausible: JSON accepts
 * the number, returns a number, and the value is quietly a different stream. So the assertion is on
 * the VALUE that survives, not on an exception.
 */

import { expect, test } from "bun:test";
import { parseWithU64, stringifyWithU64 } from "../../experiments/identity/jsonCodec.ts";
import { wrongSeedTransport } from "./wrongComputations.ts";

/** 2^53 + 1: the smallest integer an IEEE double cannot represent. */
const SEED = "9007199254740993";
/** What it silently becomes as a JSON number. A different stream, not an error. */
const COLLAPSED = "9007199254740992";

test("the owner's codec round-trips the seed unchanged, as a canonical decimal string", () => {
  /**
   * THE CONTRACT IS A STRING, NOT A BIGINT, and my first version of this test asserted the wrong
   * one. `stringifyWithU64` writes {"seed":"9007199254740993"} and `parseWithU64` returns that
   * string; AGENTS.md puts the BigInt conversion at the WASM boundary, not at the JSON boundary --
   * "Encode them as canonical decimal strings at JSON and URL boundaries ... and decode with
   * BigInt before the WASM boundary."
   *
   * Worth the comment because the probe that led me to assert `bigint` used `.toString()`, which
   * succeeds on a string AND on a bigint, so it could not tell them apart. The round trip is now
   * asserted on the exact text, and separately on the integer it decodes to.
   */
  const serialized = stringifyWithU64({ seed: BigInt(SEED) });
  expect(serialized).toBe(`{"seed":"${SEED}"}`);
  const round = parseWithU64(serialized) as { seed: string };
  expect(typeof round.seed).toBe("string");
  expect(round.seed).toBe(SEED);
  expect(BigInt(round.seed)).toBe(BigInt(SEED));
});

test("the WRONG transport fails on the seed's value, silently and without throwing", () => {
  let threw = false;
  let carried = "";
  try {
    carried = wrongSeedTransport(SEED);
  } catch {
    threw = true;
  }
  // The absence of a throw is part of the finding: a fixture that merely crashed would not
  // describe this defect, because a crash is something a developer notices.
  expect(threw).toBe(false);
  expect(carried).toBe(COLLAPSED);
  expect(carried).not.toBe(SEED);
});

test("the two seeds are genuinely different streams, so the collapse is not cosmetic", () => {
  // Without this the row would only show a display difference of one digit.
  expect(BigInt(SEED) === BigInt(COLLAPSED)).toBe(false);
  expect(BigInt(SEED) - BigInt(COLLAPSED)).toBe(1n);
  // And the neighbour below 2^53 survives ordinary JSON, which is why the boundary is the claim
  // rather than "JSON cannot carry integers".
  expect(wrongSeedTransport("9007199254740991")).toBe("9007199254740991");
});
