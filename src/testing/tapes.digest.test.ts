import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseU64 } from "../experiments/identity/u64.ts";
import { computeCheckpointDigest, validateDigestPrefix } from "../experiments/tapes/digest.ts";

describe("tapes.digest: Checkpoint Digest Rules and Collision Regressions (am-rt-control-tapes-0gc)", () => {
  it("digest is written host:sha256:<hex> and labeled host, never blake3", async () => {
    const res = await computeCheckpointDigest({
      state: { viscosity: 1.35e-3, particleRadius: 5e-7 },
      actionIndex: 1,
      stepIndex: 60,
      simulatedTime: 1.0,
      seed: "9007199254740993",
    });

    assert.equal(res.digestKind, "host");
    assert.match(res.digest, /^host:sha256:[0-9a-f]{64}$/);
    assert.doesNotMatch(res.digest, /blake3/);
    assert.equal(validateDigestPrefix(res.digest, "host"), true);
    assert.equal(validateDigestPrefix(res.digest, "blake3"), false);
  });

  it("the donor collision regression: seed 1 vs seed 4294967297 produce different checkpoint digests", async () => {
    const base = {
      state: { viscosity: 1.35e-3 },
      actionIndex: 0,
      stepIndex: 0,
      simulatedTime: 0,
    };

    const d1 = await computeCheckpointDigest({ ...base, seed: "1" });
    const d2 = await computeCheckpointDigest({ ...base, seed: "4294967297" });

    assert.notEqual(d1.digest, d2.digest);
  });

  it("field order in state map does not affect digest", async () => {
    const d1 = await computeCheckpointDigest({
      state: { a: 1, b: 2, c: 3 },
      actionIndex: 1,
      stepIndex: 1,
      simulatedTime: 0.1,
      seed: "42",
    });

    const d2 = await computeCheckpointDigest({
      state: { c: 3, a: 1, b: 2 },
      actionIndex: 1,
      stepIndex: 1,
      simulatedTime: 0.1,
      seed: "42",
    });

    assert.equal(d1.digest, d2.digest);
  });

  it("streamPositions are included in checkpoint digest when present", async () => {
    const base = {
      state: { viscosity: 1.35e-3 },
      actionIndex: 2,
      stepIndex: 120,
      simulatedTime: 2.0,
      seed: "9007199254740993",
    };

    const withoutStreams = await computeCheckpointDigest(base);
    const withStreams = await computeCheckpointDigest({
      ...base,
      streamPositions: [
        {
          allocationId: "alloc-0",
          streamKernelId: "philox-4x32-10",
          tile: parseU64("100"),
          index: parseU64("400"),
        },
      ],
    });

    assert.notEqual(withoutStreams.digest, withStreams.digest);
  });
});
