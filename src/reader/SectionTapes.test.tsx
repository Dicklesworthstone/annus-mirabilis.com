/**
 * A SECTION NAMES ITS WALKTHROUGHS, CHECKED IN THE RENDERED PAGE (am-2rl9).
 *
 * The links are asserted in the markup the build produces, not against the component in isolation
 * and not against the loader's own output, because the question is whether a reader in the paper
 * can reach a walkthrough. Both branches are exercised by one render: brownian-motion has sections
 * with walkthroughs and sections without, and the test requires both to be non-empty so neither
 * branch can go vacuously green.
 */
import { describe, expect, test } from "bun:test";
import { loadTeachingTapes, tapesForPassage } from "../content/teachingTapes.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";

const PAPER = "brownian-motion";
const html = await exportMarkup(await PaperReader({}));

/** Every (paper, section) pair some walkthrough leads back to, from the records themselves. */
const pairs = new Map<string, string[]>();
for (const tape of loadTeachingTapes().tapes)
  for (const passage of tape.passages) {
    const key = `${passage.paper}/${passage.sectionId}`;
    pairs.set(key, [...(pairs.get(key) ?? []), tape.tapeId]);
  }
/**
 * A title as React writes it into static markup. Six of the twenty-two tape titles carry an
 * apostrophe ("Einstein's 0.8 micron particle", "Perrin's count"), which React emits as `&#x27;`,
 * so searching the markup for the raw title reports a missing link that is in fact present.
 */
function escapeForHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

const brownianSections = [...pairs.keys()]
  .filter((k) => k.startsWith(`${PAPER}/`))
  .map((k) => k.slice(PAPER.length + 1));

describe("a paper section names the walkthroughs that lead back to it", () => {
  test("the records give both populations, so neither branch below is vacuous", () => {
    // Reported with its denominator, then floored. The pair count moves whenever a manifest's
    // sourceRefs change, so it is printed rather than asserted equal to a frozen number.
    console.log(
      `[section walkthroughs] ${pairs.size} (paper, section) pairs across all papers; ` +
        `${brownianSections.length} of them in ${PAPER}: ${brownianSections.sort().join(", ")}`,
    );
    expect(pairs.size).toBeGreaterThan(5);
    expect(brownianSections.length).toBeGreaterThan(0);
    // The other branch: sections this paper renders that NO walkthrough names. Without one of
    // these, "renders nothing when there is no tape" would never be executed.
    const rendered = [...html.matchAll(/<section id="(s\d+)"/g)].map((m) => m[1] ?? "");
    const withoutTape = rendered.filter((id) => !brownianSections.includes(id));
    expect(rendered.length).toBeGreaterThan(brownianSections.length);
    expect(withoutTape.length).toBeGreaterThan(0);
  });

  test("every walkthrough of a rendered section is linked from it, by href and by title", () => {
    const missing: string[] = [];
    for (const sectionId of brownianSections) {
      const tapes = tapesForPassage(PAPER, sectionId);
      expect(tapes.length).toBeGreaterThan(0);
      for (const tape of tapes) {
        // The id is in the href and the title is the link's text, so a reader knows where it goes.
        if (!html.includes(`/tapes/${tape.tapeId}`))
          missing.push(`${sectionId}: href ${tape.tapeId}`);
        if (!html.includes(escapeForHtml(tape.title)))
          missing.push(`${sectionId}: title "${tape.title}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("exactly the sections with a walkthrough carry the nav, and it is a real anchor", () => {
    const navs = [...html.matchAll(/class="[^"]*section-tapes[^"]*"/g)];
    expect(navs.length).toBe(brownianSections.length);
    // No JavaScript anywhere in it: the controls are anchors, which is what makes it work with
    // script off. A <button> here would be a dead control on the no-script page.
    const block = html.slice(html.indexOf("section-tapes"));
    const navEnd = block.indexOf("</nav>");
    expect(navEnd).toBeGreaterThan(0);
    const firstNav = block.slice(0, navEnd);
    expect(firstNav).toContain("<a ");
    expect(firstNav).not.toContain("<button");
  });

  test("a section no walkthrough names gets nothing, and an unknown paper gets nothing", () => {
    expect(tapesForPassage(PAPER, "s99")).toEqual([]);
    expect(tapesForPassage("not-a-paper", "s5")).toEqual([]);
  });
});

/**
 * THE OTHER THREE PAPERS, WHICH THE BROWNIAN RENDER ABOVE CANNOT SPEAK FOR (am-2rl9).
 *
 * PaperReader serves brownian-motion alone; light-quanta, special-relativity and mass-energy render
 * through the paper-agnostic PaperPage shell. The first version of this file tested only the
 * PaperReader render, so it was green while 13 of the 15 (paper, section) pairs had no link at all,
 * and the commit message said the opposite. The population a test examines has to be the population
 * that ships.
 */
describe("the walkthrough links reach the papers PaperPage renders", () => {
  const shellPapers = [...new Set([...pairs.keys()].map((k) => k.split("/")[0] ?? ""))]
    .filter((p) => p !== PAPER)
    .sort();

  test("there are papers rendered by the shell, so the loop below is not empty", () => {
    expect(shellPapers.length).toBeGreaterThan(1);
    console.log(`[shell papers] ${shellPapers.join(", ")}`);
  });

  for (const paperId of ["special-relativity", "light-quanta", "mass-energy"]) {
    test(`${paperId} links every walkthrough that names one of its sections`, async () => {
      const sections = [...pairs.keys()]
        .filter((k) => k.startsWith(`${paperId}/`))
        .map((k) => k.slice(paperId.length + 1));
      expect(sections.length).toBeGreaterThan(0);
      const markup = await exportMarkup(await PaperPage({ paperId }));
      const missing: string[] = [];
      for (const sectionId of sections)
        for (const tape of tapesForPassage(paperId, sectionId)) {
          if (!markup.includes(`/tapes/${tape.tapeId}`))
            missing.push(`${sectionId}: href ${tape.tapeId}`);
          if (!markup.includes(escapeForHtml(tape.title)))
            missing.push(`${sectionId}: title "${tape.title}"`);
        }
      expect(missing).toEqual([]);
      const navs = [...markup.matchAll(/class="[^"]*section-tapes[^"]*"/g)];
      expect(navs.length).toBe(sections.length);
    }, 120_000);
  }
});
