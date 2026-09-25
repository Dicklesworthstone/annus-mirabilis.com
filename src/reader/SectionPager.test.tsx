/**
 * A section's own page keeps the paper around it (am-read-shell-routes-3ua): the outline names every
 * section of the paper, the end of the page offers the section before and after, and the way back
 * lands on this section inside the whole paper. Rendered from the real compiled papers.
 */
import { describe, expect, test } from "bun:test";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { loadPaper } from "../content/server.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";

async function parse(html: string) {
  await installDom();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return {
    doc,
    done: uninstallDom,
    outline: [
      ...doc.querySelectorAll('nav[aria-label="Argument outline"] > div > a:first-child'),
    ].map((a) => a.getAttribute("href")),
    pager: [...doc.querySelectorAll(".section-pager > a")].map(
      (a) => `${a.getAttribute("rel")} ${a.getAttribute("href")}`,
    ),
    back: [...doc.querySelectorAll(".page-intro a")].map((a) => a.getAttribute("href")),
  };
}

describe("a section's own page", () => {
  test("light quanta §5: every section in the outline, §4 and §6 at the end, back to #s5", async () => {
    const { paper } = await loadPaper("light-quanta");
    const ids = paper.sections.map((s) => s.id);
    expect(ids.length).toBeGreaterThan(2);
    const at = ids.indexOf("s5");
    expect(at).toBeGreaterThan(0);
    const page = await parse(
      await exportMarkup(await PaperPage({ paperId: "light-quanta", section: "s5" })),
    );
    try {
      expect(page.outline).toEqual(ids.map((id) => `/papers/light-quanta/${id}/`));
      // Only this page's section moves within it; the others are plain links to their pages.
      const inPage = [
        ...page.doc.querySelectorAll(
          'nav[aria-label="Argument outline"] > div > a[data-reader-anchor]:first-child',
        ),
      ].map((a) => a.getAttribute("data-reader-anchor"));
      expect(inPage).toEqual(["s5"]);
      expect(page.pager).toEqual([
        `prev /papers/light-quanta/${ids[at - 1]}/`,
        `next /papers/light-quanta/${ids[at + 1]}/`,
      ]);
      expect(page.back).toContain("/papers/light-quanta/#s5");
    } finally {
      await page.done();
    }
  });

  test("the first section has no previous and the last no next", async () => {
    const { paper } = await loadPaper("special-relativity");
    const ids = paper.sections.map((s) => s.id);
    const first = ids[0] as string;
    const last = ids.at(-1) as string;
    const a = await parse(
      await exportMarkup(await PaperPage({ paperId: "special-relativity", section: first })),
    );
    try {
      expect(a.pager).toEqual([`next /papers/special-relativity/${ids[1]}/`]);
    } finally {
      await a.done();
    }
    const b = await parse(
      await exportMarkup(await PaperPage({ paperId: "special-relativity", section: last })),
    );
    try {
      expect(b.pager).toEqual([`prev /papers/special-relativity/${ids.at(-2)}/`]);
    } finally {
      await b.done();
    }
  });

  test("Brownian §4, from its own reader: the sections either side in the pager, every part in the outline, back to #s4", async () => {
    // Derived from the passage records, so the test holds however the passages are filed: §3 was
    // explained from a passage filed under §5 until dispatch 215 filed it under §3.
    const { arguments: passages } = await loadPaper("brownian-motion");
    const printed = ["s0", "s1", "s2", "s3", "s4", "s5"];
    const filed = printed.filter((s) => passages.some((a) => a.section === s));
    const at = filed.indexOf("s4");
    const page = await parse(await exportMarkup(await PaperReader({ section: "s4" })));
    try {
      expect(page.pager).toEqual([
        `prev /papers/brownian-motion/${filed[at - 1]}/`,
        `next /papers/brownian-motion/${filed[at + 1]}/`,
      ]);
      // Every part is in the outline in printed order: its own section page, "#s4" for this one, or,
      // for a part no passage is filed under, the passage that explains it on that passage's page,
      // never a section page that does not exist.
      const bindings = loadParagraphBindings(process.cwd(), "brownian-motion") ?? [];
      expect(page.outline).toEqual(
        printed.map((s) => {
          if (s === "s4") return "#s4";
          if (filed.includes(s)) return `/papers/brownian-motion/${s}/`;
          const id = bindings.find((b) => b.unit.startsWith(`${s}-`))?.passages[0] ?? "?";
          const home = passages.find((a) => a.id === id)?.section ?? "?";
          return `/papers/brownian-motion/${home}/#${id}`;
        }),
      );
      expect(page.back).toContain("/papers/brownian-motion/#s4");
    } finally {
      await page.done();
    }
  });

  test("no pager on a whole paper, nor on a paper of one section", async () => {
    for (const html of [
      await exportMarkup(await PaperPage({ paperId: "light-quanta" })),
      await exportMarkup(await PaperPage({ paperId: "mass-energy", section: "s0" })),
      await exportMarkup(await PaperReader({})),
    ]) {
      const page = await parse(html);
      try {
        expect(page.pager).toEqual([]);
        // Non-vacuity: these are reading pages with an outline.
        expect(page.outline.length).toBeGreaterThan(0);
      } finally {
        await page.done();
      }
    }
  });
});
