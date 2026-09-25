/**
 * Each passage on a paper page carries a source block, shown in place of the explanation when
 * ?view= names a source face. Since D-2026-09-25-no-review-status-banners it holds only the links:
 * its sentence ("The reviewed German, aligned English, gloss, facsimile, and split view for this
 * passage are not yet available") was false once those faces existed, and review copy besides.
 * Earlier, on live, ?view=german on light-quanta and mass-energy showed 12 and 8 of those notices
 * and none of them linked anywhere, while each paper's /view/german/ page held the German. The
 * block links there exactly when the German face has text, by the dispatch's own predicate.
 *
 * Both directions are asserted: a paper with a draft gets the link in every passage, and
 * special relativity, which has no ledger draft face, gets it only once its edition gives the
 * German face text, so the link cannot be satisfied by printing it unconditionally.
 *
 * Beside it, the English (dispatch 211): the English of all four papers was final while the only
 * whole-paper link on a paper page led to the German. Each notice now also offers the English
 * face wherever the paper has English units. Its label claims no review, because the face's own
 * banner says who checked the translation.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";
import { type PaperSourceFaces, paperSourceFaces } from "./paperSourceFaces.ts";

/** The English link a notice must carry, or null where the paper has no English units. */
function englishLink(paperId: string, sources: PaperSourceFaces): string | null {
  if (sources.availability.english !== "available") return null;
  return sources.englishIsPartial
    ? `<a href="/papers/${paperId}/view/english/">Read the English translation so far →</a>`
    : `<a href="/papers/${paperId}/view/english/">Read the English translation of the whole paper →</a>`;
}

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
      // The premise of the English link, checked rather than assumed: this paper's English is
      // final, in every section.
      const sources = await paperSourceFaces(paperId);
      expect(sources.availability.english).toBe("available");
      expect(sources.englishIsPartial).toBe(false);
      for (const notice of notices) {
        expect(notice).not.toContain("not yet available");
        expect(notice).not.toMatch(/reviewed|drafted/);
        expect(notice).toContain(
          `<a href="/papers/${paperId}/view/german/">Read the German source for the whole paper →</a>`,
        );
        expect(notice).toContain(
          `<a href="/papers/${paperId}/view/english/">Read the English translation of the whole paper →</a>`,
        );
      }
    }
  });

  test("special-relativity: a notice links to the German face exactly when that face has text", async () => {
    // Until dispatch 192 this said special relativity had no German text and asserted no link.
    // It still has no ledger draft face, but its German now arrives as an unreviewed edition a
    // section at a time, which the German face renders. What this watches: the link follows the
    // face, never the paper's name, and one that does not yet reach every section does not promise
    // the whole paper. No label calls it drafted (D-2026-09-25-no-review-status-banners).
    expect(loadGermanSourceFace("special-relativity")?.blocks.length ?? 0).toBe(0);
    const sources = await paperSourceFaces("special-relativity");
    const notices = sourceNotices(
      await exportMarkup(await PaperPage({ paperId: "special-relativity" })),
    );
    expect(notices.length).toBeGreaterThan(0);
    const english = englishLink("special-relativity", sources);
    for (const notice of notices) {
      expect(notice).not.toContain("not yet available");
      expect(notice).not.toMatch(/reviewed|drafted/);
      // The English follows its face the same way: present exactly when the face has units.
      if (english) expect(notice).toContain(english);
      else expect(notice).not.toContain("/view/english/");
      if (sources.availability.german !== "available") {
        expect(notice).not.toContain("/view/german/");
        continue;
      }
      expect(notice).toContain(
        sources.germanIsPartial
          ? '<a href="/papers/special-relativity/view/german/">Read the German source so far →</a>'
          : '<a href="/papers/special-relativity/view/german/">Read the German source for the whole paper →</a>',
      );
    }
  });

  test("brownian-motion: every notice and the original companion offer the German and the English", async () => {
    // Brownian's paper page is PaperReader, whose two German links are its own, so it is checked
    // here beside the others: the notice under each passage, and the companion's "original" pane.
    const sources = await paperSourceFaces("brownian-motion");
    const english = englishLink("brownian-motion", sources);
    expect(english).not.toBeNull();
    const german =
      '<a href="/papers/brownian-motion/view/german/">Read the German source for the whole paper →</a>';
    const flat = (markup: string) => markup.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
    const notices = sourceNotices(await exportMarkup(await PaperReader()));
    expect(notices.length).toBeGreaterThan(0);
    for (const notice of notices) {
      expect(notice).not.toMatch(/reviewed|not yet available/);
      expect(flat(notice)).toContain(flat(german));
      expect(notice).toContain(english ?? "");
    }
    // Inside the companion pane itself: the whole page also holds every passage's notice, which
    // carries the same links, so a page-wide match would pass with the pane's links removed.
    const page = flat(await exportMarkup(await PaperReader({ companion: "original" })));
    const panes = [...page.matchAll(/data-companion-kind="original"[^>]*>([\s\S]*?)<\/div>/g)].map(
      (m) => m[1] ?? "",
    );
    expect(panes.length).toBeGreaterThan(0);
    for (const pane of panes) {
      expect(pane).not.toMatch(/reviewed|not yet available/);
      expect(pane).toContain(flat(german));
      expect(pane).toContain(english ?? "");
    }
  });
});
