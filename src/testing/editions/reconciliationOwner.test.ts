/**
 * RECONCILIATION HAS ONE OWNER, AND THE THREE RULES THE SECOND COPY DID NOT HAVE.
 *
 * `segmentLedger` carried its own twenty-five-line reconciliation and the pipeline called THAT,
 * so `reconcileManifest` -- the owner, with the boundary rule, the reference check and the
 * pairing -- ran only in its own tests. Measured 2026-10-20 over the three papers whose German
 * face pairs, the divergence cost 147 false differences of 258:
 *
 *     mass-energy       35 -> 12
 *     brownian-motion  103 -> 39
 *     light-quanta     120 -> 60
 *
 * The first test below is the one that keeps it that way: it asserts the two agree over the real
 * corpus, which holds whatever either of them does and goes red the moment a copy reappears. The
 * rest are the plants, each for a rule the copy lacked, with the negative control beside it.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { loadGermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import { inspectLedgerPresence } from "../../content/editions/ledgerPresence.ts";
import {
  frozenIdUnder,
  reconcileManifest,
  referenceIdOf,
} from "../../content/editions/reconciliation.ts";
import { segmentLedger } from "../../content/editions/segmentLedger.ts";
import { validateSourceManifest } from "../../content/manifest/schema.ts";

const ROOT = process.cwd();
/** The three papers whose German face pairs; relativity's receipt holds its ledger back. */
const PAIRED = ["mass-energy", "brownian-motion", "light-quanta"] as const;

function corpus(slug: (typeof PAIRED)[number]) {
  const manifestPath = join(ROOT, "content/source-blocks", slug, "manifest.yaml");
  const manifest = validateSourceManifest(
    parseYaml(readFileSync(manifestPath, "utf8")),
    manifestPath,
  );
  const presence = inspectLedgerPresence(slug, ROOT);
  const ledgerText = readFileSync(join(ROOT, presence.path), "utf8");
  const anchorOf = (loadGermanSourceFace(slug, ROOT)?.anchors.anchorOf ?? {}) as Record<
    string,
    string
  >;
  return { manifest, ledgerText, anchorOf, frozenIds: manifest.units.map((u) => u.id) };
}

describe("one owner for the reconciliation rule", () => {
  test("segmentLedger's differences are reconcileManifest's, on all three papers", () => {
    // The anti-regression control, and the reason it is written as an equality rather than as a
    // count: it cannot go stale as the corpus changes, and it fails on the reappearance of a
    // second implementation however that implementation behaves.
    const census: string[] = [];
    for (const slug of PAIRED) {
      const { ledgerText, frozenIds, anchorOf } = corpus(slug);
      const segmented = segmentLedger({ ledgerText, frozenIds, anchorOf });
      expect(segmented.status, slug).toBe("proposed");
      if (segmented.status !== "proposed") continue;
      const owner = reconcileManifest({ blocks: segmented.blocks, frozenIds, anchorOf });
      expect(
        segmented.differences.map((d) => d.differenceId),
        slug,
      ).toEqual(owner.map((d) => d.differenceId));
      census.push(`${slug} ${segmented.differences.length}`);
    }
    console.log(
      `[census] reconciliation differences, segmenter and owner agreeing: ${census.join(", ")}`,
    );
    expect(census).toHaveLength(PAIRED.length);
  });

  test("the differences are a real population, and far smaller than before the wiring", () => {
    // Reported with its denominator rather than frozen: the numbers move when the segmentation
    // rules or the manifests change, and they should. What is asserted is that reconciliation
    // reaches a verdict over hundreds of units and that the verdict is not "everything differs".
    for (const slug of PAIRED) {
      const { ledgerText, frozenIds, anchorOf } = corpus(slug);
      const segmented = segmentLedger({ ledgerText, frozenIds, anchorOf });
      if (segmented.status !== "proposed") continue;
      expect(frozenIds.length, slug).toBeGreaterThan(50);
      expect(
        segmented.differences.length,
        `${slug}: ${segmented.differences.length} differences`,
      ).toBeLessThan(frozenIds.length / 2);
    }
  });
});

