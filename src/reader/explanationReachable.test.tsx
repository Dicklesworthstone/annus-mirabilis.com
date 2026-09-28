import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

/**
 * A PARAGRAPH'S EXPLANATION IS REACHABLE FROM THE SECTION PAGE IT IS PRINTED ON (am-3a8u follow-on).
 *
 * An argument passage has exactly one home: its record declares `section`, and the compiler enforces
 * that with `duplicate-placement` and `section-mismatch`, so it renders in that section and nowhere
 * else. content/bindings is a different and wider relation: it says which passages explain each
 * printed paragraph, and a paragraph in §5 may be explained by a passage that lives in §3. Both are
 * right. What can go wrong is the reader's route between them.
 *
 * It already went wrong once. af719189 repaired a jump to
 * /papers/brownian-motion/s5/#arg-bm-diffusivity: the bindings say §5 is bound to that argument, so
 * the link looked correct, but the argument renders in §3 and a wrong fragment returns HTTP 200, so
 * the reader landed at the top of §5 at the moment the route paid off and was never told.
 *
 * THIS TEST READS A RENDER, and that is the whole point of it. A check over content/bindings cannot
 * answer the question: the bindings list both sections, so a static check written against them
 * reports clean whether or not the anchor exists, which is what happened when one was tried. Only
 * the rendered section page knows where the link goes and whether the anchor is on it.
 */
const ROOT = process.cwd();

/** Each argument's home section, from the record that declares it. */
function argumentHomes(): Map<string, { paper: string; section: string }> {
  const out = new Map<string, { paper: string; section: string }>();
  const dir = join(ROOT, "content", "arguments");
  for (const paper of readdirSync(dir, { withFileTypes: true })) {
    if (!paper.isDirectory()) continue;
    for (const file of readdirSync(join(dir, paper.name))) {
      if (!file.endsWith(".json")) continue;
      const r = JSON.parse(readFileSync(join(dir, paper.name, file), "utf8")) as {
        id?: unknown;
        paper?: unknown;
        section?: unknown;
      };
      if (typeof r.id === "string" && typeof r.paper === "string" && typeof r.section === "string")
        out.set(r.id, { paper: r.paper, section: r.section });
    }
  }
  return out;
}

const PAPERS = readdirSync(resolve(ROOT, "content/bindings"))
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.slice(0, -5))
  .sort();

const homes = argumentHomes();

/** paragraph section -> the passages explaining it that live in a DIFFERENT section. */
type Away = { paper: string; unit: string; section: string; passage: string; home: string };
const away: Away[] = [];
for (const paper of PAPERS)
  for (const b of loadParagraphBindings(ROOT, paper) ?? []) {
    if (b.unexplained) continue;
    const section = /^(s\d+)/.exec(b.unit)?.[1];
    if (!section) continue;
    for (const passage of b.passages) {
      const home = homes.get(passage);
      if (home && home.section !== section)
        away.push({ paper, unit: b.unit, section, passage, home: home.section });
    }
  }

/**
 * Every `/papers/<paper>/<section>/#<argument>` a reader can click, from product source only: a test
 * builds its own DOM and carries its own anchor, so its fixtures are not claims about these pages.
 */
type Jump = { paper: string; section: string; passage: string; file: string };
function sectionScopedJumps(): Jump[] {
  const out: Jump[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test."))
        for (const m of readFileSync(p, "utf8").matchAll(
          /\/papers\/([a-z-]+)\/(s\d+)\/#(arg-[a-z0-9-]+)/g,
        ))
          out.push({
            paper: m[1] as string,
            section: m[2] as string,
            passage: m[3] as string,
            file: p.slice(ROOT.length + 1),
          });
    }
  };
  walk(resolve(ROOT, "src"));
  return out;
}
const jumps = sectionScopedJumps();

