/**
 * From each printed paragraph of relativity to its explanation and back, in the static HTML (no
 * JavaScript), as sourceParagraphLinks.test.tsx does for mass-energy
 * (am-bind-paragraphs-and-displays-sr-nlea, content/bindings/special-relativity.yaml).
 *
 * Relativity is bound before its German text is on the site: the face shows a notice, so it
 * publishes none of the paper's anchors, and printed pages 913 to 921 are not in the ledger at all.
 * Every passage still lists its paragraphs with their overviews; a paragraph is linked only where
 * the face publishes its anchor, and the rest say their links wait for the text. The checks are
 * written per paragraph, so as the German text lands, the paragraphs it brings are held to the
 * links mass-energy's are held to, and the others still to the waiting note.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  checkParagraphBindings,
  loadParagraphBindings,
  type ParagraphBinding,
} from "../content/bindings/paragraphBindings.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { SourceParagraphs } from "./SourceParagraphs.tsx";

const PAPER = "special-relativity";
const bindings = loadParagraphBindings(process.cwd(), PAPER) ?? [];
const bound = bindings.filter((b) => b.passages.length > 0);
const unexplained = bindings.filter((b) => b.unexplained);
const german = renderToStaticMarkup(await PaperPage({ paperId: PAPER, face: "german" } as never));
// The explanation page streams suspended islands, so it is exported as the build does.
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));
const onFace = (unit: string) => german.includes(` id="${unit}"`);
const backLink = (unit: string) => `href="/papers/${PAPER}/view/german/#${unit}"`;
/** React's escaping of text, so an overview can be found in the markup as written. */
const escaped = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

describe("special-relativity: paragraph to explanation and back, without JavaScript", () => {
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
    console.log(
      `[relativity bindings] ${bound.length} bound, ${unexplained.length} declared, ${bindings.filter((b) => onFace(b.unit)).length} of ${bindings.length} on the German face`,
    );
  });

  test("a paragraph on the German face links to each of its passages; one not there links nowhere", () => {
    const wrong: string[] = [];
    for (const b of bound) {
      const line = german.includes(`data-explained-by="${b.unit}"`);
      if (!onFace(b.unit)) {
        if (line) wrong.push(`${b.unit}: not on the face, yet has an explained-by line`);
        continue;
      }
      for (const passage of b.passages)
        if (!german.includes(`href="/papers/${PAPER}/#${passage}"`))
          wrong.push(`${b.unit}: no link to ${passage}`);
    }
    expect(wrong).toEqual([]);
  });

  test("each passage a paragraph is bound to exists on the explanation page", () => {
    const passages = new Set(bound.flatMap((b) => b.passages));
    expect(passages.size).toBeGreaterThan(0);
    for (const passage of passages) expect(explanation).toContain(`id="${passage}"`);
  });

  test("every passage lists its paragraphs with their overviews, linked only where the face has them", () => {
    const wrong: string[] = [];
    for (const b of bound) {
      const count = explanation.split(`data-source-paragraph="${b.unit}"`).length - 1;
      if (count !== b.passages.length)
        wrong.push(`${b.unit}: listed in ${count} passages, bound to ${b.passages.length}`);
      if (!explanation.includes(escaped(b.r0))) wrong.push(`${b.unit}: its overview is not listed`);
      const linked = explanation.includes(backLink(b.unit));
      if (linked !== onFace(b.unit))
        wrong.push(`${b.unit}: linked ${linked}, on the German face ${onFace(b.unit)}`);
    }
    expect(wrong).toEqual([]);
    // A passage whose paragraphs are not on the face says their links wait for the text.
    if (bound.some((b) => !onFace(b.unit)))
      expect(explanation).toContain("is not on this site yet");
  });

  test("a paragraph declared unexplained names no passage and is listed under none", () => {
    expect(unexplained.length).toBeGreaterThan(0);
    for (const b of unexplained) {
      expect(b.passages).toEqual([]);
      expect(explanation).not.toContain(`data-source-paragraph="${b.unit}"`);
      expect(german).not.toContain(`data-explained-by="${b.unit}"`);
    }
  });
});

describe("SourceParagraphs: a link waits for the paragraph's German text", () => {
  const binding = (unit: string): ParagraphBinding => ({
    unit,
    label: unit,
    r0: `Overview of ${unit}.`,
    passages: ["arg-x"],
    unexplained: false,
  });
  const list = [binding("s1-p1"), binding("s1-p2"), binding("s10-p14")];

  test("with some anchors on the face, exactly those paragraphs are linked and the rest are counted", () => {
    const html = renderToStaticMarkup(
      <SourceParagraphs
        paperId={PAPER}
        bindings={list}
        germanAnchors={new Set(["s1-p1", "s1-p2"])}
      />,
    );
    expect(html).toContain(backLink("s1-p1"));
    expect(html).toContain(backLink("s1-p2"));
    expect(html).not.toContain(backLink("s10-p14"));
    expect(html).toContain("Overview of s10-p14.");
    expect(html).toContain('data-source-paragraphs-waiting="1"');
    expect(html).toContain("The German text of 1 of these paragraphs is not on this site yet");
  });

  test("with every anchor on the face, all are linked and nothing is said to wait", () => {
    const html = renderToStaticMarkup(
      <SourceParagraphs
        paperId={PAPER}
        bindings={list}
        germanAnchors={new Set(list.map((b) => b.unit))}
      />,
    );
    for (const b of list) expect(html).toContain(backLink(b.unit));
    expect(html).not.toContain("data-source-paragraphs-waiting");
  });

  test("with no German text, none is linked and the list says so", () => {
    const html = renderToStaticMarkup(
      <SourceParagraphs paperId={PAPER} bindings={list} germanAnchors={new Set()} />,
    );
    expect(html).not.toContain("/view/german/");
    expect(html).toContain("The German text of these paragraphs is not on this site yet");
  });
});
