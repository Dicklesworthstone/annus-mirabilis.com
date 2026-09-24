/**
 * REQUIREMENT 3 AT THE ROUTE: a draft German face cannot be served without its notice.
 *
 * am-dl4n criterion 2. The component-level guard lives in SourceFaceNotice.test.tsx; this
 * one asserts the property where a reader actually meets it, through PaperPage, because a
 * component can be correct and never reached.
 *
 * THE HYBRID FORM MADE THIS GUARD HARDER AND THE ORCHESTRATOR CAUGHT IT. With one element
 * there was one thing to lose. With the full sentence met once and the short label
 * persisting, there are TWO, and a guard that only fails when both vanish would pass a
 * page that kept the label and lost the disclosure - which is the worse of the two
 * failures, because the label alone says "draft" without saying what kind of draft, made
 * how, reviewed by nobody.
 *
 * So each is asserted separately, and each is planted separately.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import { PaperPage } from "../PaperPage.tsx";

const DRAFT_PAPERS = ["mass-energy", "brownian-motion", "light-quanta"] as const;

async function germanMarkup(paperId: string): Promise<string> {
  return renderToStaticMarkup(await PaperPage({ paperId, face: "german" } as never));
}

describe("the German face a reader is served", () => {
  test("three drafts render real German text and no longer report absence", async () => {
    for (const paperId of DRAFT_PAPERS) {
      const html = await germanMarkup(paperId);
      expect(html).not.toContain("not yet available");
      // German, not a shell: umlauts or an eszett appear in all three papers' prose.
      expect(html).toMatch(/[äöüßÄÖÜ]/);
      // And enough of it to be the paper rather than a heading.
      expect(html.length).toBeGreaterThan(5000);
    }
  });

  test("REQUIREMENT 3a: the full disclosure is present, separately from the label", async () => {
    for (const paperId of DRAFT_PAPERS) {
      const face = loadGermanSourceFace(paperId as never);
      expect(face).not.toBeNull();
      if (!face) continue;
      const html = await germanMarkup(paperId);
      // The sentence the receipt produced, in full.
      expect(html).toContain(face.notice.body);

      // AND VISIBLE, which is a different claim. My first version asserted only that the
      // markup CONTAINED the sentence, and planting `hidden` on the aside produced ZERO
      // failures: the string was still there and no reader could see it. A substring test
      // standing in for a visibility test, in the guard written to stop exactly that.
      //
      // The enclosing element is located and checked, so a disclosure that is present in
      // the HTML and hidden from the page fails here.
      const asideAt = html.indexOf("data-source-draft-notice");
      expect(asideAt).toBeGreaterThan(-1);
      const openTagStart = html.lastIndexOf("<", asideAt);
      const openTag = html.slice(openTagStart, html.indexOf(">", asideAt) + 1);
      expect(openTag).not.toMatch(/\shidden(?=[\s=>])/);
      expect(openTag).not.toContain('aria-hidden="true"');
      expect(openTag).not.toMatch(/display:\s*none/);
      // And the sentence sits inside THAT element, not somewhere else in the document.
      const asideClose = html.indexOf("</aside>", asideAt);
      expect(asideClose).toBeGreaterThan(-1);
      expect(html.slice(asideAt, asideClose)).toContain(face.notice.body);
    }
  });

  test("REQUIREMENT 3b: the persistent label is present, separately from the disclosure", async () => {
    for (const paperId of DRAFT_PAPERS) {
      const face = loadGermanSourceFace(paperId as never);
      expect(face).not.toBeNull();
      if (!face) continue;
      const html = await germanMarkup(paperId);
      expect(html).toContain("data-source-draft-persistent");
      expect(html).toContain(face.notice.label);
    }
  });

  test("the notice precedes the first word of German, not follows it", async () => {
    // "Does not scroll away from the text it qualifies" begins with being met BEFORE it.
    // A disclosure printed under the transcript is one a reader reaches after believing
    // the text.
    const html = await germanMarkup("mass-energy");
    const noticeAt = html.indexOf("data-source-draft-notice");
    const textAt = html.indexOf("data-german-draft");
    expect(noticeAt).toBeGreaterThan(-1);
    expect(textAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeLessThan(textAt);
  });

  test("no TeX reaches a reader, and each display equation is printed once, in place", async () => {
    // Measured on the export of 14:24:47: 15 of 28 German pages served the ledger's TeX as
    // text, and every display equation twice - once above the sentence introducing it, once
    // inside it as `$$…$$`.
    for (const paperId of DRAFT_PAPERS) {
      const face = loadGermanSourceFace(paperId as never);
      expect(face).not.toBeNull();
      if (!face) continue;
      const html = await germanMarkup(paperId);
      const draft = html.slice(html.indexOf("data-german-draft"));
      // KaTeX keeps each formula's TeX in a MathML <annotation> for assistive technology. That
      // is the formula's source for a screen reader, not text on the page, so it goes first.
      const visible = draft
        .replace(/<(script|style|annotation)\b[^>]*>[\s\S]*?<\/\1>/g, " ")
        .replace(/<[^>]+>/g, " ");
      expect(visible).not.toContain("$");
      expect(visible).not.toMatch(/\\[a-zA-Z]+/);

      // Not vacuous: the two absences above mean something only because formulas are there.
      // One typeset display per equation block, and each equation's id on exactly one element,
      // so an anchor to it lands on the formula and nowhere else.
      const equationIds = face.blocks.filter((b) => b.kind === "equation").map((b) => b.id);
      expect(equationIds.length).toBeGreaterThan(0);
      expect(draft.match(/class="katex-display"/g)?.length).toBe(equationIds.length);
      for (const id of equationIds) {
        // Published under its frozen manifest id (manifestAnchors.ts), not its segment id.
        const anchor = face.anchors.anchorOf[id] ?? id;
        expect(html.split(`id="${anchor}"`).length - 1).toBe(1);
      }
    }
  });

  test("a paper with no ledger still reports absence honestly", async () => {
    // The control. Without it every assertion above is satisfied by a page that renders
    // a draft notice over any paper at all, including the three that have no transcript.
    const html = await germanMarkup("special-relativity");
    expect(html).toContain("not yet available");
    expect(html).not.toContain("Machine draft, not reviewed");
  });

  test("no scan-page furniture reaches the served page", async () => {
    // Matched by grammar, not by the status word: am-wisq changed REVIEWED to MACHINE
    // DRAFT during this work, and a check keyed on either spelling would go blind exactly
    // when the leak it guards against became possible.
    const grammar = /---\s*[A-Z][A-Z \t]*TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/;
    for (const paperId of DRAFT_PAPERS) {
      const html = await germanMarkup(paperId);
      expect(grammar.test(html)).toBe(false);
      expect(html).not.toContain("[[ANNALEN-PAGE");
    }
  });
});
