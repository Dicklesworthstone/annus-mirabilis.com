import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { PaperSlug } from "../../content/schemas/source.ts";
import { InlineMathText } from "../../reader/InlineMathText.tsx";
import {
  loadPaperMargins,
  MarginRecordError,
  type PaperMargins,
} from "../../reader/marginRecords.ts";
import { ArgumentLimits } from "./ArgumentLimits.tsx";
import { loadArgumentLimits, selectArgumentLimits } from "./argumentLimits.ts";

const entries = loadArgumentLimits();
const html = renderToStaticMarkup(<ArgumentLimits entries={entries} />);
const escaped = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#x27;")
    .replace(/"/g, "&quot;");

function articleFor(noteId: string): string {
  const articles = Array.from(html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g), (m) => m[0]);
  const article = articles.find((markup) => markup.includes(`data-note-id="${noteId}"`));
  if (!article) throw new Error(`No rendered argument-limit note: ${noteId}`);
  return article;
}

describe("cross-paper argument limits before JavaScript runs", () => {
  test("six full notes span all four papers in distinct native disclosures", () => {
    expect(entries.map((entry) => entry.note.id)).toEqual([
      "note-lq-b-millikan-verified-and-rejected",
      "note-bm-d-tau-and-the-ballistic-regime",
      "note-sr-f-the-equator-clock-remark",
      "note-sr-transverse-mass-depends-on-the-force-convention",
      "note-me-b-additive-constant",
      "note-me-a-formula-absent",
    ]);
    expect(new Set(entries.map((entry) => entry.paper)).size).toBe(4);
    expect(new Set(entries.map((entry) => entry.heading)).size).toBe(6);
    expect(html.match(/<details>/g)).toHaveLength(6);
    expect(html.match(/<summary>Read the note and its sources<\/summary>/g)).toHaveLength(6);
    expect(html).not.toContain("<script");
    for (const entry of entries) {
      const article = articleFor(entry.note.id);
      expect(article).toContain(renderToStaticMarkup(<InlineMathText text={entry.note.claim} />));
      expect(article).toContain(`data-note-kind="${entry.note.kind}"`);
      expect(article).toContain(`data-review-state="${entry.note.reviewState}"`);
      expect(article).toContain(`data-historical-statement="${entry.note.historicalStatement}"`);
      expect(article).toContain(escaped(entry.heading));
    }
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all citations and source passages retain their roles and context", () => {
    for (const entry of entries) {
      const article = articleFor(entry.note.id);
      expect(article).toContain(`href="/papers/${entry.paper}/#note-${entry.note.id}"`);
      expect(entry.sources).toHaveLength(entry.note.sourceSupport.length);
      for (const [index, { citation, locator, role }] of entry.sources.entries()) {
        const source = entry.note.sourceSupport[index];
        if (!source) throw new Error("A rendered citation has no note-specific source support");
        expect(role).toBe(source.role ?? citation.role);
        expect(article).toContain(`data-citation-id="${citation.id}"`);
        expect(article).toContain(`data-citation-role="${role}"`);
        expect(article).toContain(`href="${escaped(citation.url)}"`);
        expect(article).toContain(escaped(citation.title));
        if (locator) expect(article).toContain(escaped(locator));
      }
      for (const passage of entry.note.affectedIds) {
        expect(article).toContain(`href="/papers/${entry.paper}/view/english/#${passage}"`);
        const source = join(
          process.cwd(),
          "content",
          "source-blocks",
          entry.paper,
          `${passage}.yaml`,
        );
        expect(existsSync(source)).toBe(true);
      }
    }
    expect(articleFor("note-me-b-additive-constant")).toContain("Later scholarship");
    const terrestrial = entries.find(
      (entry) => entry.note.id === "note-sr-f-the-equator-clock-remark",
    );
    const hafele = terrestrial?.sources.find((source) => source.citation.id === "cit-hafele-1970");
    if (!hafele) throw new Error("The equator-clock note has no Hafele source");
    expect(hafele.citation.role).toBe("primary");
    expect(hafele.role).toBe("comparison-witness");
    const witness = articleFor("note-sr-f-the-equator-clock-remark").match(
      /<li\b[^>]*data-citation-id="cit-hafele-1970"[^>]*>[\s\S]*?<\/li>/,
    )?.[0];
    expect(witness).toContain('data-citation-role="comparison-witness"');
    expect(witness).toContain("Comparison witness.");
    expect(html).toContain("Primary source");
  });

  test("each rendered link label names only one destination", () => {
    const destinations = new Map<string, string>();
    const links = Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link[1];
      const content = link[2];
      if (!href || !content) throw new Error("A rendered link has no destination or label");
      const label = content
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const existing = destinations.get(label);
      if (existing) expect(href).toBe(existing);
      else destinations.set(label, href);
    }
  });

  test("chronological caveats and different kinds of limitation survive", () => {
    const millikan = articleFor("note-lq-b-millikan-verified-and-rejected");
    expect(millikan).toContain("Eleven years after this paper");
    expect(millikan).toContain("did not accept the picture");
    const brownian = articleFor("note-bm-d-tau-and-the-ballistic-regime");
    expect(brownian).toContain('data-limit-kind="approximation"');
    expect(brownian).toContain(escaped("Einstein's result is not corrected by this"));
    const terrestrial = articleFor("note-sr-f-the-equator-clock-remark");
    expect(terrestrial).toContain('data-limit-kind="overreach"');
    expect(terrestrial).toContain("later physics");
    expect(terrestrial).toContain("has read none of it");
    const convention = articleFor("note-sr-transverse-mass-depends-on-the-force-convention");
    expect(convention).toContain('data-limit-kind="convention"');
    expect(convention).toContain("not in disagreement about the physics");
    const dispute = articleFor("note-me-b-additive-constant");
    expect(dispute).toContain('data-limit-kind="disputed-argument"');
    expect(dispute).toContain("The site records both positions and gives no verdict");
    const scope = articleFor("note-me-a-formula-absent");
    expect(scope).toContain('data-limit-kind="historical-scope"');
    expect(scope).toContain("In 1906");
    expect(scope).toContain("In 1907");
  });

  test("a missing selected note stops the guide with its paper and note named", () => {
    const papers = new Set(entries.map((entry) => entry.paper));
    const margins = new Map<PaperSlug, PaperMargins>();
    for (const paper of papers) margins.set(paper, loadPaperMargins(paper));
    const paper = "brownian-motion";
    const original = margins.get(paper);
    if (!original) throw new Error("The Brownian margin fixture did not load");
    const missing = "note-bm-d-tau-and-the-ballistic-regime";
    margins.set(paper, {
      ...original,
      notes: original.notes.filter((note) => note.id !== missing),
    });
    let refusal: MarginRecordError | undefined;
    try {
      selectArgumentLimits(margins);
    } catch (error) {
      if (!(error instanceof MarginRecordError)) throw error;
      refusal = error;
    }
    if (!refusal) throw new Error("The guide silently omitted its missing Brownian note");
    expect(refusal.code).toBe("argument-limit-note-missing");
    expect(refusal.message).toContain(paper);
    expect(refusal.message).toContain(missing);
  });

  test("a missing selected citation stops the guide with its note and citation named", () => {
    const papers = new Set(entries.map((entry) => entry.paper));
    const margins = new Map<PaperSlug, PaperMargins>();
    for (const paper of papers) margins.set(paper, loadPaperMargins(paper));
    const paper = "light-quanta";
    const original = margins.get(paper);
    if (!original) throw new Error("The light-quanta margin fixture did not load");
    const noteId = "note-lq-b-millikan-verified-and-rejected";
    const missing = "cit-millikan-1916";
    const note = original.notes.find((candidate) => candidate.id === noteId);
    if (!note?.sourceSupport.some((source) => source.citationId === missing))
      throw new Error("The selected Millikan note does not cite the intended missing source");
    const citations = new Map(original.citations);
    if (!citations.delete(missing)) throw new Error("The Millikan citation fixture did not load");
    margins.set(paper, { ...original, citations });
    expect(citations.size).toBe(original.citations.size - 1);
    let refusal: MarginRecordError | undefined;
    try {
      selectArgumentLimits(margins);
    } catch (error) {
      if (!(error instanceof MarginRecordError)) throw error;
      refusal = error;
    }
    if (!refusal) throw new Error("The guide silently omitted its missing Millikan citation");
    expect(refusal.code).toBe("argument-limit-citation-missing");
    expect(refusal.message).toContain(noteId);
    expect(refusal.message).toContain(missing);
  });
});
