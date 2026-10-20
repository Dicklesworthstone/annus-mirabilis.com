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
import { validateTerms } from "../../content/editions/alignment.ts";
import {
  loadAlignmentComponents,
  loadAuthoredEdges,
  loadGlossInput,
  loadTermOccurrences,
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

  it("an unparseable SOURCE BLOCK is reported, not read as having no alignable units (authoredInputs.ts:289)", () => {
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

  it("an unparseable GLOSS UNIT is reported, not read as having no glosses (authoredInputs.ts:340)", () => {
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

/**
 * THE FIFTH POPULATION: alignment components and the inline atoms on both sides (rule C.4).
 */
describe("loadAlignmentComponents", () => {
  it("builds a component for every edge group, with both endpoints resolved", () => {
    for (const slug of [
      "mass-energy",
      "light-quanta",
      "brownian-motion",
      "special-relativity",
    ] as const) {
      const loaded = loadAlignmentComponents(slug as RouteSlug, ROOT);
      expect(loaded.issues, `${slug}: a record could not be read`).toEqual([]);
      expect(loaded.examined.components, `${slug}: no components`).toBeGreaterThan(30);
      expect(loaded.examined.unresolvedSources, `${slug}: unresolved sources`).toBe(0);
      expect(loaded.examined.unresolvedTargets, `${slug}: unresolved targets`).toBe(0);
    }
  });

  it("a paragraph edge arrives EXPANDED into its sentences, and every shape resolves", () => {
    /*
     * The record and the loaded edge are not the same thing, and a loader written against the
     * record alone resolves nothing. `content/alignments/light-quanta.yaml` stores
     * `source: {blockId: "s0-p1"}` -- 153 of its 235 edges are paragraph block ids -- and
     * `edgesFromAlignment` expands each into that paragraph's sentence ids, so what reaches this
     * loader is `s0-p1-s1` through `s0-p1-s4`. Measured over the four papers: zero loaded edges
     * carry a bare paragraph id.
     *
     * That is why German content is attributed per SENTENCE SPAN rather than per block. Had the
     * loader keyed on block ids it would have built no component for any paragraph and still
     * reported zero unresolved endpoints, because a component that is never built cannot report
     * a missing side.
     */
    const loaded = loadAlignmentComponents("light-quanta" as RouteSlug, ROOT);
    const ids = loaded.components.flatMap((c) => c.germanUnits.map((u) => u.id));
    expect(
      ids.some((id) => /^s\d+-p\d+-s\d+/.test(id)),
      "no sentence-level source",
    ).toBe(true);
    expect(
      ids.some((id) => /^eq-s\d+-d\d+$/.test(id)),
      "no equation-keyed source",
    ).toBe(true);
    expect(
      ids.some((id) => /^s\d+-fn\d+$/.test(id)),
      "no footnote-keyed source",
    ).toBe(true);
    expect(
      ids.some((id) => /^s\d+$/.test(id)),
      "no heading-keyed source",
    ).toBe(true);
    expect(
      ids.filter((id) => /^s\d+-p\d+$/.test(id)),
      "a bare paragraph id reached C.4",
    ).toEqual([]);
  });

  it("display math is NOT an inline atom, which keeps five true units from reading as broken", () => {
    // light-quanta s1-fn3 references three displays and s5-fn1 two. The English refers to the
    // shared equation blocks rather than repeating their LaTeX, so counting displays here
    // reported all five as formulas the translation had dropped.
    const loaded = loadAlignmentComponents("light-quanta" as RouteSlug, ROOT);
    const fn3 = loaded.components.flatMap((c) => c.germanUnits).find((u) => u.id === "s1-fn3");
    expect(fn3, "s1-fn3 was not built as a German unit").toBeDefined();
    const atoms = (fn3?.mathAtoms ?? []).map((a) => a.replace(/\s+/g, ""));
    expect(atoms.length).toBeGreaterThan(10);
    expect(atoms.some((a) => a.startsWith("Z=\\sum"))).toBe(false);
  });
});

describe("loadAlignmentComponents reports an unreadable record rather than an empty population", () => {
  it("an unparseable SOURCE BLOCK is reported (authoredInputs.ts:535)", () => {
    const root = mkdtempSync(join(tmpdir(), "components-blocks-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p1.yaml"),
      "id: [bad\n",
    );
    const loaded = loadAlignmentComponents("mass-energy" as RouteSlug, root);
    expect(loaded.issues.map((i) => i.code)).toEqual(["alignment-record-unreadable"]);
    expect(loaded.issues[0]?.message).toContain("not an absence of inline atoms");
    expect(loaded.issues[0]?.message).toContain("content/source-blocks/mass-energy/s0-p1.yaml");
  });

  it("an unparseable TRANSLATION UNIT is reported (authoredInputs.ts:595)", () => {
    const root = mkdtempSync(join(tmpdir(), "components-units-"));
    mkdirSync(join(root, "content", "translation-units", "mass-energy"), { recursive: true });
    writeFileSync(
      join(root, "content", "translation-units", "mass-energy", "0010-s0-p1-s1.yaml"),
      "id: [bad\n",
    );
    const loaded = loadAlignmentComponents("mass-energy" as RouteSlug, root);
    expect(loaded.issues.map((i) => i.code)).toEqual(["alignment-record-unreadable"]);
    expect(loaded.issues[0]?.message).toContain("not an absence of inline atoms");
    expect(loaded.issues[0]?.message).toContain(
      "content/translation-units/mass-energy/0010-s0-p1-s1.yaml",
    );
  });

  it("the two paths are told apart by their path, not only by their shared code", () => {
    const root = mkdtempSync(join(tmpdir(), "components-both-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    mkdirSync(join(root, "content", "translation-units", "mass-energy"), { recursive: true });
    writeFileSync(join(root, "content", "source-blocks", "mass-energy", "a.yaml"), "x: [bad\n");
    writeFileSync(join(root, "content", "translation-units", "mass-energy", "b.yaml"), "y: [bad\n");
    const loaded = loadAlignmentComponents("mass-energy" as RouteSlug, root);
    expect(loaded.issues).toHaveLength(2);
    expect(loaded.issues[0]?.message).toContain("content/source-blocks/mass-energy/a.yaml");
    expect(loaded.issues[1]?.message).toContain("content/translation-units/mass-energy/b.yaml");
  });
});

/**
 * THE SIXTH POPULATION: term occurrences (rule C.5).
 */
describe("loadTermOccurrences", () => {
  it("loads every authored term, with the per-paper counts named", () => {
    const counts: Record<string, number> = {};
    for (const slug of [
      "mass-energy",
      "light-quanta",
      "brownian-motion",
      "special-relativity",
    ] as const) {
      const loaded = loadTermOccurrences(slug as RouteSlug, ROOT);
      expect(loaded.issues, `${slug}: a record could not be read`).toEqual([]);
      counts[slug] = loaded.terms.length;
      expect(loaded.terms.length, `${slug}: no term occurrences`).toBeGreaterThan(0);
    }
    // Reported, not frozen: the floor is what matters, because annotating another period word
    // is correct work and must not break this.
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(25);
  });

  it("every loaded term carries the fields C.5 judges", () => {
    // A loader that dropped `lang` would make `term-missing-german-lang` fire on all 30, and a
    // loader that dropped `definition` would make the 80-character rule fire on all 30. Both
    // would read as a corpus in ruins, so the fields are asserted here rather than inferred
    // from the rule passing.
    for (const slug of ["mass-energy", "special-relativity"] as const) {
      for (const term of loadTermOccurrences(slug as RouteSlug, ROOT).terms) {
        expect(term.termId, `${term.id}: no termId`).not.toBe("");
        expect(term.termText, `${term.id}: no termText`).not.toBe("");
        expect(term.definition.length, `${term.id}: short definition`).toBeGreaterThan(80);
        expect(term.termLang, `${term.id}: termLang`).toBe("de");
        expect(term.definitionLang, `${term.id}: definitionLang`).toBe("en");
      }
    }
  });

  it("occurrence-specificity is DERIVED from the set, and today no term id repeats", () => {
    // C.5 asks whether a definition is shared across occurrences, which cannot be answered by
    // looking at one record. No record carries the flag, so the loader computes it.
    const all = (
      ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const
    ).flatMap((slug) => [...loadTermOccurrences(slug as RouteSlug, ROOT).terms]);
    const ids = all.map((t) => t.termId);
    expect(new Set(ids).size, "a term id repeats; the derivation now has a live case").toBe(
      ids.length,
    );
    expect(all.every((t) => t.isOccurrenceSpecific === true)).toBe(true);
  });

  it("CONTROL: a repeated term id with the SAME definition is marked shared", () => {
    // The positive case the corpus does not reach. Without this the derivation above could
    // return `true` unconditionally and every assertion in this file would still pass.
    const root = mkdtempSync(join(tmpdir(), "terms-shared-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    const definition =
      "A bundle of light treated as a single object for the purposes of this argument, following the printed usage of the paper.";
    const block = (id: string) =>
      [
        `id: "${id}"`,
        'kind: "paragraph"',
        'diplomaticText: "Ein Lichtkomplex."',
        "inlines:",
        '  - kind: "term"',
        '    text: "Lichtkomplex"',
        '    termId: "term-lichtkomplex"',
        `    definition: "${definition}"`,
        '    lang: "de"',
        '    definitionLang: "en"',
        "",
      ].join("\n");
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p1.yaml"),
      block("s0-p1"),
    );
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p2.yaml"),
      block("s0-p2"),
    );

    const loaded = loadTermOccurrences("mass-energy" as RouteSlug, root);
    expect(loaded.terms).toHaveLength(2);
    expect(loaded.terms.every((t) => t.isOccurrenceSpecific === false)).toBe(true);
    expect(
      validateTerms(loaded.terms).filter((i) => i.code === "term-not-occurrence-specific"),
    ).toHaveLength(2);
  });

  it("CONTROL: the same term id with DIFFERENT definitions stays occurrence-specific", () => {
    // The whole point of the rule: one word may be annotated twice, as long as each annotation
    // was authored for its own occurrence.
    const root = mkdtempSync(join(tmpdir(), "terms-specific-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    const block = (id: string, tail: string) =>
      [
        `id: "${id}"`,
        'kind: "paragraph"',
        'diplomaticText: "Ein Lichtkomplex."',
        "inlines:",
        '  - kind: "term"',
        '    text: "Lichtkomplex"',
        '    termId: "term-lichtkomplex"',
        `    definition: "A bundle of light treated as a single object for the purposes of this argument, ${tail}"`,
        '    lang: "de"',
        '    definitionLang: "en"',
        "",
      ].join("\n");
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p1.yaml"),
      block("s0-p1", "as section 1 uses it."),
    );
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p2.yaml"),
      block("s0-p2", "as the closing paragraph uses it."),
    );

    const loaded = loadTermOccurrences("mass-energy" as RouteSlug, root);
    expect(loaded.terms).toHaveLength(2);
    expect(loaded.terms.every((t) => t.isOccurrenceSpecific === true)).toBe(true);
    expect(validateTerms(loaded.terms)).toEqual([]);
  });

  it("an unparseable source block is reported, not read as having no terms (authoredInputs.ts:720)", () => {
    // Shares `alignment-record-unreadable` with the other loaders, so the message is what says
    // which population failed: "not an absence of term occurrences".
    const root = mkdtempSync(join(tmpdir(), "terms-unreadable-"));
    mkdirSync(join(root, "content", "source-blocks", "mass-energy"), { recursive: true });
    writeFileSync(
      join(root, "content", "source-blocks", "mass-energy", "s0-p1.yaml"),
      "id: [bad\n",
    );
    const loaded = loadTermOccurrences("mass-energy" as RouteSlug, root);
    expect(loaded.terms).toEqual([]);
    expect(loaded.issues.map((i) => i.code)).toEqual(["alignment-record-unreadable"]);
    expect(loaded.issues[0]?.message).toContain("not an absence of term occurrences");
  });
});
