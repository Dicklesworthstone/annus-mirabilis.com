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
  loadGlossInput,
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

/**
 * THE FOURTH POPULATION: gloss units and the alignable units they address.
 *
 * Same defect, two months later and one layer over. `--layers german,translation,gloss` reported
 * `"outcome": "passed"` for all four papers on 2026-10-19 and wrote a coverage report whose gloss
 * row read `absent | 0`, while 542 authored gloss units sat in content/gloss-units/. The flag was
 * accepted and nothing ran, and the report said ABSENT where the truth was UNLOADED -- which is
 * the same conflation the edge tests above guard, stated about a different directory.
 */
describe("loadGlossInput", () => {
  it("loads the real corpus, with the count named", () => {
    for (const [slug, floor] of [
      ["mass-energy", 30],
      ["light-quanta", 150],
      ["brownian-motion", 95],
      ["special-relativity", 230],
    ] as const) {
      const loaded = loadGlossInput(slug as RouteSlug, ROOT);
      expect(loaded.issues, `${slug}: a record could not be read`).toEqual([]);
      expect(loaded.glossInput, `${slug}: nothing loaded`).toBeDefined();
      expect(
        loaded.glossInput?.glossUnits.length ?? 0,
        `${slug}: gloss units below the floor`,
      ).toBeGreaterThan(floor);
      expect(loaded.alignableUnitCount, `${slug}: alignables below the floor`).toBeGreaterThan(
        floor,
      );
    }
  });

  it("a paper with no gloss directory yields undefined, not an empty population", () => {
    // Absent and empty are different: `undefined` lets the caller decline the check with a
    // reason, where `{glossUnits: []}` would make it pass over nothing.
    const loaded = loadGlossInput("molecular-dimensions" as RouteSlug, ROOT);
    expect(loaded.glossInput).toBeUndefined();
  });

  it("an unparseable SOURCE BLOCK is reported, not read as having no alignable units (authoredInputs.ts:280)", () => {
    const root = mkdtempSync(join(tmpdir(), "gloss-input-blocks-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p1.yaml"),
      "id: [unclosed\n",
    );
    const loaded = loadGlossInput("mass-energy" as RouteSlug, root);
    expect(loaded.issues.map((i) => i.code)).toEqual(["alignment-record-unreadable"]);
    expect(loaded.issues[0]?.message).toContain("not an absence of alignable units");
  });

  it("an unparseable GLOSS UNIT is reported, not read as having no glosses (authoredInputs.ts:331)", () => {
    const root = mkdtempSync(join(tmpdir(), "gloss-input-units-"));
    mkdirSync(join(root, "content", "gloss-units", "mass-energy"), { recursive: true });
    writeFileSync(
      join(root, "content", "gloss-units", "mass-energy", "s0-p1-s1.yaml"),
      "sentenceId: [unclosed\n",
    );
    const loaded = loadGlossInput("mass-energy" as RouteSlug, root);
    expect(loaded.issues.map((i) => i.code)).toEqual(["alignment-record-unreadable"]);
    expect(loaded.issues[0]?.message).toContain("not an absence of gloss units");
  });

  it("the two unreadable paths are told apart by their message, not only by their code", () => {
    // They share `alignment-record-unreadable`, so a reader who sees only the code cannot say
    // which directory failed. The sentence after the colon is what distinguishes them.
    const root = mkdtempSync(join(tmpdir(), "gloss-input-both-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    mkdirSync(join(root, "content", "gloss-units", "mass-energy"), { recursive: true });
    writeFileSync(join(root, "content", "source-blocks", "mass-energy", "a.yaml"), "x: [bad\n");
    writeFileSync(join(root, "content", "gloss-units", "mass-energy", "b.yaml"), "y: [bad\n");
    const loaded = loadGlossInput("mass-energy" as RouteSlug, root);
    expect(loaded.issues).toHaveLength(2);
    expect(loaded.issues[0]?.message).toContain("content/source-blocks/mass-energy/a.yaml");
    expect(loaded.issues[1]?.message).toContain("content/gloss-units/mass-energy/b.yaml");
  });
});