describe("a sentence is paired through its block", () => {
  test("the structural rule, and the map still wins where it speaks", () => {
    const anchorOf = { "s1-p4": "s1-p3", "s0-eq1": "eq-s0-d1", "s9-p1-s2": "s9-p9-s9" };
    // A sentence and an inline region under a renamed block take the block's frozen name.
    expect(frozenIdUnder("s1-p4-s2", anchorOf)).toBe("s1-p3-s2");
    expect(frozenIdUnder("s1-p4-s2-m3", anchorOf)).toBe("s1-p3-s2-m3");
    expect(frozenIdUnder("s1-p4-s1a", anchorOf)).toBe("s1-p3-s1a");
    // A block the map names keeps its mapping; one it does not keeps its own name.
    expect(frozenIdUnder("s1-p4", anchorOf)).toBe("s1-p3");
    expect(frozenIdUnder("s2-p1-s1", anchorOf)).toBe("s2-p1-s1");
    // An explicit entry for a sentence overrides the structural rule, so a future pairing that
    // enumerates sentences is not fought by this.
    expect(frozenIdUnder("s9-p1-s2", anchorOf)).toBe("s9-p9-s9");
    // A bare section id is not sentence-shaped and must not be rewritten.
    expect(frozenIdUnder("s3", anchorOf)).toBe("s3");
    expect(frozenIdUnder("part-1", anchorOf)).toBe("part-1");
  });

  test("a frozen sentence under a renamed block is no longer reported missing", () => {
    const blocks = [
      {
        id: "s1-p4",
        kind: "paragraph" as const,
        text: "Es liege ein Koordinatensystem vor. Wir nennen dies System das ruhende.",
        sentences: [
          { id: "s1-p4-s1", text: "Es liege ein Koordinatensystem vor." },
          { id: "s1-p4-s2", text: "Wir nennen dies System das ruhende." },
        ],
      },
    ];
    const anchorOf = { "s1-p4": "s1-p3" };
    const paired = reconcileManifest({
      blocks,
      frozenIds: ["s1-p3", "s1-p3-s1", "s1-p3-s2"],
      anchorOf,
    });
    expect(paired).toEqual([]);
    // The control: WITHOUT the pairing the same proposal differs, so the test above is not passing
    // because the comparison is inert.
    const unpaired = reconcileManifest({
      blocks,
      frozenIds: ["s1-p3", "s1-p3-s1", "s1-p3-s2"],
    });
    expect(unpaired.length).toBeGreaterThan(0);
  });
});

describe("the proposal's inline-math ids are read", () => {
  test("an inline unit the proposal carries is not reported missing", () => {
    const blocks = [
      {
        id: "s0-p5",
        kind: "paragraph" as const,
        text: "Die Masse eines Körpers ist ein Maß für seinen Energieinhalt.",
        sentences: [
          {
            id: "s0-p5-s1",
            text: "Die Masse eines Körpers ist ein Maß für seinen Energieinhalt.",
            inlineMathIds: ["s0-p5-s1-m1", "s0-p5-s1-m2"],
          },
        ],
      },
    ];
    const found = reconcileManifest({
      blocks,
      frozenIds: ["s0-p5", "s0-p5-s1", "s0-p5-s1-m1", "s0-p5-s1-m2"],
    });
    expect(found).toEqual([]);
  });

  test("an inline unit the proposal does NOT carry is still reported", () => {
    // The negative control. Reading the field must not turn the rule into a pass: m3 is frozen and
    // the proposal names two regions, so m3 is a real absence and stays reported.
    const blocks = [
      {
        id: "s0-p5",
        kind: "paragraph" as const,
        text: "Ein Satz.",
        sentences: [{ id: "s0-p5-s1", text: "Ein Satz.", inlineMathIds: ["s0-p5-s1-m1"] }],
      },
    ];
    const missing = reconcileManifest({
      blocks,
      frozenIds: ["s0-p5", "s0-p5-s1", "s0-p5-s1-m1", "s0-p5-s1-m3"],
    });
    expect(missing.map((d) => d.unitId)).toEqual(["s0-p5-s1-m3"]);
  });

  test("an inline id under a renamed block pairs too", () => {
    const blocks = [
      {
        id: "s1-p4",
        kind: "paragraph" as const,
        text: "Ein Satz.",
        sentences: [{ id: "s1-p4-s1", text: "Ein Satz.", inlineMathIds: ["s1-p4-s1-m1"] }],
      },
    ];
    const paired = reconcileManifest({
      blocks,
      frozenIds: ["s1-p3", "s1-p3-s1", "s1-p3-s1-m1"],
      anchorOf: { "s1-p4": "s1-p3" },
    });
    expect(paired).toEqual([]);
  });
});

