/**
 * A printed paragraph that no passage explains yet says so on the German face, claims no passage,
 * and is listed under none; and a paper printed with sections labels its paragraphs by part
 * (content/bindings, am-bind-paragraphs-and-displays-bm-gzg2). Checked on every paper that has a
 * bindings file, with non-vacuity asserted on the declared set. The German face is PaperPage for
 * every paper, so the note and the absence of a link are checked on all of them; the explanation
 * page is PaperPage for every paper but Brownian, so only those are checked for listings there.
 *
 * The note needs the paragraph on the German face. Relativity is bound before its German text is on
 * the site (am-bind-paragraphs-and-displays-sr-nlea), so a declared paragraph there has no place to
 * carry it yet; it must still link to no passage and be listed under none. So that this cannot
 * excuse every paper at once, some declared paragraph must be on a German face and carry the note.
 * Brownian counts toward that: when light quanta became fully bound, the papers on PaperPage had no
 * declared paragraph left on a German face, and the guard went red on an empty population.
 *
 * Not taken: excusing the note only where the ledger lacks the paragraph's printed page
 * (ledgerGaps.ts). Relativity's two declared units, s1-fn1 on p. 893 and s5-p8 on p. 907, are on
 * pages its ledger has drafted, yet its German face publishes none of its anchors, so that check
 * would demand notes the face has nowhere to show. It fits once relativity's German face renders its
 * drafted pages.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

const withBindings = readdirSync(join(process.cwd(), "content", "bindings"))
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.replace(/\.yaml$/, ""))
  .sort();
// Brownian's explanation page is PaperReader; brownianSourceParagraphs.test.tsx covers it.
const papers = withBindings.filter((p) => p !== "brownian-motion");

// Each paper's German face, rendered once. A paragraph is on it when the face publishes its anchor.
const germanOf = new Map<string, string>();
for (const paper of withBindings)
  germanOf.set(
    paper,
    renderToStaticMarkup(await PaperPage({ paperId: paper, face: "german" } as never)),
  );
const onFace = (paper: string, unit: string) =>
  (germanOf.get(paper) ?? "").includes(` id="${unit}"`);

describe("declared paragraphs and part labels", () => {
  test("some paper with a bindings file declares a paragraph unexplained, so the check examines something", () => {
    const declared = withBindings.flatMap((p) =>
      (loadParagraphBindings(process.cwd(), p) ?? [])
        .filter((b) => b.unexplained)
        .map((b) => ({ paper: p, unit: b.unit })),
    );
    const shown = declared.filter((d) => onFace(d.paper, d.unit));
    console.log(
      `[declared paragraphs] ${declared.length} across ${withBindings.join(", ")}, ${shown.length} of them on a German face`,
    );
    expect(declared.length).toBeGreaterThan(0);
    expect(shown.length).toBeGreaterThan(0);
  });

  for (const paper of withBindings) {
    const onPaperPage = papers.includes(paper);
    test(`${paper}: each declared paragraph says so on the German face${onPaperPage ? " and is listed under no passage" : ""}`, async () => {
      const bindings = loadParagraphBindings(process.cwd(), paper) ?? [];
      const german = germanOf.get(paper) ?? "";
      const explanation = onPaperPage
        ? await exportMarkup(await PaperPage({ paperId: paper } as never))
        : "";
      const wrong: string[] = [];
      for (const b of bindings) {
        const note = german.includes(`data-not-explained="${b.unit}"`);
        const linked = german.includes(`data-explained-by="${b.unit}"`);
        const listed = explanation.includes(`data-source-paragraph="${b.unit}"`);
        // Without its German text on the site, a paragraph has no place for the note.
        const needsNote = onFace(paper, b.unit);
        if (b.unexplained && ((needsNote && !note) || linked || listed))
          wrong.push(`${b.unit}: declared, note ${note}, linked ${linked}, listed ${listed}`);
        if (!b.unexplained && note) wrong.push(`${b.unit}: bound, yet says not yet explained`);
      }
      expect(wrong).toEqual([]);
    });
  }

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
