import { describe, expect, test } from "bun:test";
import { getKernelListingsForInstrument } from "./listings.ts";

describe("getKernelListingsForInstrument", () => {
  test("returns all 5 listings for BM-01 with source, hash, and trace", () => {
    const listings = getKernelListingsForInstrument("bm-01");
    expect(listings.length).toBe(5);

    const names = listings.map((l) => l.exportName);
    expect(names).toContain("stokesEinsteinD");
    expect(names).toContain("rmsDisplacement");
    expect(names).toContain("apparentSpeed");
    expect(names).toContain("ensembleMoments");
    expect(names).toContain("displacementHistogram");

    const stokes = listings.find((l) => l.exportName === "stokesEinsteinD");
    expect(stokes).toBeDefined();
    expect(stokes?.source).toContain("export function stokesEinsteinD");
    expect(stokes?.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(stokes?.identifierBindings.length).toBeGreaterThanOrEqual(4);
    expect(stokes?.trace).toBeDefined();
    expect(stokes?.trace?.rows.length).toBe(7);
  });

  test("returns all 4 listings for BM-05", () => {
    const listings = getKernelListingsForInstrument("bm-05");
    expect(listings.length).toBe(4);
    const names = listings.map((l) => l.exportName);
    expect(names).toContain("kernelDiffusivity");
    expect(names).toContain("randomWalkMoments");
    expect(names).toContain("coinWalkDistribution");
    expect(names).toContain("recordWalks");

    for (const listing of listings) {
      expect(listing.source).toBeTruthy();
      expect(listing.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(listing.words).toBeTruthy();
    }
  });

  test("returns all 7 listings for BM-06", () => {
    const listings = getKernelListingsForInstrument("bm-06");
    expect(listings.length).toBe(7);
    const names = listings.map((l) => l.exportName);
    expect(names).toContain("gaussianPropagator");
    expect(names).toContain("intervalProbability");
    expect(names).toContain("erf");
    expect(names).toContain("erfc");
    expect(names).toContain("radialPropagator2d");
    expect(names).toContain("radialPropagator3d");
    expect(names).toContain("ftcs1d");

    for (const listing of listings) {
      expect(listing.source).toBeTruthy();
      expect(listing.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  test("returns empty array for unknown instrument", () => {
    const listings = getKernelListingsForInstrument("unknown-inst");
    expect(listings).toEqual([]);
  });
});
