/**
 * A paper's explanation page offers the reading faces its face pages offer (dispatch 211).
 *
 * On live, every paper page's tabs were Explanation, Results, German source and Facsimile, four
 * literal links written before any English existed, while each face page's chooser (FaceChooser)
 * offered English translation and Parallel bilingual too. A reader landing on a paper could not
 * reach its English, final for all four papers. Both choosers now take their list from
 * faceTabList (faceTabs.ts). This holds them equal on the rendered pages, per paper: the
 * explanation's chooser against the chooser on the same paper's English face, label for label and
 * href for href, tabs and "Not yet available" line both.
 *
 * The Explanation link is compared by label only: on the explanation page it is "?view=reading",
 * the page itself, and on a face page it is the paper's address.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

type Chooser = { readonly tabs: readonly string[]; readonly pending: readonly string[] };

/** "Label -> href" for each link, the Explanation link by label alone. */
function entries(fragment: string): string[] {
  return [...fragment.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => {
    const label = (m[2] ?? "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    const href = /href="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "";
    return label === "Explanation" ? label : `${label} -> ${href}`;
  });
}

/** The page's one "Reading face" landmark: its tabs row and its "Not yet available" line. */
function chooser(markup: string): Chooser {
  const navs = [...markup.matchAll(/<nav [^>]*aria-label="Reading face"[^>]*>([\s\S]*?)<\/nav>/g)];
  expect(navs.length).toBe(1);
  const nav = navs[0]?.[1] ?? "";
  const tabs = /<div class="face-tabs">([\s\S]*?)<\/div>/.exec(nav)?.[1] ?? "";
  const pending = /<p class="face-pending fine">([\s\S]*?)<\/p>/.exec(nav)?.[1] ?? "";
  return { tabs: entries(tabs), pending: entries(pending) };
}

const same = (a: Chooser, b: Chooser) =>
  JSON.stringify(a.tabs) === JSON.stringify(b.tabs) &&
  JSON.stringify(a.pending) === JSON.stringify(b.pending);

async function explanation(paperId: (typeof PAPERS)[number]): Promise<string> {
  // Brownian motion's paper page is PaperReader (src/app/papers/brownian-motion/page.tsx).
  return exportMarkup(
    paperId === "brownian-motion" ? await PaperReader() : await PaperPage({ paperId }),
  );
}

describe("the explanation's face tabs are the face pages' chooser", () => {
  for (const paperId of PAPERS) {
    test(`${paperId}: the same faces, in the same order, with the same hrefs`, async () => {
      const paper = chooser(await explanation(paperId));
      const english = chooser(await exportMarkup(await PaperPage({ paperId, face: "english" })));
      expect(paper).toEqual(english);
      // Not vacuous: the English is final for every paper, and the fix was to offer it.
      expect(paper.tabs).toContain(`English translation -> /papers/${paperId}/view/english/`);
      expect(paper.tabs.length).toBeGreaterThan(4);
    });
  }

  test("the comparison fails when either chooser drops a face", async () => {
    // A planted negative on the comparison itself: an extraction that saw nothing, or an equality
    // that ignored order or a missing face, would pass the tests above for the wrong reason.
    const english = chooser(
      await exportMarkup(await PaperPage({ paperId: "mass-energy", face: "english" })),
    );
    expect(english.tabs.length).toBeGreaterThan(4);
    expect(same(english, english)).toBe(true);
    for (let i = 1; i < english.tabs.length; i++) {
      const dropped = { ...english, tabs: english.tabs.filter((_, j) => j !== i) };
      expect(same(dropped, english)).toBe(false);
      expect(same(english, dropped)).toBe(false);
    }
    const swapped = { ...english, tabs: [...english.tabs].reverse() };
    expect(same(swapped, english)).toBe(false);
  });

  test("the explanation's own behaviour stays: current in the static HTML, routes not intercepted", async () => {
    for (const paperId of PAPERS) {
      const markup = await explanation(paperId);
      const nav =
        /<nav [^>]*aria-label="Reading face"[^>]*>([\s\S]*?)<\/nav>/.exec(markup)?.[1] ?? "";
      // The explanation is marked current without JavaScript.
      expect(nav).toContain(
        '<a href="?view=reading" data-view-link="reading" aria-current="page">',
      );
      // A route link carrying data-view-link is switched in place and never navigates, so only the
      // explanation's own link and, on a paper without result cards, Results may carry one.
      const intercepted = [...nav.matchAll(/data-view-link="([^"]*)"/g)].map((m) => m[1]);
      expect(intercepted).toContain("reading");
      for (const face of intercepted) expect(["reading", "results"]).toContain(face);
    }
  });
});
