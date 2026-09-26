/**
 * The German face a reader is served, through PaperPage, because a component can be correct and
 * never reached.
 *
 * Until 2026-09-25 this was am-dl4n's requirement 3: a draft German face could not be served
 * without its notice, label and sentence asserted separately. D-2026-09-25-no-review-status-banners
 * withdrew the notice, so the same two parts are now each asserted absent.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { missingGermanSections } from "./editionCoverage.ts";

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

  // am-dl4n's requirement 3 put a "Machine draft, not reviewed" label and its sentence before the
  // German. The owner withdrew it (D-2026-09-25-no-review-status-banners): "we don't need messages
  // like this on the site". So the rule is now the other way round, at the route, where a reader
  // meets it: the receipt still yields the notice, and no German face renders any of it.
  test("no draft notice reaches a reader: neither the label nor its sentence, on any German face", async () => {
    for (const paperId of DRAFT_PAPERS) {
      const face = loadGermanSourceFace(paperId as never);
      expect(face).not.toBeNull();
      if (!face) continue;
      // Non-vacuity: the receipt still describes a draft, so the absence below is the rule.
      expect(face.notice.state).toBe("machine-draft");
      expect(face.notice.body.length).toBeGreaterThan(0);
      const html = await germanMarkup(paperId);
      expect(html).not.toContain("data-source-draft-notice");
      expect(html).not.toContain("data-source-draft-persistent");
      expect(html).not.toContain(face.notice.label);
      expect(html).not.toContain(face.notice.body);
      // The German text is what the column opens with: since dispatch 255 the source blocks'
      // (GermanFace), where it was the ledger draft's.
      expect(html.indexOf("data-source-body")).toBeGreaterThan(-1);
    }
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
      // The German text: since dispatch 255 the source blocks' (GermanFace), not the draft's.
      const draft = html.slice(html.indexOf("data-source-body"));
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
      const edition = await loadBilingualEdition(paperId);
      const equationIds = (edition?.blocks ?? [])
        .filter((b) => b.kind === "equation")
        .map((b) => b.id);
      expect(equationIds.length).toBeGreaterThan(0);
      expect(draft.match(/class="katex-display"/g)?.length).toBe(equationIds.length);
      for (const id of equationIds) {
        // Published under its frozen manifest id, which the source blocks carry. The id attribute
        // itself: the same string also stands inside data-block-id="…" and data-equation-id="…".
        expect(html.match(new RegExp(`(?<![-\\w])id="${id}"`, "g"))?.length).toBe(1);
      }
    }
  });

  test("the paper with no ledger draft is honest either way: absence, or its German unlabelled", async () => {
    // Special relativity has no ledger draft face: its German face renders the edition's blocks
    // (PaperPage, GermanFace). With no blocks it reports absence; with some, it never reports
    // absence over German it has, names the sections it lacks, and carries no draft label.
    const edition = await loadBilingualEdition("special-relativity");
    const blocks = edition?.blocks ?? [];
    const html = await germanMarkup("special-relativity");
    if (blocks.length === 0) {
      expect(html).toContain("not yet available");
      expect(html).not.toContain("Machine draft, not reviewed");
      return;
    }
    expect(html).not.toContain("not yet available");
    expect(html).not.toContain("Machine draft, not reviewed");
    expect(html).not.toContain("data-source-draft-notice");
    const missing = missingGermanSections(edition?.paper.sections.map((s) => s.id) ?? [], blocks);
    if (missing.length > 0) expect(html).toContain(`data-missing-sections="${missing.join(" ")}"`);
    else expect(html).not.toContain("data-missing-sections=");
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
