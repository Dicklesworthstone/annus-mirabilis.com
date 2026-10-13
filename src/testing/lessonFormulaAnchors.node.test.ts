/**
 * EVERY LESSON-FORMULA EDGE LANDS ON AN ANCHOR A READER'S BROWSER CAN FIND (am-cadl).
 *
 * Since bf06087af the foundation pages render each `usedAt` edge of
 * `content/lesson-formulas/<lesson>.yaml` as a link into the printed display it names. So a record
 * naming a display that is not on the page it routes to is a DEAD LINK ON A READING PAGE, and the
 * reader meets it rather than the author.
 *
 * That is not hypothetical in this repository. On the same day this corpus became reader-facing, an
 * offline chapter was found shipping `href="#foundation-logarithms"` against no such section
 * (049420fac), and the first build of the journey explainers drew all 39 panels over routes that
 * were every one a 404. A link that resolves for its author and not for a reader is the recurring
 * shape, which is why this reads the BUILT PAGES.
 *
 * IN THE NODE LANE, because it reads `out/`. That lane refuses to start against a stale build and
 * says so. A bun-lane version would have to choose between failing for every pane without a fresh
 * build and skipping silently, and a silent skip is a vacuous pass.
 *
 * IT READS THE RECORDS OFF DISK, not the loader's output. `lessonFormulaUses` DROPS an edge whose
 * display id does not name a section, deliberately, so a check built on the loader could only ever
 * see edges that already looked routable. The population has to be the authored files.
 *
 * WHY THE FACE ROUTE AND NOT THE SECTION PAGE. A display's id is on the reading faces and not on
 * the bare section page: measured 2026-10-13, `/papers/light-quanta/s5/` carries no `eq-s5-d6`
 * while its `view/parallel`, `view/english` and `view/german` each do. `formulaUses` therefore
 * builds a `view/parallel` route, and that is the route this checks.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "./outFreshness.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT = join(ROOT, "out");
const RECORDS = join(ROOT, "content/lesson-formulas");

type Edge = Readonly<{ lesson: string; paper: string; display: string }>;

/**
 * Every authored edge, read with two anchored line patterns rather than a YAML parser.
 *
 * The parser is deliberately dumb and anchored: `paper:` and `display:` are indented list fields
 * under `usedAt`, and reading them positionally keeps this check independent of the project's own
 * YAML reader, which is the layer `lessonFormulaUses` goes through. Its non-vacuity is asserted
 * below, so a pattern that stopped matching could not pass as an absence of edges.
 */
export function authoredEdges(dir: string): readonly Edge[] {
  const edges: Edge[] = [];
  if (!existsSync(dir)) return edges;
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".yaml"))) {
    const lesson = file.slice(0, -".yaml".length);
    let paper = "";
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      const onPaper = /^\s+- paper:\s*(\S+)\s*$/u.exec(line);
      if (onPaper?.[1] !== undefined) {
        paper = onPaper[1];
        continue;
      }
      const onDisplay = /^\s+display:\s*(\S+)\s*$/u.exec(line);
      if (onDisplay?.[1] !== undefined && paper) {
        edges.push({ lesson, paper, display: onDisplay[1] });
      }
    }
  }
  return edges;
}

/** The route `formulaUses` builds, and the id it expects to find there. */
export function faceRouteFor(edge: Edge): string | null {
  const section = /^eq-(s\d+)-/u.exec(edge.display)?.[1];
  return section === undefined
    ? null
    : join(OUT, "papers", edge.paper, section, "view/parallel/index.html");
}

const edges = authoredEdges(RECORDS);

test("the authored edge set is not empty, so the verdict below is a measurement", () => {
  // No freshness guard here on purpose: this reads `content/` only, so it stays answerable on a
  // stale build. The guard sits on the two tests that read `out/`, which is the narrowest place it
  // can be and still be honest.
  // A floor, not an equality: edges are authored as lessons are covered, and am-cadl asks for 25
  // more lessons. Without this a parser that stopped matching would report no dangling edges.
  assert.ok(
    edges.length >= 25,
    `expected at least 25 authored lesson-formula edges, read ${edges.length}`,
  );
  console.log(
    `[census] lesson-formula-anchors examined ${edges.length} authored usedAt edges ` +
      `(minimum 25) over ${new Set(edges.map((e) => e.lesson)).size} lessons`,
  );
});

