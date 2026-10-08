/**
 * CRITERION 1 OF am-read-anchors-navigation-a6o: "Every face emits anchors from the full grammar for
 * the fixture corpus, and a DOM uniqueness test passes in single and split views."
 *
 * Two claims, and they fail in opposite directions, which is why they are separate tests here.
 * Uniqueness is violated by a duplicate; grammar coverage is violated by an ABSENCE, and an absent
 * kind cannot fail a loop over the kinds that are present. AGENTS.md records two inventory beads
 * closed over a missing unit class while their own tests passed with thousands of assertions.
 *
 * THE GRAMMAR IS NOT RE-SPELLED HERE. `parseAnchor` from src/content/anchors.ts decides what counts
 * as a content anchor. A regex in this file would be a copy of an unexported original that cannot be
 * kept in step -- the mistake src/reader/anchors/mapToFace.ts made with SENTENCE_PATTERN, recorded
 * in its own docblock. The first draft of this lane did exactly that and its hand-rolled pattern
 * silently scored every result card as a non-anchor, reporting 0 anchors on four faces.
 *
 * Reads the built HTML rather than a browser DOM. The question is what the build EMITS, and ids are
 * emitted as attributes; opening 28 pages in a browser to read `id` attributes would add a hydration
 * step between the check and its subject for nothing.
 */

import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type AnchorKind, parseAnchor } from "../../src/content/anchors.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");

/**
 * A face that legitimately publishes no SOURCE anchor, with the reason. Each entry is a debt or a
 * design fact, not an excuse: the uniqueness test would pass over an empty set, so the faces that
 * are empty have to be named rather than silently counted as clean.
 */
const NO_SOURCE_ANCHORS: Readonly<Record<string, string>> = {
  results:
    // A DESIGN FACT, not a debt, and the distinction is the point of keeping both in one list with
    // their reasons. The results face is a face OF RESULTS: measured across the four papers it
    // publishes `result` and `argument` anchors and no sentence, paragraph, section or equation id
    // -- relativity's carries 16 cards and 62 ids. A reader switching to it from a source sentence
    // is served by mapping the sentence to its section's card (FaceSwitchAnchor's
    // resultsAnchorForSource), not by the face republishing source ids.
    "Publishes result and argument anchors by design; source ids belong to the source faces.",
  split: // am-read-anchors-navigation-a6o: the split view is a shell.
    "The route builds a 55,797-byte page carrying a heading, an intro and THREE ids (_R_, main, " +
    "site-nav) and no source content at all, on every paper. So criterion 1's 'and split views' " +
    "clause cannot be satisfied by this face: a uniqueness check over it is a pass on an empty " +
    "set. This is the same debt src/reader/anchors/paneIds.ts carries -- its pane-b-- prefix and " +
    "data-anchor contract are unexercised outside tests because no split view is rendered.",
};

interface FacePage {
  readonly page: string;
  readonly face: string;
  readonly ids: readonly string[];
  readonly anchors: readonly string[];
  readonly kinds: ReadonlySet<AnchorKind>;
}

function facePages(): readonly FacePage[] {
  const files = globSync("papers/*/view/*/index.html", { cwd: OUT_DIR }).sort();
  return files.map((rel) => {
    const html = readFileSync(join(OUT_DIR, rel), "utf8");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] as string);
    const anchors: string[] = [];
    const kinds = new Set<AnchorKind>();
    for (const id of ids) {
      const parsed = parseAnchor(id);
      if (!parsed.ok) continue;
      anchors.push(id);
      kinds.add(parsed.value.kind);
    }
    return {
      page: relative(OUT_DIR, join(OUT_DIR, rel)),
      face: rel.split("/")[3] as string,
      ids,
      anchors,
      kinds,
    };
  });
}

/** The kinds that make a source face a source face. A face holding none of these is a shell. */
const SOURCE_KINDS: readonly AnchorKind[] = ["sentence", "section", "paragraph", "equation"];

