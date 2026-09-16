import { describe, expect, it } from "bun:test";
import { parseU64, randomU64Seed, type U64String } from "../../experiments/identity/u64.ts";
import { createStreamKey } from "../../experiments/streams/allocation.ts";
import { createPhiloxStream } from "../../physics/reference/philox.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

describe("New Trial and Seed Replay Invariants", () => {
  const logger = new TestLogger("runtime-identity", newRunIdentity());

  it("replays identically with the same recorded seed and branches with a new trial", () => {
    // 1. New trial mints a fresh canonical seed from ambient entropy
    const trial1Seed = randomU64Seed();
    expect(parseU64(trial1Seed)).toBe(trial1Seed);

    const key1 = createStreamKey("bm-01.latent.v1", trial1Seed, 0, 0);
    const rng1a = createPhiloxStream(key1, "0");
    const draws1a = [rng1a.nextF64(), rng1a.nextF64(), rng1a.nextF64()];

    // 2. Same seed replays identical draws
    const rng1b = createPhiloxStream(key1, "0");
    const draws1b = [rng1b.nextF64(), rng1b.nextF64(), rng1b.nextF64()];

    expect(draws1a).toEqual(draws1b);

    // 3. A second new trial produces a distinct seed and draws
    const trial2Seed = randomU64Seed();
    expect(trial2Seed).not.toBe(trial1Seed);

    const key2 = createStreamKey("bm-01.latent.v1", trial2Seed, 0, 0);
    const rng2 = createPhiloxStream(key2, "0");
    const draws2 = [rng2.nextF64(), rng2.nextF64(), rng2.nextF64()];

    expect(draws2).not.toEqual(draws1a);

    logger.log({
      testId: "new-trial-replay",
      beadId: "am-rt-u64-identities-7ce",
      seed: trial1Seed,
      streamVersion: 1,
      expected: draws1a,
      actual: draws1b,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: {
        trial1Seed,
        trial2Seed,
        allocationId: "bm-01.latent.v1",
      },
    });
  });

  it("verifies injected entropy source deterministically sets seed and replays", () => {
    const injectedEntropy = (w0: number, w1: number): U64String => {
      const big = (BigInt(w1 >>> 0) << 32n) | BigInt(w0 >>> 0);
      return parseU64(big.toString());
    };

    const fixedSeed = injectedEntropy(0x12345678, 0x9abcdef0);
    expect(fixedSeed).toBe("11150031900141442680" as U64String);

    const key = createStreamKey("bm-05.walk.v1", fixedSeed, 42);
    const stream1 = createPhiloxStream(key, "0");
    const stream2 = createPhiloxStream(key, "0");

    const vals1 = [stream1.nextNormal(), stream1.nextNormal()];
    const vals2 = [stream2.nextNormal(), stream2.nextNormal()];

    expect(vals1).toEqual(vals2);
  });
});
