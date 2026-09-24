/**
 * A printed paragraph that no passage explains yet says so on the German face, claims no passage,
 * and is listed under none; and a paper printed with sections labels its paragraphs by part
 * (content/bindings, am-bind-paragraphs-and-displays-bm-gzg2). Checked on every paper that has a
 * bindings file whose explanation page is PaperPage, with non-vacuity asserted on the declared set.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

const papers = readdirSync(join(process.cwd(), "content", "bindings"))
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.replace(/\.yaml$/, ""))
  // Brownian's explanation page is PaperReader; brownianSourceParagraphs.test.tsx covers it.
  .filter((p) => p !== "brownian-motion")
  .sort();

describe("declared paragraphs and part labels", () => {
  test("some paper with a bindings file declares a paragraph unexplained, so the check examines something", () => {
    const declared = papers.flatMap((p) =>
      (loadParagraphBindings(process.cwd(), p) ?? []).filter((b) => b.unexplained),
    );
    console.log(`[declared paragraphs] ${declared.length} across ${papers.join(", ")}`);
    expect(declared.length).toBeGreaterThan(0);
  });

  for (const paper of papers)
    test(`${paper}: each declared paragraph says so on the German face and is listed under no passage`, async () => {
      const bindings = loadParagraphBindings(process.cwd(), paper) ?? [];
      const german = renderToStaticMarkup(
        await PaperPage({ paperId: paper, face: "german" } as never),
      );
      const explanation = await exportMarkup(await PaperPage({ paperId: paper } as never));
      const wrong: string[] = [];
      for (const b of bindings) {
        const note = german.includes(`data-not-explained="${b.unit}"`);
        const linked = german.includes(`data-explained-by="${b.unit}"`);
        const listed = explanation.includes(`data-source-paragraph="${b.unit}"`);
        if (b.unexplained && (!note || linked || listed))
          wrong.push(`${b.unit}: declared, note ${note}, linked ${linked}, listed ${listed}`);
        if (!b.unexplained && note) wrong.push(`${b.unit}: bound, yet says not yet explained`);
      }
      expect(wrong).toEqual([]);
    });

  for (const paper of papers)
    test(`${paper}: labels count within each printed part when the paper has parts`, () => {
      const bindings = loadParagraphBindings(process.cwd(), paper) ?? [];
      const part = (unit: string) => /^(s\d+)-/.exec(unit)?.[1] ?? "s0";
      const sectioned = bindings.some((b) => part(b.unit) !== "s0");
      const counts = new Map<string, number>();
      for (const b of bindings) {
        const kind = /-fn\d+$/.test(b.unit) ? "footnote" : "paragraph";
        const key = `${sectioned ? part(b.unit) : ""}:${kind}`;
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        const where = part(b.unit) === "s0" ? "Introduction" : `§${part(b.unit).slice(1)}`;
        const expected = sectioned
          ? `${where}, ${kind} ${n}`
          : `${kind === "footnote" ? "Footnote" : "Paragraph"} ${n}`;
        expect([b.unit, b.label]).toEqual([b.unit, expected]);
      }
    });
});