describe("a reference occurrence is read in either shape", () => {
  test("the manifest's own record shape yields its id", () => {
    // The real manifests carry objects: 3, 7, 26 and 18 units across the four papers have a
    // non-empty references array, and every element is a record. Read as a string, each produced
    // the characters of "[object Object]" as both the id and the message's quoted name.
    expect(referenceIdOf({ id: "s0-fn1-r1", occurrenceId: "s0-fn1-r1" })).toBe("s0-fn1-r1");
    expect(referenceIdOf({ occurrenceId: "s2-p1-r1" })).toBe("s2-p1-r1");
    expect(referenceIdOf("s3-p2-s1-r2")).toBe("s3-p2-s1-r2");
    expect(referenceIdOf({})).toBeUndefined();
    expect(referenceIdOf("")).toBeUndefined();
  });

  test("the difference names the reference, not an object", () => {
    const differences = reconcileManifest({
      blocks: [
        {
          id: "s0-fn1",
          kind: "footnote" as const,
          text: "A. Einstein, Ann. d. Phys. 17. p. 891. 1905.",
          sentences: [{ id: "s0-fn1", text: "A. Einstein, Ann. d. Phys. 17. p. 891. 1905." }],
        },
      ],
      manifestUnits: [
        {
          id: "s0-fn1",
          kind: "footnote",
          references: [{ id: "s0-fn1-r1", occurrenceId: "s0-fn1-r1" }],
        },
      ],
    });
    const reference = differences.find((d) => d.unitId === "s0-fn1-r1");
    expect(reference).toBeDefined();
    expect(reference?.message).toContain("s0-fn1-r1");
    for (const difference of differences) {
      expect(difference.unitId).not.toContain("[object Object]");
      expect(difference.message).not.toContain("[object Object]");
    }
  });
});

describe("the message says which name was looked up", () => {
  test("a renamed block's absence names the published id as well as the proposal id", () => {
    const differences = reconcileManifest({
      blocks: [{ id: "s1-p9", kind: "paragraph" as const, text: "Ein Satz.", sentences: [] }],
      frozenIds: ["s1-p1"],
      anchorOf: { "s1-p9": "s1-p12" },
    });
    // Two differences, and the one under test is the extra block: the frozen s1-p1 the proposal
    // does not produce is correctly reported beside it.
    const extra = differences.find((d) => d.kind === "unit-extra-in-ledger");
    expect(extra).toBeDefined();
    expect(extra?.message).toContain("s1-p9");
    expect(extra?.message).toContain("s1-p12");
  });

  test("an unpaired block's absence names it once", () => {
    const differences = reconcileManifest({
      blocks: [{ id: "s1-p9", kind: "paragraph" as const, text: "Ein Satz.", sentences: [] }],
      frozenIds: ["s1-p1"],
    });
    const extra = differences.find((d) => d.kind === "unit-extra-in-ledger");
    expect(extra?.message).toBe('Proposed block "s1-p9" is not in the frozen manifest.');
  });
});