test("every edge names a section, so a route can be built for it at all", () => {
  // `lessonFormulaUses` drops an edge without one rather than guessing a route, so an edge that
  // reaches this state would be silently absent from the rail instead of wrong on it.
  const sectionless = edges.filter((edge) => faceRouteFor(edge) === null);
  assert.deepEqual(
    sectionless.map((edge) => `${edge.lesson} -> ${edge.paper} ${edge.display}`),
    [],
    "a display id that does not name its section cannot be routed, and the rail drops it silently",
  );
});

test("every edge's display id is on the built face route it links to", () => {
  assertOutFreshness();
  const dangling: string[] = [];
  for (const edge of edges) {
    const route = faceRouteFor(edge);
    if (route === null) continue;
    if (!existsSync(route)) {
      dangling.push(`${edge.lesson} -> ${edge.paper} ${edge.display}: no page at ${route}`);
      continue;
    }
    // The attribute as the generator writes it, with the leading space, so `data-x-id="…"` on
    // another element cannot be mistaken for the id.
    if (!readFileSync(route, "utf8").includes(` id="${edge.display}"`))
      dangling.push(`${edge.lesson} -> ${edge.paper} ${edge.display}: page served, id absent`);
  }
  // Named rather than counted: a count does not say which record to open.
  assert.deepEqual(dangling, []);
});

test("every authored edge reaches the reader, and the page invents none", () => {
  assertOutFreshness();
  /*
   * The reconciliation, read off the BUILT lesson page rather than from a render.
   *
   * It closes the hole the two checks above cannot see. `formulaUses` drops an edge whose paper is
   * not among the papers the page loaded, and `lessonFormulaUses` drops one whose id names no
   * section, both silently and both by design. So a record can be valid, its display can exist,
   * and the link can still be absent from the rail. Counting the rail's links against the authored
   * edges is the only check that notices.
   *
   * Counted per lesson rather than in total, because a total hides a swap: one lesson losing a
   * link while another gains one leaves the sum unmoved, which is the failure a count-only ratchet
   * cannot see.
   */
  const authored = new Map<string, number>();
  for (const edge of edges) authored.set(edge.lesson, (authored.get(edge.lesson) ?? 0) + 1);

  const mismatched: string[] = [];
  for (const [lesson, count] of [...authored].sort()) {
    const page = join(OUT, "foundations", lesson, "index.html");
    if (!existsSync(page)) {
      mismatched.push(`${lesson}: no built page at ${page}`);
      continue;
    }
    const html = readFileSync(page, "utf8");
    const rail = /<h2>Where the papers print these formulas<\/h2>([\s\S]*?)<\/section>/u.exec(html);
    const rendered = rail === null ? 0 : (rail[1]?.match(/href="\/papers\//gu) ?? []).length;
    if (rendered !== count) mismatched.push(`${lesson}: authored ${count}, rendered ${rendered}`);
  }
  assert.deepEqual(mismatched, []);
  console.log(
    `[census] lesson-formula-rails examined ${authored.size} lessons with edges ` +
      `(minimum 10), reconciling ${edges.length} authored links against the built pages`,
  );
  // The floor belongs here too: an empty `authored` map would reconcile vacuously above.
  assert.ok(authored.size >= 10, `expected at least 10 lessons with edges, found ${authored.size}`);
});

test("the detector fires on a display no paper prints (planted negative)", () => {
  assertOutFreshness();
  // The arm that makes the clean result above mean something. Planted as an edge rather than by
  // editing the corpus, because the corpus is shared and this needs no file to change.
  const planted: Edge = {
    lesson: "planted",
    paper: "brownian-motion",
    display: "eq-s4-d99999",
  };
  const route = faceRouteFor(planted);
  assert.ok(route !== null, "the planted id names a section, so it is routable");
  assert.ok(existsSync(route), "the planted route is a real page, so only the id is missing");
  assert.ok(
    !readFileSync(route, "utf8").includes(` id="${planted.display}"`),
    "a display id no paper prints must not be found on the page",
  );
  // And a positive control on the same page, so the detector is not simply blind.
  assert.ok(readFileSync(route, "utf8").includes(' id="eq-s4-d6"'));
});
