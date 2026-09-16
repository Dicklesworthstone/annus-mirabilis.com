import { describe, expect, test } from "bun:test";
import { encodeFields, scientificDigest } from "./scientificDigest.ts";

describe("scientificDigest", () => {
  test("field order in the caller's object never changes the digest", async () => {
    const a = await scientificDigest({ x: 1, y: 2, z: "seed-1" });
    const b = await scientificDigest({ z: "seed-1", x: 1, y: 2 });
    expect(a.digest).toBe(b.digest);
  });

  test("+0.0 and -0.0 are distinguished", async () => {
    const pos = await scientificDigest({ x: 0 });
    const neg = await scientificDigest({ x: -0 });
    expect(pos.digest).not.toBe(neg.digest);
  });

  test("seeds above 2^53 are hashed from their exact decimal string, never from a JS number", async () => {
    // 9007199254740993 = 2^53 + 1 is not exactly representable as a JS number; its string form
    // is the entire point of routing seeds through canonical decimal strings, never numbers.
    const a = await scientificDigest({ seed: "9007199254740993" });
    const b = await scientificDigest({ seed: "9007199254740992" });
    expect(a.digest).not.toBe(b.digest);
  });

  test("the donor collision regression: seed 1 and seed 4294967297 (differ only above bit 32) produce different digests", async () => {
    const a = await scientificDigest({ seed: "1" });
    const b = await scientificDigest({ seed: "4294967297" });
    expect(a.digest).not.toBe(b.digest);
  });

  test("a nested object's field order never changes the digest", async () => {
    const a = await scientificDigest({ outer: { p: 1, q: 2 } });
    const b = await scientificDigest({ outer: { q: 2, p: 1 } });
    expect(a.digest).toBe(b.digest);
  });

  test("a number and its string form never collide", async () => {
    const asNumber = await scientificDigest({ x: 1 });
    const asString = await scientificDigest({ x: "1" });
    expect(asNumber.digest).not.toBe(asString.digest);
  });

  test("typed arrays with the same values but different element types never collide", async () => {
    const asFloat = await scientificDigest({ v: Float64Array.of(1, 2, 3) });
    const asUint32 = await scientificDigest({ v: Uint32Array.of(1, 2, 3) });
    expect(asFloat.digest).not.toBe(asUint32.digest);
  });

  test("is written host:sha256:<hex> and labeled host, never blake3", async () => {
    const { digest, digestKind } = await scientificDigest({ x: 1 });
    expect(digest).toMatch(/^host:sha256:[0-9a-f]{64}$/);
    expect(digestKind).toBe("host");
    expect(digest).not.toContain("blake3");
  });

  test("encodeFields is a pure function of its input (no hidden randomness or clock reads)", () => {
    const a = encodeFields({ x: 1, y: "seed" });
    const b = encodeFields({ y: "seed", x: 1 });
    expect(a).toEqual(b);
  });
});
