/**
 * Measurement change contract test (am-rt-command-classes-dzp).
 *
 * "change exposure and localization error on the seeded walk; latentPathDigest identical;
 * only the noise stream counter advances by the declared number of draws."
 */
import { describe, expect, it } from "bun:test";
import {
  createSeededWalkFixture,
  generateBaseLatentPath,
} from "./runtime-fixtures/seededWalkFixture.ts";

describe("Measurement Change Contract (am-rt-command-classes-dzp)", () => {
  it("keeps latentPathDigest bitwise identical when exposure and localization error vary", async () => {
    const baseLatentPath = generateBaseLatentPath();

    // Measurement 1: 0.1 s exposure, 0.05 localization error
    const m1 = await createSeededWalkFixture({
      observationIntervalSeconds: 0.2,
      exposureTimeSeconds: 0.1,
      localizationError: 0.05,
      baseLatentPath,
      noiseSeed: 101,
    });

    // Measurement 2: 0.5 s exposure, 0.20 localization error (different observation settings)
    const m2 = await createSeededWalkFixture({
      observationIntervalSeconds: 0.5,
      exposureTimeSeconds: 0.5,
      localizationError: 0.2,
      baseLatentPath,
      noiseSeed: 202,
    });

    // Measurement 3: 0.0 s exposure, 0.0 localization error (ideal measurement)
    const m3 = await createSeededWalkFixture({
      observationIntervalSeconds: 1.0,
      exposureTimeSeconds: 0.0,
      localizationError: 0.0,
      baseLatentPath,
      noiseSeed: 303,
    });

    // 1. Latent path digest must be strictly bitwise identical across all measurements
    expect(m1.latentPathDigest).toBe(m2.latentPathDigest);
    expect(m2.latentPathDigest).toBe(m3.latentPathDigest);

    // 2. Latent draw counters must be identical
    expect(m1.drawCounters.latent).toBe(m2.drawCounters.latent);
    expect(m2.drawCounters.latent).toBe(m3.drawCounters.latent);

    // 3. Observed data digest should differ because measurement models and samples differ
    expect(m1.observationDataDigest).not.toBe(m2.observationDataDigest);

    // 4. Noise stream draws match the number of sampled points
    expect(m1.drawCounters.noise).toBe(m1.observedSamples.length * 2);
    expect(m2.drawCounters.noise).toBe(m2.observedSamples.length * 2);
  });
});
