/**
 * EVERY ANCHOR A GERMAN FACE RENDERS IS A FROZEN ID OR A DECLARED ALIAS (am-german-face-anchors-not-frozen-ids-jtv6).
 *
 * AGENTS.md, "Stable ids, anchors, and revisions": once published, a source-block id never changes;
 * retired ids keep explicit aliases and are never reused with a new meaning; and anchors are content
 * ids, identical across every face, so switching faces keeps the reader's place. That bead's first
 * acceptance criterion asks for a test over the BUILT German faces, and there was none: the alias
 * machinery is tested against synthetic markup by `scripts/e2e/aliasAnchorLands.e2e.test.ts`, which
 * deliberately does NOT read the built site because it is measuring what the engine does with a
 * boxless fragment target. That leaves the question this file asks unasked.
 *
 * THE BEAD'S MEASUREMENTS ARE NOW HISTORY, and this file is the thing that keeps them so:
 *
 *   "The German face renders equation anchors as sN-eqN (102 of 102), not the frozen manifest
 *    grammar" -- measured 2026-10-12: ZERO `sN-eqN` anchors on any face, and 21 and 120
 *    `eq-sN-dN` on mass-energy and brownian-motion.
 *   "On mass-energy it reuses retired ids s0-p9 and s0-p10, and s0-p11 to s0-p13 name different
 *    paragraphs" -- s0-p11 to s0-p13 are manifest ids today, and s0-p8 to s0-p10 appear only as
 *    declared aliases carrying `data-alias-of="s0-p7"`, which is what the criterion permits.
 *   "the concordance's mass-energy first-use anchors s0-p14 and s0-p15 are missing" -- both are on
 *    the face, and all 50 first-use anchors across the four papers resolve.
 *
 * WHAT IT ASSERTS, AND WHY EACH CLAUSE IS SEPARATE. 33 anchors across the four faces are not
 * manifest ids, and all 33 are declared retired ids. Those two facts are the whole question, so the
 * test states them apart: an anchor that is neither is a finding, and an alias whose markup does not
 * name the block it replaces is a different finding. The second is the bead's own complaint --
 * "reuses retired ids for DIFFERENT paragraphs" -- and it is checkable because the renderer emits
 * `<span id="s0-p8" data-alias-of="s0-p7">` immediately before `data-block-wrapper="s0-p7"`, so the
 * alias declares its target in the HTML a reader receives.
 *
 * IT READS THE BUILT HTML, NOT THE RENDERER, because the claim is about what a reader is served and
 * because the no-JavaScript clause is answered by the same read: an anchor in the static markup is
 * an anchor a reader without scripting can land on. In the node lane, which already refuses a stale
 * build and says so.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";
import { validateSourceManifest } from "../content/manifest/schema.ts";
import { assertOutFreshness } from "./outFreshness.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** The smallest anchor count that is not a lost read, per paper. Measured 2026-10-12: 43/191/130/334. */
const ANCHOR_FLOORS: Readonly<Record<string, number>> = {
  "mass-energy": 40,
  "light-quanta": 180,
  "brownian-motion": 120,
  "special-relativity": 320,
};

type Alias = Readonly<{ retiredId: string; replacementIds: readonly string[] }>;

function manifestIds(paper: string): ReadonlySet<string> {
  const path = join(ROOT, "content/source-blocks", paper, "manifest.yaml");
  const manifest = validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
  return new Set(manifest.units.map((unit) => unit.id));
}

function aliasesOf(paper: string): readonly Alias[] {
  const path = join(ROOT, "content/aliases", `${paper}.yaml`);
  if (!existsSync(path)) return [];
  const raw = parseYaml(readFileSync(path, "utf8")) as { aliases?: readonly Alias[] };
  return raw.aliases ?? [];
}

function germanFace(paper: string): string {
  const path = join(ROOT, "out/papers", paper, "view/german/index.html");
  assert.ok(existsSync(path), `${paper}: ${path} was not built`);
  return readFileSync(path, "utf8");
}

/** Every block-shaped anchor the face renders: a paragraph, a footnote or a sentence id. */
function blockAnchors(html: string): readonly string[] {
  return [
    ...new Set(
      [...html.matchAll(/id="(s\d+-(?:p\d+(?:-s\d+[a-z]?)?|fn\d+))"/g)].map((m) => m[1] ?? ""),
    ),
  ].sort();
}

