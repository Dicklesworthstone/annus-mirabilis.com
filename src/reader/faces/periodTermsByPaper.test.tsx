/**
 * Period words for light quanta, Brownian motion and relativity (dispatch 258), marked as term
 * inlines on the German source blocks as mass-energy's are (periodTerms.test.tsx). Each paper's
 * words are named by block and printed word: identity, not census.
 *
 * For every term inline in these papers:
 * - the edition contract's term check (validateTerms, alignment.ts C.5) accepts it, and the same
 *   occurrence with a 60-character definition is refused as too short;
 * - wrapping the word left the German unchanged: the block's inlines still read as its
 *   diplomaticText, and still hash to the digest its sentence spans recorded before the wrapping;
 * - the parallel face prints the word as text, which readers without JavaScript keep. The German
 *   face of these three papers still renders the ledger draft, which has no inlines; it will show
 *   the words once it renders from the source blocks (dispatch 255, step 0), and joins this list.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import { type TermOccurrence, validateTerms } from "../../content/editions/alignment.ts";
import { plainText, validateInline } from "../../content/schemas/inlines.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { PaperPage } from "../PaperPage.tsx";

const PAPERS: Record<string, readonly string[]> = {
  "light-quanta": [
    "s0-p1 Undulationstheorie",
    "s0-p1 ponderable",
    "s0-p3 Energiequanten",
    "s0-p3 schwarze Strahlung",
    "s1-p1 Resonatoren",
    "s2-p1 Elementarquanta",
    "s7-p1 Photolumineszenz",
    "s8-p2 Kathodenstrahlen",
  ],
  "brownian-motion": [
    "s0-p1 Molekularbewegung",
    "s0-p1 molekularkinetischen Theorie der Wärme",
    "s1-p1 Gramm-Moleküle",
    "s1-p2 freie Energie",
    "s2-p2 semipermeabele Wand",
    "s3-p6 Reibungskoeffizienten",
    "s4-p4 Häufigkeitsgesetz",
  ],
};

type Block = {
  id: string;
  diplomaticText: string;
  inlines: unknown[];
  sentenceSpans: { span: { textDigest: string } }[];
};
type Term = TermOccurrence & { block: Block };

function termsIn(value: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) for (const v of value) termsIn(v, out);
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.kind === "term") out.push(o);
    for (const v of Object.values(o)) termsIn(v, out);
  }
}

function termsOf(paper: string): Term[] {
  const dir = join(process.cwd(), "content/source-blocks", paper);
  const out: Term[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".yaml"))) {
    const block = load(readFileSync(join(dir, name), "utf8")) as Block;
    if (typeof block?.id !== "string" || !Array.isArray(block.inlines)) continue;
    const found: Record<string, unknown>[] = [];
    termsIn(block.inlines, found);
    for (const t of found)
      out.push({
        id: `${paper}/${block.id}`,
        termId: String(t.termId),
        termText: String(t.text),
        definition: typeof t.definition === "string" ? t.definition : "",
        termLang: t.lang as string | undefined,
        definitionLang: t.definitionLang as string | undefined,
        isOccurrenceSpecific: true,
        block,
      });
  }
  return out;
}

// A plausible note, and exactly 60 characters: the length the contract must refuse.
const SHORT = "Energy quanta: light made of parts that move but never split";

for (const [paper, named] of Object.entries(PAPERS)) {
  describe(`${paper}: period words`, () => {
    const terms = termsOf(paper);

    test("the words chosen for this paper are on the blocks that print them", () => {
      expect(terms.map((t) => `${t.block.id} ${t.termText}`).sort()).toEqual([...named].sort());
    });

    test("the term check accepts every note, and refuses one of 60 characters", () => {
      expect(terms.length).toBeGreaterThan(0);
      expect(validateTerms(terms)).toEqual([]);
      expect(SHORT.length).toBe(60);
      const planted = validateTerms([{ ...(terms[0] as Term), definition: SHORT }]);
      expect(planted.map((issue) => issue.code)).toEqual(["term-definition-too-short"]);
    });

    test("wrapping a word changed no byte of the German", () => {
      for (const { block } of terms) {
        const text = plainText(block.inlines.map((inline) => validateInline(inline)));
        expect({ block: block.id, same: text === block.diplomaticText }).toEqual({
          block: block.id,
          same: true,
        });
        // The digest was recorded when the block was drafted, before any word was wrapped.
        for (const { span } of block.sentenceSpans)
          expect({ block: block.id, digest: span.textDigest }).toEqual({
            block: block.id,
            digest: spanTextDigest(text),
          });
      }
    });

    test("the parallel face prints each word as text for no-script readers", async () => {
      for (const face of ["parallel"]) {
        const html = renderToStaticMarkup(await PaperPage({ paperId: paper, face } as never));
        for (const t of terms) {
          expect({
            face,
            termId: t.termId,
            printed: html.includes(`>${t.termText}</span>`),
          }).toEqual({ face, termId: t.termId, printed: true });
          expect(html).toMatch(
            new RegExp(`<span[^>]*data-term-text="${t.termId}"[^>]*>${t.termText}</span>`),
          );
          expect(html).not.toMatch(new RegExp(`<button[^>]*data-term-id="${t.termId}"`));
        }
      }
    });
  });
}
