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

  test("BM-06's listings include every kernel named here, each with real pinned source", () => {
    // WAS `expect(listings.length).toBe(7)`, which broke on correct work: adding catalogue entries for
    // moments and mostLikelyRadius2d took it to 9 and turned this red while nothing it protects had
    // changed. The identity assertions below are what the test is for and they hold at any size, so
    // the census is replaced by them plus an explicit floor, per AGENTS.md's rule that a count is for
    // reporting and a property is for asserting. A listing may be ADDED here without touching this
    // test; one may not disappear.
    const listings = getKernelListingsForInstrument("bm-06");
    const names = listings.map((l) => l.exportName);
    for (const expected of [
      "gaussianPropagator",
      "intervalProbability",
      "erf",
      "erfc",
      "radialPropagator2d",
      "radialPropagator3d",
      "ftcs1d",
      "moments",
      "mostLikelyRadius2d",
    ])
      expect(names).toContain(expected);
    // Non-vacuity, on purpose: an empty listings array would satisfy no toContain above, but the
    // per-listing loop below would also iterate zero times and pass, so the floor is stated.
    expect(listings.length).toBeGreaterThanOrEqual(9);

    for (const listing of listings) {
      expect(listing.source).toBeTruthy();
      expect(listing.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  test("returns empty array for unknown instrument", () => {
    const listings = getKernelListingsForInstrument("unknown-inst");
    expect(listings).toEqual([]);
  });

  describe("digest mismatch refusal and matching positive render", () => {
    test("mismatched digest renders a typed refusal with data-refusal-code=stale-kernel-listing and suppresses code/trace", async () => {
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { ShowTheCode } = await import("../../components/lab/ShowTheCode.tsx");
      const listings = getKernelListingsForInstrument("bm-01");
      const stokesListing = listings.find((l) => l.exportName === "stokesEinsteinD");
      expect(stokesListing).toBeDefined();
      if (!stokesListing) return;

      const mismatchedSnapshotDigest =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

      const html = renderToStaticMarkup(
        ShowTheCode({
          listings: [stokesListing],
          producedCurrentSnapshot: true,
          snapshotFunctionName: "stokesEinsteinD",
          snapshotSourceDigest: mismatchedSnapshotDigest,
        }),
      );

      // Assert typed refusal by code, not just message substring
      expect(html).toContain('data-refusal-code="stale-kernel-listing"');
      expect(html).toContain('class="kernel-refusal kernel-digest-mismatch"');
      // Verify code and trace elements are suppressed
      expect(html).not.toContain('<code data-language="ts">');
      expect(html).not.toContain('class="kernel-trace"');
    });

    test("matching digest renders code without refusal and binds quantity identifiers", async () => {
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { ShowTheCode } = await import("../../components/lab/ShowTheCode.tsx");
      const listings = getKernelListingsForInstrument("bm-01");
      const stokesListing = listings.find((l) => l.exportName === "stokesEinsteinD");
      expect(stokesListing).toBeDefined();
      if (!stokesListing?.sourceHash) return;

      const matchingSnapshotDigest = stokesListing.sourceHash;

      const html = renderToStaticMarkup(
        ShowTheCode({
          listings: [stokesListing],
          producedCurrentSnapshot: true,
          snapshotFunctionName: "stokesEinsteinD",
          snapshotSourceDigest: matchingSnapshotDigest,
        }),
      );

      // Assert no refusal code is rendered
      expect(html).not.toContain("data-refusal-code");
      expect(html).not.toContain("kernel-refusal");
      // Assert positive capability: code tokens and trace table render
      expect(html).toContain('<code data-language="ts">');
      expect(html).toContain('class="kernel-trace"');
      expect(html).toContain('data-quantity-id="diffusionCoefficient"');
      expect(html).toContain("This is the function that produced the numbers shown now.");
    });
  });
});
