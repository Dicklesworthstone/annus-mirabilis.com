import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ControlTapeRecorder } from "../experiments/tapes/recorder.ts";
import { type TapeModelIdentity, validateControlTape } from "../experiments/tapes/schema.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const boundariesFixture = JSON.parse(
  readFileSync(resolve(ROOT, "src/testing/fixtures/u64-boundaries.json"), "utf-8"),
) as { valid: string[]; formatViolations: string[]; overflows: string[] };

const modelIdentity: TapeModelIdentity = {
  modelId: "brownian-motion-reference",
  modelVersion: "1.0.0",
  artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

describe("tapes.u64: 64-Bit Seed Identity and Boundary Vectors (am-rt-control-tapes-0gc)", () => {
  it("all valid u64 boundary seeds round-trip through tapes without precision loss", () => {
    for (const seedStr of boundariesFixture.valid) {
      const recorder = new ControlTapeRecorder({
        tapeId: "seed-boundary-tape",
        experimentId: "bm-01",
        mode: "bm-01:default",
        modelIdentity,
        constantSetId: "einstein-1905-brownian-printed",
        seed: seedStr,
        streamVersion: 1,
        allocationId: "alloc-0",
        initialConditions: { viscosity: 1.35e-3 },
      });

      const tape = recorder.getTape();
      assert.equal(tape.seed, seedStr, `Seed ${seedStr} did not preserve string identity`);

      const revalidated = validateControlTape(tape);
      assert.equal(revalidated.seed, seedStr);
    }
  });

  it("seeds 9007199254740993 (2^53+1) and 18446744073709551615 (2^64-1) round-trip exactly", () => {
    const seed2_53_plus_1 = "9007199254740993";
    const seedMaxU64 = "18446744073709551615";

    const tape1 = validateControlTape({
      tapeVersion: 2,
      tapeId: "seed-test-1",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: seed2_53_plus_1,
      streamVersion: 1,
      allocationId: "alloc-0",
      initialConditions: { x: 1 },
      events: [],
      checkpoints: [],
    });
    assert.equal(tape1.seed, seed2_53_plus_1);

    const tape2 = validateControlTape({
      tapeVersion: 2,
      tapeId: "seed-test-2",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: seedMaxU64,
      streamVersion: 1,
      allocationId: "alloc-0",
      initialConditions: { x: 1 },
      events: [],
      checkpoints: [],
    });
    assert.equal(tape2.seed, seedMaxU64);
  });

  it("rejects format violations and overflows from fixture", () => {
    const invalidSeeds = [...boundariesFixture.formatViolations, ...boundariesFixture.overflows];

    for (const badSeed of invalidSeeds) {
      assert.throws(
        () =>
          validateControlTape({
            tapeVersion: 2,
            tapeId: "bad-seed-tape",
            experimentId: "bm-01",
            mode: "bm-01:default",
            modelIdentity,
            constantSetId: "einstein-1905-brownian-printed",
            seed: badSeed,
            streamVersion: 1,
            allocationId: "alloc-0",
            initialConditions: { x: 1 },
            events: [],
            checkpoints: [],
          }),
        /u64|tape/i,
      );
    }
  });
});
