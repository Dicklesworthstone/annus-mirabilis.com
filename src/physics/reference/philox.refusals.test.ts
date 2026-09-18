/**
 * Comprehensive accept/reject tests for all 16 refusal throw sites in philox.ts (am-muyh).
 *
 * Governed by bead am-muyh and doctrine 8 (typed refusal states):
 * - Counter-based host RNG stream semantics verification (FrankenSim fs-rand v1).
 * - Counter and key boundary enforcement, checkpoint serialization codec verification.
 * - Accept/reject pair per throw site.
 * - Every test carries explicit line citation (philox.ts:<line>) and literal code string.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  at,
  createPhiloxStream,
  decodeStreamCheckpoint,
  encodeStreamCheckpoint,
  parseU64,
  philox4x32_10,
  STREAM_CHECKPOINT_CANONICAL_LEN,
  STREAM_CHECKPOINT_VERSION,
  STREAM_SEMANTICS_VERSION,
  StreamInputError,
} from "./philox.ts";

function createValidFrame(): Uint8Array {
  return encodeStreamCheckpoint({
    checkpointVersion: STREAM_CHECKPOINT_VERSION,
    streamSemanticsVersion: STREAM_SEMANTICS_VERSION,
    seed: "123456789012345678",
    kernel: 3,
    tile: 7,
    index: "42",
  });
}

describe("Philox reference refusal throw sites (am-muyh)", () => {
  // ==========================================================================
  // Site 1: parseU64 (philox.ts:54) - invalid-seed
  // ==========================================================================
  test("site (philox.ts:54) invalid-seed: rejects non-u64 seed representations, accepts valid bigint and canonical decimal string", () => {
    // Accept cases: valid bigint and canonical decimal string within u64 range
    assert.equal(parseU64(0n), 0n);
    assert.equal(parseU64(18446744073709551615n), 18446744073709551615n);
    assert.equal(parseU64("0"), 0n);
    assert.equal(parseU64("18446744073709551615"), 18446744073709551615n);
    assert.equal(parseU64("42"), 42n);

    // Reject cases: negative bigint, number primitive, non-canonical strings, overflow
    assert.throws(
      () => parseU64(-1n),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-seed");
        return true;
      },
    );
    assert.throws(
      () => parseU64(42),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-seed");
        return true;
      },
    );
    assert.throws(
      () => parseU64("18446744073709551616"), // U64_MAX + 1
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-seed");
        return true;
      },
    );
    assert.throws(
      () => parseU64("042"), // leading zeros not permitted in canonical decimal
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-seed");
        return true;
      },
    );
    assert.throws(
      () => parseU64("not-a-number"),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-seed");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 2: u32 parameter validation (philox.ts:62) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:62) invalid-parameter: rejects non-u32 stream words, accepts valid u32 values", () => {
    // Accept case: valid u32 values in stream key (kernel and tile)
    const validResult = at({ seed: "0", kernel: 0, tile: 0xffffffff }, "0");
    assert.equal(validResult.length, 4);

    // Reject cases: negative numbers, non-integers, numbers > 0xffffffff
    assert.throws(
      () => at({ seed: "0", kernel: -1, tile: 0 }, "0"),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => at({ seed: "0", kernel: 0x100000000, tile: 0 }, "0"),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => at({ seed: "0", kernel: 1.5, tile: 0 }, "0"),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => at({ seed: "0", kernel: Number.NaN, tile: 0 }, "0"),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 3: philox4x32_10 array lengths (philox.ts:105) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:105) invalid-parameter: rejects counter !== 4 or key !== 2 words, accepts exactly 4 counter and 2 key words", () => {
    // Accept case: exactly 4 counter words and 2 key words
    const res = philox4x32_10([0, 1, 2, 3], [4, 5]);
    assert.equal(res.length, 4);

    // Reject cases: wrong lengths
    assert.throws(
      () => philox4x32_10([0, 1, 2], [4, 5]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => philox4x32_10([0, 1, 2, 3, 4], [4, 5]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => philox4x32_10([0, 1, 2, 3], [4]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => philox4x32_10([0, 1, 2, 3], [4, 5, 6]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 4: philox4x32_10 undefined elements (philox.ts:120) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:120) invalid-parameter: rejects sparse or undefined words in counter/key, accepts fully populated arrays", () => {
    // Accept case: fully populated words
    const res = philox4x32_10([10, 20, 30, 40], [50, 60]);
    assert.equal(res.length, 4);

    // Reject cases: sparse arrays with undefined slots
    const sparseCounter = new Array(4) as number[];
    sparseCounter[0] = 0;
    sparseCounter[1] = 1;
    sparseCounter[2] = 2;
    // sparseCounter[3] is undefined
    assert.throws(
      () => philox4x32_10(sparseCounter, [0, 0]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );

    const sparseKey = [0, undefined] as unknown as number[];
    assert.throws(
      () => philox4x32_10([0, 1, 2, 3], sparseKey),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 5: encodeStreamCheckpoint missing seed (philox.ts:185) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:185) invalid-parameter: rejects missing seed in checkpoint encoding, accepts populated seed", () => {
    // Accept case: populated seed
    const frame = encodeStreamCheckpoint({ seed: "99", kernel: 1, tile: 2, index: "0" });
    assert.equal(frame.length, STREAM_CHECKPOINT_CANONICAL_LEN);

    // Reject case: missing seed
    assert.throws(
      () =>
        encodeStreamCheckpoint({
          kernel: 1,
          tile: 2,
          index: "0",
        } as Parameters<typeof encodeStreamCheckpoint>[0]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 6: encodeStreamCheckpoint missing kernel (philox.ts:193) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:193) invalid-parameter: rejects missing kernel in checkpoint encoding, accepts populated kernel", () => {
    // Accept case: populated kernel
    const frame = encodeStreamCheckpoint({ seed: "99", kernel: 5, tile: 2, index: "0" });
    assert.equal(frame.length, STREAM_CHECKPOINT_CANONICAL_LEN);

    // Reject case: missing kernel
    assert.throws(
      () =>
        encodeStreamCheckpoint({
          seed: "99",
          tile: 2,
          index: "0",
        } as Parameters<typeof encodeStreamCheckpoint>[0]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 7: encodeStreamCheckpoint missing tile (philox.ts:201) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:201) invalid-parameter: rejects missing tile in checkpoint encoding, accepts populated tile", () => {
    // Accept case: populated tile
    const frame = encodeStreamCheckpoint({ seed: "99", kernel: 1, tile: 8, index: "0" });
    assert.equal(frame.length, STREAM_CHECKPOINT_CANONICAL_LEN);

    // Reject case: missing tile
    assert.throws(
      () =>
        encodeStreamCheckpoint({
          seed: "99",
          kernel: 1,
          index: "0",
        } as Parameters<typeof encodeStreamCheckpoint>[0]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 8: encodeStreamCheckpoint missing index (philox.ts:209) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:209) invalid-parameter: rejects missing index in checkpoint encoding, accepts populated index", () => {
    // Accept case: populated index
    const frame = encodeStreamCheckpoint({ seed: "99", kernel: 1, tile: 8, index: "10" });
    assert.equal(frame.length, STREAM_CHECKPOINT_CANONICAL_LEN);

    // Reject case: missing index
    assert.throws(
      () =>
        encodeStreamCheckpoint({
          seed: "99",
          kernel: 1,
          tile: 8,
        } as Parameters<typeof encodeStreamCheckpoint>[0]),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 9: decodeStreamCheckpoint frame length (philox.ts:222) - invalid-checkpoint-length
  // ==========================================================================
  test("site (philox.ts:222) invalid-checkpoint-length: rejects truncated or trailing bytes, accepts canonical 83-byte frame", () => {
    const valid = createValidFrame();
    assert.equal(valid.length, 83);
    const decoded = decodeStreamCheckpoint(valid);
    assert.equal(decoded.checkpointVersion, STREAM_CHECKPOINT_VERSION);

    // Truncated frames
    assert.throws(
      () => decodeStreamCheckpoint(new Uint8Array(82)),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-checkpoint-length");
        return true;
      },
    );
    assert.throws(
      () => decodeStreamCheckpoint(new Uint8Array(0)),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-checkpoint-length");
        return true;
      },
    );

    // Over-long frame (trailing bytes)
    const trailing = new Uint8Array(84);
    trailing.set(valid, 0);
    trailing[83] = 0xff;
    assert.throws(
      () => decodeStreamCheckpoint(trailing),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-checkpoint-length");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 10: decodeStreamCheckpoint magic bytes (philox.ts:230) - invalid-checkpoint-magic
  // ==========================================================================
  test("site (philox.ts:230) invalid-checkpoint-magic: rejects frame with corrupted magic header, accepts valid FSRCKPT\\0", () => {
    const valid = createValidFrame();
    assert.equal(decodeStreamCheckpoint(valid).checkpointVersion, 1);

    // Corrupted magic bytes
    const badMagic = new Uint8Array(valid);
    badMagic[0] = 0x58; // 'X' instead of 'F'
    assert.throws(
      () => decodeStreamCheckpoint(badMagic),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-checkpoint-magic");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 11: decodeStreamCheckpoint domain (philox.ts:238) - invalid-checkpoint-domain
  // ==========================================================================
  test("site (philox.ts:238) invalid-checkpoint-domain: rejects frame with corrupted identity domain, accepts org.frankensim domain", () => {
    const valid = createValidFrame();
    assert.equal(decodeStreamCheckpoint(valid).checkpointVersion, 1);

    // Corrupted identity domain bytes (offset 8..51)
    const badDomain = new Uint8Array(valid);
    badDomain[8] = 0x58; // corrupt first character of domain
    assert.throws(
      () => decodeStreamCheckpoint(badDomain),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-checkpoint-domain");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 12: decodeStreamCheckpoint checkpointVersion (philox.ts:247) - unknown-checkpoint-version
  // ==========================================================================
  test("site (philox.ts:247) unknown-checkpoint-version: rejects frame with unsupported checkpoint version, accepts version 1", () => {
    const valid = createValidFrame();
    assert.equal(decodeStreamCheckpoint(valid).checkpointVersion, 1);

    // Offset 51: checkpointVersion u32 LE set to 2
    const badVersion = new Uint8Array(valid);
    const view = new DataView(badVersion.buffer, badVersion.byteOffset, badVersion.byteLength);
    view.setUint32(51, 2, true);

    assert.throws(
      () => decodeStreamCheckpoint(badVersion),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "unknown-checkpoint-version");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 13: decodeStreamCheckpoint streamSemanticsVersion (philox.ts:255) - unknown-stream-semantics-version
  // ==========================================================================
  test("site (philox.ts:255) unknown-stream-semantics-version: rejects frame with unsupported stream semantics version, accepts version 1", () => {
    const valid = createValidFrame();
    assert.equal(decodeStreamCheckpoint(valid).streamSemanticsVersion, 1);

    // Offset 55: streamSemanticsVersion u32 LE set to 99
    const badSemantics = new Uint8Array(valid);
    const view = new DataView(
      badSemantics.buffer,
      badSemantics.byteOffset,
      badSemantics.byteLength,
    );
    view.setUint32(55, 99, true);

    assert.throws(
      () => decodeStreamCheckpoint(badSemantics),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "unknown-stream-semantics-version");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 14: createPhiloxStream checkpointVersion (philox.ts:287) - unknown-checkpoint-version
  // ==========================================================================
  test("site (philox.ts:287) unknown-checkpoint-version: rejects checkpoint object with unsupported checkpoint version, accepts version 1", () => {
    const valid = decodeStreamCheckpoint(createValidFrame());
    const stream = createPhiloxStream(valid);
    assert.equal(typeof stream.nextU64(), "bigint");

    // Invalid checkpointVersion in object
    const badCkpt = {
      ...valid,
      checkpointVersion: 999,
    };

    assert.throws(
      () => createPhiloxStream(badCkpt),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "unknown-checkpoint-version");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 15: createPhiloxStream streamSemanticsVersion (philox.ts:293) - unknown-stream-semantics-version
  // ==========================================================================
  test("site (philox.ts:293) unknown-stream-semantics-version: rejects checkpoint object with unsupported stream semantics version, accepts version 1", () => {
    const valid = decodeStreamCheckpoint(createValidFrame());
    const stream = createPhiloxStream(valid);
    assert.equal(typeof stream.nextU64(), "bigint");

    // Invalid streamSemanticsVersion in object
    const badCkpt = {
      ...valid,
      streamSemanticsVersion: 999,
    };

    assert.throws(
      () => createPhiloxStream(badCkpt),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "unknown-stream-semantics-version");
        return true;
      },
    );
  });

  // ==========================================================================
  // Site 16: nextBelow(0) rejection (philox.ts:380) - invalid-parameter
  // ==========================================================================
  test("site (philox.ts:380) invalid-parameter: rejects nextBelow(0) and nextBelow(0n), accepts n > 0", () => {
    const stream = createPhiloxStream({ seed: "123", kernel: 0, tile: 0 });

    // Accept cases: n > 0 (bigint)
    const b1 = stream.nextBelow(1n);
    assert.equal(b1, 0n);
    const b10 = stream.nextBelow(10n);
    assert.ok(b10 >= 0n && b10 < 10n);
    const b100 = stream.nextBelow(100n);
    assert.ok(b100 >= 0n && b100 < 100n);

    // Reject cases: n === 0 or "0"
    assert.throws(
      () => stream.nextBelow(0n),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
    assert.throws(
      () => stream.nextBelow("0" as unknown as bigint),
      (err: unknown) => {
        assert.ok(err instanceof StreamInputError);
        assert.equal(err.code, "invalid-parameter");
        return true;
      },
    );
  });
});
