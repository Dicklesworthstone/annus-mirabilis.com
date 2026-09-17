import assert from "node:assert/strict";
import { describe, test } from "node:test";
import bm01Example from "../../generated/bm01-example.json" with { type: "json" };
import bm05Example from "../../generated/bm05-example.json" with { type: "json" };
import bm06Example from "../../generated/bm06-example.json" with { type: "json" };
import kernelListings from "../../generated/kernel-listings.json" with { type: "json" };
import type { KernelListing } from "./types.ts";

/**
 * The staleness guard ShowTheCode enforces at render time, enforced here at build
 * time as well (am-70h7).
 *
 * Two prepare steps write these two files from the same source. `prepare:content`
 * runs scripts/extract-kernel-source.ts, which writes each listing's `sourceHash`.
 * `prepare:lab` runs scripts/generate-lab.mjs, which runs the worked example and
 * records `snapshotFunctionHash` for the function it called. They agree only when
 * both are current; editing the reference function and regenerating one but not
 * the other makes them diverge, which is exactly the "stale or mismatched listing"
 * the reader-facing refusal exists to catch.
 *
 * Before am-70h7 the component compared the listing's `sha256:` function hash
 * against the example's `source:sha256:` module-closure digest. Those carry
 * different prefixes and can never be equal, so the listing that claimed the
 * current snapshot was refused on all seven pages that render Show the Code, and
 * the code it promises to show never appeared once in production.
 */
const listings = kernelListings as Record<string, readonly KernelListing[]>;

const SNAPSHOT_CLAIMS: readonly {
  instrumentId: string;
  functionName: string;
  recordedHash: string;
}[] = [
  {
    instrumentId: "bm-01",
    functionName: bm01Example.snapshotFunctionName,
    recordedHash: bm01Example.snapshotFunctionHash,
  },
  {
    instrumentId: "bm-05",
    functionName: bm05Example.snapshotFunctionName,
    recordedHash: bm05Example.snapshotFunctionHash,
  },
  {
    instrumentId: "bm-06",
    functionName: bm06Example.snapshotFunctionName,
    recordedHash: bm06Example.snapshotFunctionHash,
  },
];

describe("a worked example and its kernel listing agree on the function that produced it", () => {
  for (const claim of SNAPSHOT_CLAIMS) {
    test(`${claim.instrumentId} records the hash of ${claim.functionName} that its listing carries`, () => {
      const forInstrument = listings[claim.instrumentId] ?? [];
      const listing = forInstrument.find((entry) => entry.exportName === claim.functionName);
      assert.ok(
        listing,
        `No kernel listing for "${claim.functionName}" under ${claim.instrumentId}. ` +
          "Show the Code cannot display the function that produced the snapshot.",
      );
      assert.equal(
        claim.recordedHash,
        listing.sourceHash,
        `${claim.instrumentId} recorded ${claim.recordedHash} for ${claim.functionName} but its ` +
          `listing carries ${listing.sourceHash}. One of prepare:lab or prepare:content is stale; ` +
          "rerun both rather than editing either recorded value.",
      );
    });

    test(`${claim.instrumentId} records a function hash, not a module-closure digest`, () => {
      // The defect this file exists for: a source:sha256: closure digest compared
      // against a sha256: function hash can never match, so the guard fired always.
      assert.match(claim.recordedHash, /^sha256:[0-9a-f]{64}$/);
      assert.ok(!claim.recordedHash.startsWith("source:"));
    });
  }

  test("a changed function source makes the recorded hash disagree with its listing", () => {
    // Planted negative: the comparison the two tests above rely on must be able to
    // fail. Perturbing either side by one character must be detected.
    const listing = (listings["bm-06"] ?? []).find(
      (entry) => entry.exportName === bm06Example.snapshotFunctionName,
    );
    assert.ok(listing);
    const { sourceHash } = listing;
    assert.ok(sourceHash, "The bm-06 listing carries no sourceHash to compare against.");
    const perturbed = `${sourceHash.slice(0, -1)}${sourceHash.endsWith("a") ? "b" : "a"}`;
    assert.notEqual(perturbed, bm06Example.snapshotFunctionHash);
  });
});
