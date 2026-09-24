/**
 * Each passage's "Source context" line offers only the faces that have something to show, and
 * opens the German and the scan at the passage's own section.
 *
 * Before: every passage of every paper linked German, English, interlinear gloss and facsimile,
 * each at #<argument id>. English and gloss are empty for all four papers, special-relativity has
 * no German, and no face carries an argument's id, so the links either said "not yet available"
 * or opened at the top of the paper. Asserted in both directions: faces with content are linked,
 * empty ones are not, and a link's fragment is an id the face really has. The passage's "Read the
 * original" action follows the same rule (paperSourceFaces.ts).
 */
import { describe, expect, test } from "bun:test";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { loadPaper } from "../content/server.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { PaperPage } from "./PaperPage.tsx";

async function contextLines(paperId: string) {
  await installDom();
  try {
    const html = await exportMarkup(await PaperPage({ paperId }));
    const page = new DOMParser().parseFromString(html, "text/html");
    return [...page.querySelectorAll("article.reader-passage")].map((passage) => {
      const line = [...passage.querySelectorAll("p.fine")].find((p) =>
        p.textContent?.startsWith("Source context:"),
      );
      const original = [...passage.querySelectorAll(".passage-actions a")].find(
        (a) => a.textContent?.trim() === "Read the original",
      );
      return {
        id: passage.id,
        text: line?.textContent ?? "",
        hrefs: [...(line?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href") ?? ""),
        original: original?.getAttribute("href") ?? null,
      };
    });
  } finally {
    await uninstallDom();
  }
}

describe("a passage's Source context links only faces that exist", () => {
  test("light-quanta: German and facsimile at the passage's section; no English, no gloss", async () => {
    const { arguments: args } = await loadPaper("light-quanta");
    const sectionOf = new Map(args.map((a) => [a.id, a.section]));
    const ids = new Set(loadGermanSourceFace("light-quanta")?.blocks.map((b) => b.id));
    const lines = await contextLines("light-quanta");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text).toBe("Source context: German source · Facsimile");
      const german = line.hrefs.find((h) => h.includes("/view/german/"));
      const fragment = german?.split("#")[1];
      // The fragment names an element the German face renders, at this passage's section.
      expect(fragment).toBeDefined();
      expect(ids.has(fragment ?? "")).toBe(true);
      expect(fragment?.startsWith(sectionOf.get(line.id) ?? "?")).toBe(true);
      expect(
        line.hrefs.some((h) => h.includes("/view/english/") || h.includes("/view/gloss/")),
      ).toBe(false);
      // "Read the original" goes where the German link goes, not to #<argument id>.
      expect(line.original).toBe(german ?? "");
    }
    // The introduction has no heading block, so it opens at its first paragraph.
    const intro = lines.find((l) => sectionOf.get(l.id) === "s0");
    expect(intro?.hrefs[0]).toBe("/papers/light-quanta/view/german/#s0-p1");
  });

  test("special-relativity has no German: its lines offer the facsimile alone", async () => {
    const lines = await contextLines("special-relativity");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text).toBe("Source context: Facsimile");
      // No German draft, so there is no id to aim at and the link opens the face itself.
      expect(line.hrefs).toEqual(["/papers/special-relativity/view/facsimile/"]);
      // No German text, so no "Read the original" leading to a "not yet available" page.
      expect(line.original).toBe(null);
    }
  });
});
