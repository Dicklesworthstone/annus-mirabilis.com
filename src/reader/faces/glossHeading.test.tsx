/**
 * A glossed heading prints its gloss under the heading element; an unglossed one prints none
 * (dispatch 221).
 *
 * The gloss face rendered a gloss unit only for a masthead or a closing block. A heading stayed
 * the plain source heading, so light quanta's § 1 heading unit, "Über eine die Theorie der
 * „schwarzen Strahlung“ betreffende Schwierigkeit", rendered nowhere. The heading keeps its own
 * <h2> (or a part heading its <h1>) for the outline and the anchor, and the gloss sentence follows
 * it without an id of its own.
 *
 * Each case uses a paper's live edition and adds one synthetic unit for a heading, built from the
 * heading's own word stream, so the units cannot drift from the German and the test does not depend
 * on which headings have real gloss units.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { GlossUnit } from "../../content/schemas/source.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { PaperPage } from "../PaperPage.tsx";
import { type BilingualEdition, loadBilingualEdition } from "./bilingualLoader.ts";
import { glossStream, sentenceAtoms } from "./glossStream.ts";

const marker = (german: string) => `gloss-of-${german}`;

/** The edition with one synthetic gloss unit for the heading block `headingId`. */
async function withHeadingGloss(
  paper: string,
  headingId: string,
): Promise<{ edition: BilingualEdition; words: readonly string[] }> {
  const live = await loadBilingualEdition(paper);
  if (!live) throw new Error(`no edition for ${paper}`);
  const block = live.blocks.find((b) => b.id === headingId);
  const span = block?.sentenceSpans?.[0];
  if (!block || !span) throw new Error(`${paper}: no block ${headingId}`);
  const text = block.diplomaticText.slice(span.span.start, span.span.end);
  const { words } = glossStream(text, sentenceAtoms(block.inlines, span.span));
  const unit: GlossUnit = {
    sentenceId: span.id,
    revision: 1,
    sourceRevision: block.revision,
    sourceTextDigest: spanTextDigest(text),
    lang: "en",
    sourceLang: "de",
    attribution: { id: "agent:test", name: "test", kind: "model", modelId: "test" },
    reviewState: "machine-draft",
    tokens: words.map((german) => ({ german, english: marker(german) })),
    multiwordUnits: [],
  } as unknown as GlossUnit;
  const others = (live.glossUnits ?? []).filter((u) => u.sentenceId !== span.id);
  return { edition: { ...live, glossUnits: [...others, unit] }, words };
}

/** A section's gloss page: the gloss prints one section per page (dispatch 254). */
async function glossFace(
  paper: string,
  edition: BilingualEdition,
  section: string,
): Promise<string> {
  return renderToStaticMarkup(
    await PaperPage({ paperId: paper, face: "gloss", section }, { edition }),
  );
}

/** Every id on the page that occurs more than once. */
function duplicateIds(html: string): string[] {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] as string);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

/** Where the heading element with this id opens and closes, and the gloss section after it. */
function around(html: string, tag: "h1" | "h2", id: string) {
  const open = html.search(new RegExp(`<${tag}\\b[^>]*\\bid="${id}"`));
  const close = open >= 0 ? html.indexOf(`</${tag}>`, open) : -1;
  const section = html.search(new RegExp(`<section\\b[^>]*\\bdata-sentence-id="${id}"`));
  return { open, close, section };
}

describe("a heading's gloss on the gloss face", () => {
  test("light quanta § 1: the heading keeps its <h2>, and its gloss follows it, before the first paragraph", async () => {
    const { edition, words } = await withHeadingGloss("light-quanta", "s1");
    expect(words.length).toBeGreaterThan(0);
    const html = await glossFace("light-quanta", edition, "s1");
    const at = around(html, "h2", "s1");
    expect(at.open).toBeGreaterThan(-1);
    // The gloss sentence is after the heading element and before § 1's first sentence.
    expect(at.section).toBeGreaterThan(at.close);
    const next = html.search(/\bdata-sentence-id="s1-p1-s1"/);
    expect(next).toBeGreaterThan(at.section);
    const section = html.slice(at.section, next);
    // Printed from the German line, with every word's gloss under it.
    expect(section).toContain('data-gloss-stream="printed"');
    for (const w of words) expect(section).toContain(marker(w));
    // The heading's id is not repeated by its gloss, and nothing else on the page repeats one.
    expect(duplicateIds(html)).toEqual([]);
  });

  test("relativity part-1: a part heading keeps its <h1>, and its gloss follows it", async () => {
    const { edition, words } = await withHeadingGloss("special-relativity", "part-1");
    expect(words.length).toBeGreaterThan(0);
    // A part heading is printed with the section it heads (glossSections.ts): part-1 with § 1.
    const html = await glossFace("special-relativity", edition, "s1");
    const at = around(html, "h1", "part-1");
    expect(at.open).toBeGreaterThan(-1);
    expect(at.section).toBeGreaterThan(at.close);
    const section = html.slice(at.section, html.indexOf("</section>", at.section));
    expect(section).toContain('data-gloss-stream="printed"');
    for (const w of words) expect(section).toContain(marker(w));
    expect(duplicateIds(html)).toEqual([]);
  });

  test("an unglossed heading prints only its heading: no gloss sentence and no fallback link", async () => {
    // Light quanta's § 2 heading, with any unit it has removed, so the case stays unglossed however
    // much of the paper is glossed later. It named the live § 2 heading as unglossed until § 2's
    // own heading was glossed (dispatch 221), which is the brittleness this avoids.
    const { edition: withS1 } = await withHeadingGloss("light-quanta", "s1");
    const edition = {
      ...withS1,
      glossUnits: (withS1.glossUnits ?? []).filter((u) => u.sentenceId !== "s2"),
    };
    expect(edition.glossUnits.some((u) => u.sentenceId === "s2")).toBe(false);
    const html = await glossFace("light-quanta", edition, "s2");
    const at = around(html, "h2", "s2");
    expect(at.open).toBeGreaterThan(-1);
    expect(at.section).toBe(-1);
    const next = html.indexOf("data-block-id", at.close);
    const between = html.slice(at.close, next);
    expect(between).not.toContain("gloss-sentence");
    expect(between).not.toContain('data-parallel-fallback="true"');
  });
});