/**
 * Two faces per section, because the two questions live on different ones. A printed paragraph and
 * its link to an explanation are on the GERMAN face; the explanation passage itself, with the
 * `id` an anchor lands on, is on the READING face, which is DEFAULT_FACE and therefore the face a
 * bare `/papers/<paper>/<section>/#<argument>` resolves to. Rendering the wrong one reported 27
 * missing anchors on a site that has them, which is the same lesson as the bindings: ask the layer
 * the reader actually meets.
 */
const german = new Map<string, string>();
const reading = new Map<string, string>();
for (const { paper, section } of [...away, ...jumps]) {
  const key = `${paper}/${section}`;
  if (german.has(key)) continue;
  german.set(
    key,
    renderToStaticMarkup(await PaperPage({ paperId: paper, section, face: "german" } as never)),
  );
  // The reading face streams suspended islands, so it is exported the way the build exports it;
  // renderToStaticMarkup throws "A component suspended while responding to synchronous input".
  reading.set(key, await exportMarkup(await PaperPage({ paperId: paper, section } as never)));
}

describe("a paragraph's explanation is reachable from the section page it is printed on", () => {
  test("the sweep found cross-section explanations to check", () => {
    // Not vacuous: with none of these the assertions below would pass over nothing, and this is
    // exactly the shape that reports clean while the reader is stranded.
    console.log(
      `[explanation reach] ${away.length} paragraph-to-passage pairs explained from another section, ` +
        `across ${german.size} section pages, each rendered on both faces`,
    );
    expect(away.length).toBeGreaterThan(0);
    expect(german.size).toBeGreaterThan(0);
  });

  test("no section page sends a reader to an anchor it does not have", () => {
    // The af719189 defect, generalised: a link into THIS section naming a passage that lives
    // elsewhere is a fragment no page carries, and the browser answers 200 and stays put.
    const stranded: string[] = [];
    for (const a of away) {
      const html = german.get(`${a.paper}/${a.section}`) ?? "";
      const selfLink = `href="/papers/${a.paper}/${a.section}/#${a.passage}"`;
      if (html.includes(selfLink) && !html.includes(`id="${a.passage}"`))
        stranded.push(
          `${a.paper}/${a.section}: links to #${a.passage}, which renders in ${a.home}`,
        );
    }
    expect([...new Set(stranded)]).toEqual([]);
  });

  test("every section-scoped jump lands on an anchor that section renders", () => {
    // THE af719189 DEFECT, as a gate. That link named §5 because the bindings bind §5 to
    // arg-bm-diffusivity, and the argument renders in §3; a wrong fragment returns 200, so the
    // reader landed at the top of §5 and was told nothing. Rendering the named section is the only
    // way to see it: the bindings, which is where the link was written from, say §5 is legitimate.
    const missing: string[] = [];
    for (const j of jumps) {
      const html = reading.get(`${j.paper}/${j.section}`) ?? "";
      if (!html.includes(`id="${j.passage}"`))
        missing.push(
          `${j.file}: /papers/${j.paper}/${j.section}/#${j.passage} is not on that page`,
        );
    }
    console.log(`[explanation reach] ${jumps.length} section-scoped jumps in product source`);
    expect(jumps.length).toBeGreaterThan(10);
    expect([...new Set(missing)]).toEqual([]);
  });

  test("every such paragraph carries a link that reaches its explanation", () => {
    const unreachable: string[] = [];
    for (const a of away) {
      const html = german.get(`${a.paper}/${a.section}`) ?? "";
      if (!html.includes(`id="${a.unit}"`)) continue; // printed elsewhere; not this page's job
      // Reachable means a link whose target actually carries the passage: either the paper root,
      // where every argument renders, or the passage's own section page.
      const reaches =
        html.includes(`href="/papers/${a.paper}/#${a.passage}"`) ||
        html.includes(`href="/papers/${a.paper}/${a.home}/#${a.passage}"`);
      if (!reaches)
        unreachable.push(`${a.paper}/${a.section} ${a.unit} -> ${a.passage} (${a.home})`);
    }
    expect(unreachable).toEqual([]);
  });
});