test("[census] every German face renders a real population of block anchors", () => {
  assertOutFreshness();
  const counted: string[] = [];
  for (const paper of PAPERS) {
    const anchors = blockAnchors(germanFace(paper));
    const floor = ANCHOR_FLOORS[paper] ?? 1;
    counted.push(`${paper} ${anchors.length}`);
    // A face that rendered no anchors would make every assertion below pass over nothing, which is
    // the citation habit AGENTS.md refuses.
    assert.ok(
      anchors.length >= floor,
      `${paper}: ${anchors.length} block anchors on the German face, under the floor of ${floor}`,
    );
  }
  console.log(`[german-face-anchors] examined ${counted.join(", ")} block anchors`);
});

test("every rendered block anchor is a frozen manifest id or a declared retired id", () => {
  assertOutFreshness();
  const undeclared: string[] = [];
  let examined = 0;
  let aliased = 0;
  for (const paper of PAPERS) {
    const ids = manifestIds(paper);
    const retired = new Set(aliasesOf(paper).map((alias) => alias.retiredId));
    for (const anchor of blockAnchors(germanFace(paper))) {
      examined += 1;
      if (ids.has(anchor)) continue;
      if (retired.has(anchor)) {
        aliased += 1;
        continue;
      }
      undeclared.push(`${paper} ${anchor}`);
    }
  }
  console.log(
    `[german-face-anchors] ${examined} anchors: ${examined - aliased} frozen ids, ${aliased} declared aliases`,
  );
  assert.deepEqual(
    undeclared,
    [],
    `anchors that are neither a manifest id nor a declared retired id:\n  ${undeclared.join("\n  ")}`,
  );
  // Non-vacuity in the other direction: the aliases exist, so "0 undeclared" is a measurement over a
  // real population and not an artefact of a face that renders no retired ids at all.
  assert.ok(aliased > 0, "no declared alias was rendered on any face, so this proves nothing");
});

test("a retired id names the block it was merged into, not a different paragraph", () => {
  assertOutFreshness();
  // The bead's own complaint: "reuses retired ids for DIFFERENT paragraphs". The renderer emits the
  // alias as an empty span carrying `data-alias-of`, so the target is in the markup a reader gets.
  const wrong: string[] = [];
  let checked = 0;
  for (const paper of PAPERS) {
    const html = germanFace(paper);
    for (const alias of aliasesOf(paper)) {
      const rendered = new RegExp(`<span id="${alias.retiredId}" data-alias-of="([^"]+)"`).exec(
        html,
      );
      if (rendered === null) continue; // Declared but not rendered on this face; nothing to misplace.
      checked += 1;
      const target = rendered[1] ?? "";
      if (!alias.replacementIds.includes(target))
        wrong.push(
          `${paper} ${alias.retiredId}: markup says data-alias-of="${target}", the record replaces it with ${alias.replacementIds.join(", ")}`,
        );
      // And the block it names is on the page, so the anchor lands somewhere real.
      if (!html.includes(`data-block-wrapper="${target}"`))
        wrong.push(`${paper} ${alias.retiredId}: names ${target}, which this face does not render`);
    }
  }
  console.log(`[german-face-anchors] ${checked} rendered aliases checked against their records`);
  assert.deepEqual(wrong, [], `misplaced aliases:\n  ${wrong.join("\n  ")}`);
  assert.ok(checked > 0, "no alias was rendered, so this proves nothing");
});

test("the retired equation grammar is gone: no face renders an sN-eqN anchor", () => {
  assertOutFreshness();
  // The bead measured 102 of 102 equation anchors in the retired `sN-eqN` form. The frozen grammar
  // is `#eq-s<n>-d<j>`, and both are counted so that "0 old" is reported beside a real number of new
  // ones rather than on its own.
  const report: string[] = [];
  for (const paper of PAPERS) {
    const html = germanFace(paper);
    const retiredForm = [...html.matchAll(/id="s\d+-eq\d+"/g)].length;
    const frozenForm = [...html.matchAll(/id="eq-s\d+-d\d+"/g)].length;
    report.push(`${paper} ${retiredForm} retired / ${frozenForm} frozen`);
    assert.equal(
      retiredForm,
      0,
      `${paper}: ${retiredForm} anchors still use the retired sN-eqN form`,
    );
  }
  console.log(`[german-face-anchors] equation anchors: ${report.join(", ")}`);
  // At least one face must carry displays, or the assertion above is satisfied by absence.
  assert.ok(
    PAPERS.some((paper) => [...germanFace(paper).matchAll(/id="eq-s\d+-d\d+"/g)].length > 0),
    "no face renders a frozen equation anchor, so the retired-form check is vacuous",
  );
});
