import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { KernelListing } from "../../content/kernel/types.ts";
import bm06Example from "../../generated/bm06-example.json" with { type: "json" };
import kernelListings from "../../generated/kernel-listings.json" with { type: "json" };
import { ShowTheCode } from "./ShowTheCode.tsx";

/**
 * Drives ShowTheCode with the exact values production supplies (am-70h7): the real
 * generated kernel listings for bm-06 and the real recorded snapshot hash from the
 * generated worked example. The component's existing tests feed it a function hash
 * where production fed a module-closure digest, so green there never proved the
 * wiring - the listing claiming the current snapshot was refused on every page.
 */
const listings = (kernelListings as Record<string, readonly KernelListing[]>)["bm-06"] ?? [];

const render = (snapshotSourceDigest: string) =>
  renderToStaticMarkup(
    <ShowTheCode
      listings={listings}
      snapshotSourceDigest={snapshotSourceDigest}
      producedCurrentSnapshot={true}
      snapshotFunctionName={bm06Example.snapshotFunctionName}
      uid="wiring-test"
    />,
  );

describe("ShowTheCode against the values production supplies", () => {
  test("the recorded snapshot hash renders the function's implementation, not a refusal", () => {
    const html = render(bm06Example.snapshotFunctionHash);
    expect(html).not.toContain('data-refusal-code="stale-kernel-listing"');
    expect(html).toContain("This is the function that produced the numbers shown now");
    expect(html).toContain("gaussianPropagator");
  });

  test("a snapshot hash that disagrees with the listing still refuses", () => {
    // Planted negative. One character, so the only difference from the passing case
    // is the value being compared: the guard must be live, not decorative.
    const recorded = bm06Example.snapshotFunctionHash;
    const perturbed = `${recorded.slice(0, -1)}${recorded.endsWith("a") ? "b" : "a"}`;
    expect(perturbed).not.toBe(recorded);
    const html = render(perturbed);
    expect(html).toContain('data-refusal-code="stale-kernel-listing"');
    expect(html).toContain("Source listing refused");
  });

  test("a module-closure digest is refused, which is the defect this bead names", () => {
    // What every production caller passed before this change.
    const html = render(bm06Example.sourceDigest);
    expect(bm06Example.sourceDigest.startsWith("source:sha256:")).toBe(true);
    expect(html).toContain('data-refusal-code="stale-kernel-listing"');
  });

  test("a listing that does not claim the snapshot is never refused", () => {
    const html = render(bm06Example.snapshotFunctionHash);
    const other = listings.find((l) => l.exportName !== bm06Example.snapshotFunctionName);
    expect(other).toBeDefined();
    expect(html).toContain(other?.exportName ?? "");
    expect((html.match(/data-refusal-code/g) ?? []).length).toBe(0);
  });
});
