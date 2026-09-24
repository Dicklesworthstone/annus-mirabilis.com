/**
 * From each printed paragraph of mass-energy to its explanation and back, in the static HTML (no
 * JavaScript): the German face links every bound paragraph to its passages, and every passage
 * lists the paragraphs it explains with a link to each on the German face
 * (am-bind-paragraphs-and-displays-me-u7bu, content/bindings/mass-energy.yaml).
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

const PAPER = "mass-energy";
const bindings = loadParagraphBindings(process.cwd(), PAPER) ?? [];
const german = renderToStaticMarkup(await PaperPage({ paperId: PAPER, face: "german" } as never));
// The explanation page streams suspended islands, so it is exported as the build does.
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));

/**
 * The markup from `marker` to the next printed paragraph, footnote or closing line, so a region
 * holds one block, the displays inside it, and whatever follows it before the next.
 */
function after(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at === -1) return "";
  const rest = html.slice(at + marker.length);
  // Only the next printed block element ends a region: a display inside a paragraph has its own
  // eq- anchor, and a retired id is an alias span at the start of the paragraph that absorbed it.
  const next = rest.search(/<p id="/);
  return html.slice(at, next === -1 ? undefined : at + marker.length + next);
}

describe("mass-energy: paragraph to explanation and back, without JavaScript", () => {
  test("there are bindings to follow", () => {
    expect(bindings.length).toBeGreaterThan(0);
  });

  test("every bound paragraph on the German face links to each of its passages", () => {
    const missing: string[] = [];
    for (const b of bindings) {
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

  test("each linked passage exists on the explanation page", () => {
    const passages = new Set(bindings.flatMap((b) => b.passages));
    for (const passage of passages) expect(explanation).toContain(`id="${passage}"`);
  });

  test("every passage lists its paragraphs, each linked to an anchor the German face has", () => {
    const missing: string[] = [];
    for (const b of bindings) {
      const item = `data-source-paragraph="${b.unit}"`;
      const count = explanation.split(item).length - 1;
      if (count !== b.passages.length)
        missing.push(`${b.unit}: listed in ${count} passages, bound to ${b.passages.length}`);
      if (!explanation.includes(`href="/papers/${PAPER}/view/german/#${b.unit}"`))
        missing.push(`${b.unit}: no link back to the German face`);
      if (!german.includes(`id="${b.unit}"`)) missing.push(`${b.unit}: not an anchor on the face`);
    }
    expect(missing).toEqual([]);
  });
});
