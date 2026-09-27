/**
 * THE COMPLETENESS AUTHORITY MUST BE ABLE TO TELL A FILLED TREE FROM AN EMPTY ONE (am-4cpx).
 *
 * The defect this plants: `getAbsentSourceLayers()` returned `absent` for all four layers
 * unconditionally and was the DEFAULT argument of `generateManifestReport`, so the artifact
 * AGENTS.md names as the completeness authority reported `transcription-not-started` over 456
 * source blocks, 821 translation units and 542 gloss units, and would have reported the same on a
 * finished edition.
 *
 * WHY THIS FILE RUNS IN THE NODE LANE. The report's own tests sit beside it in the bun lane and
 * build their layers from fixtures, so they pass whatever the tree holds; a test of the derivation
 * that lived there would be checked by the same lane the report is generated in. This one reads the
 * REAL tree, in the other lane, so the two cannot fail open together.
 *
 * BOTH DIRECTIONS, because a function returning "present" unconditionally would pass a one-sided
 * test as easily as the old one returned "absent":
 * - over the real tree, no layer that has records may report absent, and the counts must be the
 *   files that are there;
 * - over an empty tree, every layer must report absent, with a reason naming the directory it
 *   looked in rather than a stage nobody has reached.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readSourceLayers, sourceBlockSpans } from "./sourceLayers.ts";

const PAPERS = [
  { paper: "light-quanta", document: "ap-17-132", pages: 17 },
  { paper: "brownian-motion", document: "ap-17-549", pages: 12 },
  { paper: "special-relativity", document: "ap-17-891", pages: 31 },
  { paper: "mass-energy", document: "ap-18-639", pages: 3 },
] as const;

test("over the real tree, a layer that has records never reports absent", () => {
  let blocks = 0;
  let glossUnits = 0;
  for (const { paper, document, pages } of PAPERS) {
    const layers = readSourceLayers(process.cwd(), paper, document, pages);
    const counted = sourceBlockSpans(process.cwd(), paper);
    assert.ok(counted.size > 0, `${paper}: no source blocks found, so this test proves nothing`);
    blocks += counted.size;

    // The three layers the tree holds records for.
    for (const kind of ["transcription", "translation", "gloss"] as const) {
      const layer = layers[kind];
      assert.equal(
        layer.state,
        "present",
        `${paper} ${kind}: reported ${layer.state === "absent" ? layer.reason : "present"} while the tree holds records`,
      );
      if (layer.state !== "present") continue;
      assert.ok(layer.unitCount > 0, `${paper} ${kind}: present with a count of zero`);
      assert.ok(layer.of !== undefined, `${paper} ${kind}: a count with no denominator beside it`);
      assert.ok(
        layer.unitCount <= (layer.of ?? 0),
        `${paper} ${kind}: ${layer.unitCount} of ${layer.of}, a numerator larger than its denominator`,
      );
    }
    assert.equal(
      layers.transcription.state === "present" && layers.transcription.unitCount,
      counted.size,
    );
    if (layers.gloss.state === "present") glossUnits += layers.gloss.unitCount;

    // The ledger is a machine draft today. A draft is not "not started", and saying so was the
    // second half of the defect: the two are different facts and one of them took the work.
    const ledger = layers.ledger;
    assert.equal(ledger.state, "present", `${paper} ledger: ${JSON.stringify(ledger)}`);
    if (ledger.state === "present") {
      assert.ok(
        ledger.status === "draft" || ledger.status === "reviewed",
        `${paper} ledger: unexpected status ${ledger.status}`,
      );
      assert.equal(ledger.unitCount, pages, `${paper} ledger: pages transcribed`);
    }
  }
  // Non-vacuity, with the numbers named: these are the populations the report was blind to.
  assert.ok(blocks > 400, `source blocks examined: ${blocks}`);
  assert.ok(glossUnits > 500, `gloss units examined: ${glossUnits}`);
  console.log(`[source layers] examined ${blocks} source blocks and ${glossUnits} gloss units`);
});

test("over an empty tree, every layer reports absent, naming the directory it looked in", () => {
  const empty = mkdtempSync(join(tmpdir(), "am-source-layers-"));
  const layers = readSourceLayers(empty, "light-quanta", "ap-17-132", 17);
  for (const kind of ["ledger", "transcription", "translation", "gloss"] as const) {
    const layer = layers[kind];
    assert.equal(layer.state, "absent", `${kind}: present over an empty tree`);
    if (layer.state !== "absent") continue;
    assert.ok(
      /content\/|public\/papers\/transcripts/.test(layer.reason),
      `${kind}: the reason names no directory: ${layer.reason}`,
    );
    assert.ok(
      !/not-started/.test(layer.reason),
      `${kind}: the reason names a stage rather than what is missing: ${layer.reason}`,
    );
  }
});

test("the plant: the historical default would fail the first test", async () => {
  // getAbsentSourceLayers is what the report used to take by default. Held here so that the defect
  // stays visible: if someone makes it the default again, this says what that meant.
  const { getAbsentSourceLayers } = await import("./report.ts");
  const stale = getAbsentSourceLayers();
  for (const kind of ["transcription", "translation", "gloss"] as const) {
    assert.equal(stale[kind].state, "absent");
    const derived = readSourceLayers(process.cwd(), "special-relativity", "ap-17-891", 31)[kind];
    assert.equal(
      derived.state,
      "present",
      `${kind}: the derivation agrees with the stale default, so the defect is back`,
    );
  }
});