test("no built face publishes the same anchor id twice", () => {
  assertOutFreshness("out", REPO_ROOT);
  const pages = facePages();
  assert.ok(
    pages.length >= 20,
    `only ${pages.length} face pages found; the glob matched nothing useful`,
  );

  const offenders: string[] = [];
  let examined = 0;
  for (const p of pages) {
    examined += p.anchors.length;
    const seen = new Map<string, number>();
    for (const a of p.anchors) seen.set(a, (seen.get(a) ?? 0) + 1);
    for (const [id, n] of seen) if (n > 1) offenders.push(`${p.page}: '${id}' x${n}`);
  }
  // The denominator beside the verdict: zero anchors examined and zero duplicates print the same
  // green, and this lane's first draft DID examine zero on four faces because of its own regex.
  console.log(
    `[census] anchor-uniqueness examined ${examined} content anchors across ${pages.length} built faces`,
  );
  assert.ok(
    examined >= 2000,
    `only ${examined} anchors examined; a clean result over that population would not mean much`,
  );
  assert.deepEqual(offenders, []);

  // POSITIVE CONTROL: the comparison must be able to see a duplicate at this scale. Planting into
  // the largest face's own id list, because a control over a toy array says nothing about whether
  // the real population is being read.
  const biggest = [...pages].sort((a, b) => b.anchors.length - a.anchors.length)[0] as FacePage;
  const planted = [...biggest.anchors, biggest.anchors[0] as string];
  const counts = new Map<string, number>();
  for (const a of planted) counts.set(a, (counts.get(a) ?? 0) + 1);
  const found = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(
    found,
    [biggest.anchors[0]],
    `the duplicate check cannot see a planted repeat in ${biggest.page}`,
  );
});

test("every SOURCE face publishes source anchors, and the faces that do not are declared", () => {
  assertOutFreshness("out", REPO_ROOT);
  const pages = facePages();
  const empty: string[] = [];
  const undeclared: string[] = [];
  for (const p of pages) {
    const hasSource = SOURCE_KINDS.some((k) => p.kinds.has(k));
    if (hasSource) continue;
    empty.push(p.page);
    if (!(p.face in NO_SOURCE_ANCHORS)) undeclared.push(`${p.page} (face '${p.face}')`);
  }
  console.log(
    `[census] ${pages.length - empty.length} of ${pages.length} faces publish source anchors; empty: ${empty.join(", ") || "none"}`,
  );
  assert.deepEqual(
    undeclared,
    [],
    "a face publishes no source anchor and is not declared in NO_SOURCE_ANCHORS",
  );

  // And the other direction, so the declaration cannot become a budget: a declared face that HAS
  // started publishing source anchors must be struck from the list.
  const paid = Object.keys(NO_SOURCE_ANCHORS).filter((face) =>
    pages.some((p) => p.face === face && SOURCE_KINDS.some((k) => p.kinds.has(k))),
  );
  assert.deepEqual(
    paid,
    [],
    "a declared-empty face now publishes source anchors; strike its entry",
  );
});

test("the grammar kinds the corpus reaches are reported, and the required ones are REPRESENTED", () => {
  assertOutFreshness("out", REPO_ROOT);
  const pages = facePages();
  const everywhere = new Set<AnchorKind>();
  for (const p of pages) for (const k of p.kinds) everywhere.add(k);
  console.log(
    `[census] kinds emitted across all built faces: ${[...everywhere].sort().join(", ")}`,
  );

  // Representation, not a count. A kind that is absent cannot fail a loop over the kinds present,
  // so each required kind is asked for BY NAME.
  for (const kind of [
    "sentence",
    "section",
    "paragraph",
    "equation",
    "footnote",
    "closing",
    "masthead",
  ] as const) {
    assert.ok(everywhere.has(kind), `no built face emits a '${kind}' anchor`);
  }

  // The per-face table, which is where a face losing a kind becomes visible. Reported rather than
  // asserted per face, because the faces legitimately differ: the English face publishes no
  // paragraph ids and the German face publishes 111 of them, by design.
  for (const p of pages) {
    console.log(
      `  ${p.page.padEnd(44)} ${String(p.anchors.length).padStart(4)} anchors  ${[...p.kinds].sort().join(" ")}`,
    );
  }
});
