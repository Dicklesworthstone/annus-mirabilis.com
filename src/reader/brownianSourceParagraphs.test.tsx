/**
 * From each printed paragraph of the Brownian paper to its explanation and back, in the static HTML
 * (no JavaScript), and a plain statement where no passage explains a paragraph yet
 * (am-bind-paragraphs-and-displays-bm-gzg2, content/bindings/brownian-motion.yaml).
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";

const PAPER = "brownian-motion";
const bindings = loadParagraphBindings(process.cwd(), PAPER) ?? [];
const bound = bindings.filter((b) => !b.unexplained);
const declared = bindings.filter((b) => b.unexplained);
const german = renderToStaticMarkup(await PaperPage({ paperId: PAPER, face: "german" } as never));
// The explanation page streams suspended islands, so it is exported as the build does.
const explanation = await exportMarkup(await PaperReader({}));

/** The markup from `marker` to the next printed paragraph, footnote or closing line. */
function after(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at === -1) return "";
  const rest = html.slice(at + marker.length);
  const next = rest.search(/<p id="/);
  return html.slice(at, next === -1 ? undefined : at + marker.length + next);
}

describe("brownian-motion: paragraph to explanation and back, without JavaScript", () => {
  test("there are bound paragraphs, so the checks below examine something", () => {
    // The declared set empties as passages are written, so it is reported, not required; the note
    // it would carry is witnessed on a real German face in declaredParagraphs.test.tsx.
    console.log(`[brownian paragraphs] ${bound.length} bound, ${declared.length} declared`);
    expect(bound.length).toBeGreaterThan(0);
    expect(bound.length + declared.length).toBe(bindings.length);
  });

  test("every bound paragraph on the German face links to each of its passages", () => {
    const missing: string[] = [];
    for (const b of bound) {
      const region = after(german, `id="${b.unit}"`);
      if (region === "") {
        missing.push(`${b.unit}: no such anchor on the German face`);
        continue;
      }
      const line = after(region, `data-explained-by="${b.unit}"`);
      for (const passage of b.passages)
        if (!line.includes(`href="/papers/${PAPER}/#${passage}"`))
          missing.push(`${b.unit}: no link to ${passage}`);
    }
    expect(missing).toEqual([]);
  });

  test("every declared paragraph says it is not yet explained, and claims no passage", () => {
    const wrong: string[] = [];
    for (const b of declared) {
      const region = after(german, `id="${b.unit}"`);
      if (region === "") wrong.push(`${b.unit}: no such anchor on the German face`);
      else if (!region.includes(`data-not-explained="${b.unit}"`))
        wrong.push(`${b.unit}: no "not yet explained" note`);
      if (german.includes(`data-explained-by="${b.unit}"`))
        wrong.push(`${b.unit}: declared unexplained but links to a passage`);
      if (explanation.includes(`data-source-paragraph="${b.unit}"`))
        wrong.push(`${b.unit}: declared unexplained but listed under a passage`);
    }
    expect(wrong).toEqual([]);
  });

  test("each passage lists the paragraphs bound to it, each linked to an anchor the German face has", () => {
    const missing: string[] = [];
    for (const b of bound) {
      const item = `data-source-paragraph="${b.unit}"`;
      const count = explanation.split(item).length - 1;
      if (count !== b.passages.length)
        missing.push(`${b.unit}: listed in ${count} passages, bound to ${b.passages.length}`);
      if (!explanation.includes(`href="/papers/${PAPER}/view/german/#${b.unit}"`))
        missing.push(`${b.unit}: no link back to the German face`);
      for (const passage of b.passages)
        if (!explanation.includes(`id="${passage}"`))
          missing.push(`${b.unit}: passage ${passage} is not on the explanation page`);
    }
    expect(missing).toEqual([]);
  });

  test("a paper with sections labels a paragraph by its part, counted in printed order", () => {
    // s4-p9 is the seventh printed paragraph of §4 (p. 558, "Dies ist die bekannte ..."): the
    // manifest's ids skip numbers, so the label counts paragraphs, not ids.
    expect(bindings.find((b) => b.unit === "s4-p9")?.label).toBe("§4, paragraph 7");
    expect(bindings.find((b) => b.unit === "s0-p2")?.label).toBe("Introduction, paragraph 2");
    expect(bindings.find((b) => b.unit === "s2-fn2")?.label).toBe("§2, footnote 2");
    const listed = after(explanation, 'data-source-paragraph="s4-p9"');
    expect(listed).toContain("§4, paragraph 7");
  });
});
