/**
 * THE INPUTS THE ALIGNMENT VALIDATOR JUDGES ARE ACTUALLY LOADED (am-edn-alignment-tooling-do1).
 *
 * The defect these guard is not a wrong answer but an absent question. `runAlignEditions` and
 * `assertEditionContract` both validated whatever their caller supplied, and no production caller
 * supplied edges, German ids or English ids -- so the aligner and check 8 ran over an EMPTY edge set
 * for all four papers and reported `empty-alignment`, which reads exactly like unauthored content.
 * 821 edges were on disk the whole time.
 *
 * So these tests assert a POPULATION, not a verdict: each loader returns something, from the real
 * corpus, with its count named. A loader that silently returned nothing would make every check above
 * it vacuous again, and vacuous is the one failure mode here that looks like success.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadAuthoredEdges,
  manifestUnitIds,
  translationUnitIds,
} from "../../content/editions/authoredInputs.ts";
import type { RouteSlug } from "../../content/ids.ts";

const ROOT = process.cwd();
/** Counts measured 2026-10-05, used as FLOORS so authoring more never turns this red. */
const PAPERS: readonly { slug: RouteSlug; edges: number; english: number }[] = [
  { slug: "mass-energy" as RouteSlug, edges: 43, english: 43 },
  { slug: "light-quanta" as RouteSlug, edges: 235, english: 235 },
  { slug: "brownian-motion" as RouteSlug, edges: 162, english: 162 },
  { slug: "special-relativity" as RouteSlug, edges: 381, english: 381 },
];

describe("the authored alignment inputs load from disk", () => {
  it("every paper's edges load, and none of the four is empty", () => {
    const report: string[] = [];
    for (const paper of PAPERS) {
      const loaded = loadAuthoredEdges(paper.slug, ROOT);
      expect(loaded.issues).toEqual([]);
      expect(loaded.edges.length).toBeGreaterThanOrEqual(paper.edges);
      report.push(`${paper.slug}: ${loaded.edges.length} edge(s)`);
    }
    console.log(`[authored inputs] ${report.join(" | ")}`);
  });

  it("every edge names a source and a target, so an edge set is never a count of blanks", () => {
    let examined = 0;
    for (const paper of PAPERS)
      for (const edge of loadAuthoredEdges(paper.slug, ROOT).edges) {
        examined += 1;
        expect(edge.sourceId.length).toBeGreaterThan(0);
        expect(edge.targetId.length).toBeGreaterThan(0);
      }
    expect(examined).toBeGreaterThanOrEqual(821);
  });

  it("the German id set is the manifest's alignable units, and excludes what aligns elsewhere", () => {
    for (const paper of PAPERS) {
      const ids = manifestUnitIds(paper.slug, ROOT);
      expect(ids.length).toBeGreaterThan(0);
      // A paragraph aligns through its sentences, so it is NOT a source in this set. Without this
      // filter the set is every unit in the manifest and each paragraph reads as unaligned.
      expect(ids.filter((id) => /^s\d+-p\d+$/.test(id))).toEqual([]);
      // And it is not merely non-empty: it holds the sentences and the displays edges point at.
      expect(ids.some((id) => /^s\d+-p\d+-s\d+[a-z]?$/.test(id))).toBe(true);
      expect(ids.some((id) => id.startsWith("eq-"))).toBe(true);
    }
  });

  it("English ids come from each record's own id, which no filename would have supplied", () => {
    for (const paper of PAPERS) {
      const ids = translationUnitIds(paper.slug, ROOT);
      expect(ids.length).toBeGreaterThanOrEqual(paper.english);
      // 200 of the 821 units address a display equation by its anchor; that is how the English face
      // carries a printed display, and a loader dropping them re-empties check 8 by a quarter.
      expect(ids.filter((id) => id.startsWith("eq-")).length).toBeGreaterThan(0);
      // Not one id equals its filename stem in this corpus, so a filename-derived loader would have
      // matched nothing and every edge would have reported an unknown target.
      expect(ids.every((id) => id.length > 0)).toBe(true);
    }
  });

  it("an absent record is an empty edge set with NO issue", () => {
    const loaded = loadAuthoredEdges("molecular-dimensions" as RouteSlug, ROOT);
    expect(loaded.edges).toEqual([]);
    expect(loaded.issues).toEqual([]);
  });

  it("a record that is present and unparseable is REPORTED, not read as having no edges", () => {
    // The distinction that stops a broken reader reading as missing content. Both halves are
    // asserted, because an absent record and an unreadable one produce the same empty edge list and
    // are told apart only by the issue.
    const root = mkdtempSync(join(tmpdir(), "authored-inputs-"));
    mkdirSync(join(root, "content", "alignments"), { recursive: true });
    writeFileSync(
      join(root, "content", "alignments", "mass-energy.yaml"),
      "kind: not-an-alignment\n",
    );
    const loaded = loadAuthoredEdges("mass-energy" as RouteSlug, root);
    expect(loaded.edges).toEqual([]);
    expect(loaded.issues.map((i) => i.code)).toEqual(["alignment-record-unreadable"]);
    expect(loaded.issues[0]?.message).toContain("not an absence of authored edges");
  });
});
