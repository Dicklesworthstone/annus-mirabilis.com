/**
 * From each printed paragraph of light-quanta to its explanation and back, in the static HTML (no
 * JavaScript), as sourceParagraphLinks.test.tsx does for mass-energy
 * (am-bind-paragraphs-and-displays-lq-4dh2, content/bindings/light-quanta.yaml). The German face
 * publishes its paragraphs under the frozen manifest ids through its anchor map, so a binding's unit
 * is the anchor to look for. A paragraph declared unexplained names no passage and links to none.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  checkParagraphBindings,
  loadParagraphBindings,
} from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

const PAPER = "light-quanta";
const bindings = loadParagraphBindings(process.cwd(), PAPER) ?? [];
const bound = bindings.filter((b) => b.passages.length > 0);
const unexplained = bindings.filter((b) => b.passages.length === 0);
const german = renderToStaticMarkup(await PaperPage({ paperId: PAPER, face: "german" } as never));
// The explanation page streams suspended islands, so it is exported as the build does.
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));

/** The markup from `marker` to the next printed block, as in the mass-energy test. */
function after(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at === -1) return "";
  const rest = html.slice(at + marker.length);
  const next = rest.search(/<p id="/);
  return html.slice(at, next === -1 ? undefined : at + marker.length + next);
}

describe("light-quanta: paragraph to explanation and back, without JavaScript", () => {
  test("the bindings cover the manifest, and the build's report has no problem", () => {
    const report = checkParagraphBindings(process.cwd(), PAPER);
    expect(report).not.toBeNull();
    expect(report?.problems).toEqual([]);
    // Denominators from the manifest, so an empty file cannot pass for complete.
    expect(report?.paragraphs.of).toBeGreaterThan(0);
    expect((report?.paragraphs.bound ?? 0) + (report?.paragraphs.declared ?? 0)).toBe(
      report?.paragraphs.of,
    );
    expect(report?.displays.bound).toBe(report?.displays.of);
    expect(report?.obligations.resolved).toBe(report?.obligations.of);
    expect(bound.length).toBeGreaterThan(0);
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

  test("a paragraph declared unexplained is on the German face and links to no passage", () => {
    for (const b of unexplained) {
      expect(german).toContain(`id="${b.unit}"`);
      expect(german).not.toContain(`data-explained-by="${b.unit}"`);
    }
  });

  test("each linked passage exists on the explanation page", () => {
    const passages = new Set(bound.flatMap((b) => b.passages));
    expect(passages.size).toBeGreaterThan(0);
    for (const passage of passages) expect(explanation).toContain(`id="${passage}"`);
  });

  test("every passage lists its paragraphs, each linked to an anchor the German face has", () => {
    const missing: string[] = [];
    for (const b of bound) {
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
