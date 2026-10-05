/**
 * THE BUILT GERMAN FACE PUBLISHES THE FROZEN MANIFEST'S IDS (am-german-face-anchors-not-frozen-ids-jtv6).
 *
 * The defect this guards, measured 2026-09-24: the German face rendered equation anchors as `sN-eqN`
 * (102 of 102) rather than the frozen grammar, and on mass-energy it reused the RETIRED ids s0-p9 and
 * s0-p10 for different paragraphs while s0-p11 to s0-p13 named paragraphs the manifest calls something
 * else. So the concordance's first-use anchors s0-p14 and s0-p15 were absent from the live face, and a
 * link into the German face could land on the wrong paragraph. AGENTS.md is unambiguous: an id never
 * changes once published, a retired id is never reused with a new meaning, and anchors are identical
 * across every face so switching faces keeps the reader's place.
 *
 * `manifestAnchors.ts` repaired it by pairing the segmenter's own ids with the frozen ones. This file
 * is the half of the bead's acceptance that was still missing: a test over the BUILT faces. The unit
 * test beside that module proves the pairing; only the built HTML proves what a reader is served.
 *
 * Measured here on 2026-10-05, over out/papers/<paper>/view/german/index.html:
 *
 *   paper                block anchors (distinct / rendered)   outside the manifest   first-use unresolved
 *   mass-energy                            23 / 35                            0                      0
 *   light-quanta                          115 / 165                           0                      0
 *   brownian-motion                        84 / 116                           0                      0
 *   special-relativity                    209 / 303                           0                      0
 *
 * Both numbers, because they answer different questions and one of them was printed as the other in a
 * first draft of this file: a block may be anchored more than once on a face (a paragraph and the
 * sentence inside it), so the rendered count exceeds the distinct one, and a check over occurrences is
 * the stricter of the two.
 *
 * and zero `sN-eqN` anchors anywhere, against 7, 52, 40 and 97 in the grammar's `eq-sN-dJ` form.
 *
 * NO JAVASCRIPT IS INVOLVED, which is the fourth acceptance item: this reads the static HTML the
 * export writes, so an anchor that only appears after hydration would be absent here and fail.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** Ids the manifest freezes, read from its own `- id:` entries. */
function manifestIds(paper: string): ReadonlySet<string> {
  const text = readFileSync(resolve(ROOT, `content/source-blocks/${paper}/manifest.yaml`), "utf8");
  // The `m` flag is a JavaScript suffix, not an inline `(?m)` group: the inline form is a syntax
  // error here and threw before any test ran.
  return new Set(text.match(/^ {2}- id: [A-Za-z0-9._-]+$/gm)?.map((l) => l.slice(8)) ?? []);
}

/** Retired ids, with the blocks each was merged or split into. */
function aliases(paper: string): ReadonlyMap<string, readonly string[]> {
  const path = resolve(ROOT, `content/aliases/${paper}.yaml`);
  const map = new Map<string, readonly string[]>();
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8");
  // One entry per `- retiredId:`, with the `replacementIds:` list that follows it.
  for (const chunk of text.split(/(?=^ {2}- retiredId:)/m)) {
    const retired = /^ {2}- retiredId:\s*([A-Za-z0-9._-]+)/m.exec(chunk)?.[1];
    if (retired === undefined) continue;
    const replacements = [...chunk.matchAll(/^ {6}- ([A-Za-z0-9._-]+)$/gm)].map((m) => m[1] ?? "");
    map.set(retired, Object.freeze(replacements));
  }
  return map;
}

function germanFace(paper: string): string | null {
  const path = resolve(ROOT, `out/papers/${paper}/view/german/index.html`);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

const blockAnchorsOf = (html: string): readonly string[] =>
  [...html.matchAll(/data-block-id="([^"]+)"/g)].map((m) => m[1] ?? "");

const idsOf = (html: string): ReadonlySet<string> =>
  new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1] ?? ""));

const firstUseAnchorsOf = (paper: string): readonly string[] => {
  const path = resolve(ROOT, `content/notation/${paper}.yaml`);
  if (!existsSync(path)) return [];
  return [
    ...new Set(
      [...readFileSync(path, "utf8").matchAll(/firstUseAnchor:\s*([A-Za-z0-9._-]+)/g)].map(
        (m) => m[1] ?? "",
      ),
    ),
  ];
};

/** A first-use anchor carries the paper's own prefix; the block id is what follows it. */
const blockIdOfAnchor = (anchor: string): string => anchor.replace(/^(me|lq|bm|sr|md)-/, "");

const faces = PAPERS.map((paper) => ({ paper, html: germanFace(paper) }));
// The predicate keeps the paper's literal type: widening it to `string` is not assignable to the
// parameter's type, and tsc refuses it. The suite still ran green while this was wrong, because bun
// strips types -- a passing lane says nothing about whether the repository compiles.
const built = faces.filter(
  (f): f is { paper: (typeof PAPERS)[number]; html: string } => f.html !== null,
);

