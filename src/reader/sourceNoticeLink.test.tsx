/**
 * Each passage on a paper page carries a source notice, shown in place of the explanation
 * when ?view= names a source face. On live, ?view=german on light-quanta and mass-energy
 * showed 12 and 8 of those notices and none of them linked anywhere, while each paper's
 * /view/german/ page held the drafted German. The notice now links there exactly when the
 * German face has text, by the dispatch's own predicate.
 *
 * Both directions are asserted: a paper with a draft gets the link in every passage, and
 * special relativity, which has no ledger draft face, gets it only once its edition gives the
 * German face text, so the link cannot be satisfied by printing it unconditionally.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { paperSourceFaces } from "./paperSourceFaces.ts";

function sourceNotices(markup: string): string[] {
  return [...markup.matchAll(/<div data-face-source="true" hidden="">([\s\S]*?)<\/div>/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("a passage's source notice leads to the German that exists", () => {
  test("light-quanta and mass-energy: every notice links to the drafted German face", async () => {
    for (const paperId of ["light-quanta", "mass-energy"] as const) {
      // The premise, checked rather than assumed: this paper has a German draft.
      expect(loadGermanSourceFace(paperId)?.blocks.length ?? 0).toBeGreaterThan(0);
      const notices = sourceNotices(await exportMarkup(await PaperPage({ paperId })));
      expect(notices.length).toBeGreaterThan(0);
      for (const notice of notices) {
        expect(notice).toContain("not yet available");
        expect(notice).toContain(
          `<a href="/papers/${paperId}/view/german/">Read the drafted German source for the whole paper →</a>`,
        );
      }
    }
  });

  test("special-relativity: a notice links to the German face exactly when that face has text", async () => {
    // Until dispatch 192 this said special relativity had no German text and asserted no link.
    // It still has no ledger draft face, but its German now arrives as an unreviewed edition a
    // section at a time, which the German face renders. What this watches: the link follows the
    // face, never the paper's name; an unreviewed edition is called drafted; and one that does
    // not yet reach every section does not promise the whole paper.
    expect(loadGermanSourceFace("special-relativity")?.blocks.length ?? 0).toBe(0);
    const sources = await paperSourceFaces("special-relativity");
    const notices = sourceNotices(
      await exportMarkup(await PaperPage({ paperId: "special-relativity" })),
    );
    expect(notices.length).toBeGreaterThan(0);
    for (const notice of notices) {
      expect(notice).toContain("not yet available");
      if (sources.availability.german !== "available") {
        expect(notice).not.toContain("/view/german/");
        continue;
      }
      expect(notice).toContain(
        sources.germanIsPartial
          ? '<a href="/papers/special-relativity/view/german/">Read the German source drafted so far →</a>'
          : '<a href="/papers/special-relativity/view/german/">Read the drafted German source for the whole paper →</a>',
      );
    }
  });
});
