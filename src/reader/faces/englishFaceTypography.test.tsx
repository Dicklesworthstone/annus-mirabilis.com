/**
 * The English face reads like the German face (dispatch 210).
 *
 * Measured on live at 1440 on 2026-09-25: the English text ran 1,256px at 19px, 186 to 200
 * characters a line, beside light quanta's German face at 666px and 22.8px; and every section
 * heading ("§ 1. On a difficulty concerning ...") was a paragraph at body size, where the German
 * face sets an <h2>. These hold the English face and the parallel face's English column to the
 * German face's structure, for the papers that print headings and part headings.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const PAPERS = ["special-relativity", "light-quanta"] as const;
const render = async (paperId: string, face: string) =>
  exportMarkup(await PaperPage({ paperId, face } as never));

/** The headings the German face prints with an id: that id and the element. */
function germanHeadings(html: string): { id: string; tag: string }[] {
  return [...html.matchAll(/<(h1|h2)\b[^>]*\bid="([^"]+)"[^>]*>/g)]
    .map((m) => ({ tag: m[1] ?? "", id: m[2] ?? "" }))
    .filter((h) => /^(s\d+|part-\d+)$/.test(h.id));
}

/** The element that encloses the element carrying `id`, by scanning back to its opening tag. */
function enclosingTag(html: string, id: string): string | null {
  const at = html.indexOf(` id="${id}"`);
  if (at === -1) return null;
  const before = html.slice(0, at);
  const open = [...before.matchAll(/<(p|h1|h2|h3|aside|div)\b[^>]*>/g)].at(-1);
  return open ? open[0] : null;
}

const pages = new Map<string, { german: string; english: string; parallel: string }>();
for (const paper of PAPERS)
  pages.set(paper, {
    german: await render(paper, "german"),
    english: await render(paper, "english"),
    parallel: await render(paper, "parallel"),
  });

describe("section and part headings are headings on the English faces", () => {
  test("the German faces print headings to compare against", () => {
    for (const paper of PAPERS) {
      const n = germanHeadings(pages.get(paper)?.german ?? "").length;
      console.log(`[german headings] ${paper}: ${n}`);
      expect(n).toBeGreaterThan(0);
    }
  });

  test("each heading the German face prints is the same heading element on the English face and in the parallel face's English column, holding its unit's id", () => {
    const wrong: string[] = [];
    for (const paper of PAPERS) {
      const p = pages.get(paper);
      if (!p) continue;
      for (const { id, tag } of germanHeadings(p.german)) {
        const cls = tag === "h1" ? "source-part-heading" : "source-heading";
        for (const [face, html, unitId] of [
          ["english", p.english, id],
          ["parallel", p.parallel, `en-${id}`],
        ] as const) {
          if (!html.includes(` id="${unitId}"`)) continue; // untranslated section
          const open = enclosingTag(html, unitId);
          if (!open?.startsWith(`<${tag}`) || !open.includes(`class="${cls}"`))
            wrong.push(
              `${paper} ${face} ${unitId}: in ${open ?? "nothing"}, not <${tag} class="${cls}">`,
            );
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("the English face reads at the reader's measure", () => {
  test("its text, banner and coverage notice sit in the reading column", () => {
    for (const paper of PAPERS) {
      const html = pages.get(paper)?.english ?? "";
      // A div, not a <main>: the root layout renders the page's one <main id="main">, and a second
      // one nested in it is a second main landmark. The no-JavaScript candidate check cut the German
      // face at the inner </main> and lost its footnotes (deploy of b1d0037a).
      expect(html).toMatch(
        /<div class="translation-units-list reading-column" data-translation-body/,
      );
      expect(html).not.toMatch(/<main\b/);
      const banner = html.indexOf("unreviewed-translation-banner");
      if (banner !== -1) {
        const open = [...html.slice(0, banner).matchAll(/<div\b[^>]*>/g)].map((m) => m[0]);
        expect(open.some((d) => d.includes('class="reading-column"'))).toBe(true);
      }
    }
  });
});
