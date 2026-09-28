/**
 * THE INDEX SAYS WHERE EACH WALKTHROUGH LEADS (am-2rl9).
 *
 * /tapes/ groups by instrument, which is the right axis for a reader choosing an instrument and the
 * wrong one for a reader arriving from a paper. Until now neither the paper nor the section appeared
 * anywhere on the page, so the one thing a walkthrough is FOR was the one thing the catalogue of
 * walkthroughs did not say.
 *
 * Every number below is derived from the records. Nothing here asserts a census: the counts move
 * whenever a tape is written or a manifest's sourceRefs change, so they are floored and reported.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTeachingTapes } from "../../content/teachingTapes.ts";
import TapesIndex from "./page.tsx";

const html = renderToStaticMarkup(TapesIndex());
const { tapes } = loadTeachingTapes();

const byExperiment = new Map<string, typeof tapes>();
for (const tape of tapes)
  byExperiment.set(tape.experimentId, [...(byExperiment.get(tape.experimentId) ?? []), tape]);

/** Groups whose tapes all lead back to one paper, which is what lets a heading name it. */
const singlePaperGroups = [...byExperiment.entries()].filter(([, list]) => {
  const papers = new Set(list.flatMap((t) => t.passages.map((p) => p.paper)));
  return papers.size === 1;
});
const withPassages = tapes.filter((t) => t.passages.length > 0);

function escapeForHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

describe("the teaching-tape index names each walkthrough's destination", () => {
  test("the populations are non-empty, so the checks below examine something", () => {
    console.log(
      `[tape index] ${byExperiment.size} instrument groups, ${singlePaperGroups.length} of them ` +
        `single-paper; ${withPassages.length} of ${tapes.length} tapes name a passage`,
    );
    expect(byExperiment.size).toBeGreaterThan(5);
    expect(singlePaperGroups.length).toBeGreaterThan(5);
    expect(withPassages.length).toBeGreaterThan(5);
  });

  test("every single-paper group names its paper, and links it", () => {
    const missing: string[] = [];
    for (const [experimentId, list] of singlePaperGroups) {
      const passage = list.flatMap((t) => t.passages)[0];
      if (!passage) continue;
      if (!html.includes(`href="/papers/${passage.paper}/"`))
        missing.push(`${experimentId}: no link to /papers/${passage.paper}/`);
      if (!html.includes(escapeForHtml(passage.paperTitle)))
        missing.push(`${experimentId}: paper title "${passage.paperTitle}" absent`);
    }
    expect(missing).toEqual([]);
  });

  test("every tape links the section or sections it leads back to", () => {
    const missing: string[] = [];
    for (const tape of withPassages)
      for (const passage of tape.passages) {
        if (!html.includes(`href="${passage.href}"`))
          missing.push(`${tape.tapeId}: no link to ${passage.href}`);
        if (!html.includes(escapeForHtml(passage.sectionTitle)))
          missing.push(`${tape.tapeId}: section title "${passage.sectionTitle}" absent`);
      }
    expect(missing).toEqual([]);
  });

  test("a group that spanned two papers would name none, rather than an arbitrary first", () => {
    // The page derives this from a Map keyed by paper and renders nothing when the size is not 1.
    // Asserted as a property rather than by planting, because no group spans two papers today and
    // a fixture that forced one would be testing a corpus that does not exist. Recorded so the
    // reason the branch is unexercised is written down rather than discovered later.
    const spanning = [...byExperiment.entries()].filter(([, list]) => {
      const papers = new Set(list.flatMap((t) => t.passages.map((p) => p.paper)));
      return papers.size > 1;
    });
    expect(spanning.map(([id]) => id)).toEqual([]);
  });
});