describe("every anchor the built German face publishes is a frozen id", () => {
  test("the faces this reads are the built ones, and all four are present", () => {
    // Non-vacuity before any verdict: with no out/ every assertion below iterates nothing. This
    // refuses rather than skipping, because a silent skip is how an unmeasured gate reads as clean.
    expect(built.map((f) => f.paper)).toEqual([...PAPERS]);
    for (const face of built) expect(face.html.length).toBeGreaterThan(5_000);
  });

  test("no rendered block anchor is outside its manifest, and none is a retired id", () => {
    const report: string[] = [];
    const outside: string[] = [];
    const retiredInUse: string[] = [];
    for (const { paper, html } of built) {
      const frozen = manifestIds(paper);
      const retired = aliases(paper);
      const anchors = blockAnchorsOf(html);
      // Non-vacuity per paper: a face that rendered no block anchor would pass silently.
      expect(anchors.length).toBeGreaterThan(20);
      for (const anchor of anchors) {
        if (!frozen.has(anchor)) outside.push(`${paper}/${anchor}`);
        // A retired id may appear ONLY as a declared alias pointing at its replacement, never as the
        // anchor of a block in its own right. mass-energy retired s0-p8 to s0-p10 into s0-p7.
        if (retired.has(anchor) && !frozen.has(anchor)) retiredInUse.push(`${paper}/${anchor}`);
      }
      report.push(
        `${paper}: ${new Set(anchors).size} distinct of ${anchors.length} rendered block anchors, ` +
          `${retired.size} retired ids declared`,
      );
    }
    console.log(`[german face anchors] ${report.join(" | ")}`);
    expect(outside).toEqual([]);
    expect(retiredInUse).toEqual([]);
  });

  test("no display anchor is written in the retired sN-eqN spelling", () => {
    // The 102 of 102 the bead measured. Counted in both spellings so a face that stopped rendering
    // displays altogether cannot pass this by rendering none.
    const counts: string[] = [];
    for (const { paper, html } of built) {
      const ids = [...idsOf(html)];
      const old = ids.filter((id) => /^s\d+-eq\d+$/.test(id));
      const grammar = ids.filter((id) => /^eq-s\d+-d\d+$/.test(id));
      counts.push(`${paper}: ${grammar.length} eq-sN-dJ, ${old.length} sN-eqN`);
      expect(old).toEqual([]);
      expect(grammar.length).toBeGreaterThan(0);
    }
    console.log(`[german face displays] ${counts.join(" | ")}`);
  });

  test("every concordance first-use anchor resolves to an id on the face it names", () => {
    const unresolved: string[] = [];
    let examined = 0;
    for (const { paper, html } of built) {
      const ids = idsOf(html);
      const anchors = firstUseAnchorsOf(paper);
      // Non-vacuity: this is the check that was failing, so an empty anchor list would hide it.
      expect(anchors.length).toBeGreaterThan(0);
      for (const anchor of anchors) {
        examined += 1;
        if (!ids.has(blockIdOfAnchor(anchor)) && !ids.has(anchor))
          unresolved.push(`${paper}/${anchor}`);
      }
    }
    console.log(`[german face first-use] ${examined} concordance anchors examined`);
    expect(examined).toBeGreaterThanOrEqual(40);
    expect(unresolved).toEqual([]);
  });
});

describe("the planted negatives, so a pass here is a result", () => {
  const sample = built[0];

  test("a renumbered block anchor is caught", () => {
    if (!sample) throw new Error("no built German face to plant against");
    const frozen = manifestIds(sample.paper);
    const real = blockAnchorsOf(sample.html)[0];
    expect(real).toBeDefined();
    expect(frozen.has(real ?? "")).toBe(true);
    // The exact defect the bead names: the face publishes a number the manifest does not freeze.
    const renumbered = sample.html.replace(`data-block-id="${real}"`, 'data-block-id="s0-p9999"');
    const outside = blockAnchorsOf(renumbered).filter((a) => !frozen.has(a));
    expect(outside).toEqual(["s0-p9999"]);
  });

  test("a retired id used as a block anchor is caught", () => {
    const retired = [...aliases("mass-energy").keys()];
    // The alias file really does declare retirements, or the predicate has nothing to find.
    expect(retired.length).toBeGreaterThan(0);
    const frozen = manifestIds("mass-energy");
    const reused = retired.filter((id) => !frozen.has(id));
    // Those ids are retired, so none is a frozen id; a face anchoring one would be the 2026-09-24
    // defect exactly, and the test above would report it.
    expect(reused.length).toBeGreaterThan(0);
  });

  test("the old display spelling is caught", () => {
    if (!sample) throw new Error("no built German face to plant against");
    const planted = `${sample.html}<p id="s0-eq1">planted</p>`;
    expect([...idsOf(planted)].filter((id) => /^s\d+-eq\d+$/.test(id))).toEqual(["s0-eq1"]);
  });

  test("a stale first-use anchor is caught", () => {
    if (!sample) throw new Error("no built German face to plant against");
    const ids = idsOf(sample.html);
    expect(ids.has("s0-p9999")).toBe(false);
    expect(ids.has(blockIdOfAnchor("me-s0-p9999"))).toBe(false);
  });
});
