/**
 * Period words carry a note written for the place they occur (AGENTS.md "Term annotations and
 * gloss"): longer than 80 characters, in the site's voice, and wrapped around the printed word
 * without changing the German.
 *
 * Mass-energy's seven are on its German source blocks, so they show wherever those blocks render:
 * both columns of the parallel face today, the German face once it renders from its blocks.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperPage } from "../PaperPage.tsx";

const ROOT = process.cwd();

type Term = {
  block: string;
  text: string;
  termId: string;
  definition: unknown;
  lang: unknown;
  definitionLang: unknown;
};

function termsIn(value: unknown, block: string, out: Term[]): void {
  if (Array.isArray(value)) {
    for (const v of value) termsIn(v, block, out);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.kind === "term" && typeof o.text === "string" && typeof o.termId === "string")
      out.push({
        block,
        text: o.text,
        termId: o.termId,
        definition: o.definition,
        lang: o.lang,
        definitionLang: o.definitionLang,
      });
    for (const v of Object.values(o)) termsIn(v, block, out);
  }
}

/** Every term inline in every paper's German source blocks, with the block's printed text. */
function allTerms(): { term: Term; diplomatic: string }[] {
  const out: { term: Term; diplomatic: string }[] = [];
  const base = join(ROOT, "content/source-blocks");
  for (const paper of readdirSync(base)) {
    for (const name of readdirSync(join(base, paper)).filter((n) => n.endsWith(".yaml"))) {
      const record = load(readFileSync(join(base, paper, name), "utf8")) as Record<string, unknown>;
      if (record?.kind === "manifest" || typeof record?.id !== "string") continue;
      const found: Term[] = [];
      termsIn(record.inlines, `${paper}/${record.id}`, found);
      for (const term of found) out.push({ term, diplomatic: String(record.diplomaticText ?? "") });
    }
  }
  return out;
}

describe("period-term notes", () => {
  const terms = allTerms();

  test("mass-energy carries its seven, each on the block that prints the word", () => {
    // Identity, not census: these are the words chosen for this paper's first release.
    expect(
      terms
        .filter(({ term }) => term.block.startsWith("mass-energy/"))
        .map(({ term }) => `${term.block} ${term.text}`)
        .sort(),
    ).toEqual([
      "mass-energy/s0-p13 Energieinhalt",
      "mass-energy/s0-p15 Trägheit",
      "mass-energy/s0-p3 Parallel-Translationsbewegung",
      "mass-energy/s0-p3 Relativitätsprinzip",
      "mass-energy/s0-p5 Lichtmenge",
      "mass-energy/s0-p7 Energieprinzip",
      "mass-energy/s0-p7 Qualitäten",
    ]);
  });

  test("every note is longer than 80 characters, has no dash, and wraps a printed word", () => {
    // Non-vacuity: the loop below must have something to judge.
    expect(terms.length).toBeGreaterThan(0);
    for (const { term, diplomatic } of terms) {
      const d = typeof term.definition === "string" ? term.definition : "";
      expect({ id: term.termId, long: d.length > 80 }).toEqual({ id: term.termId, long: true });
      expect({ id: term.termId, dash: /[–—]/.test(d) }).toEqual({
        id: term.termId,
        dash: false,
      });
      expect({ id: term.termId, printed: diplomatic.includes(term.text) }).toEqual({
        id: term.termId,
        printed: true,
      });
    }
  });

  test("mass-energy's notes are English on German words, and say so for a screen reader", () => {
    for (const { term } of terms.filter(({ term }) => term.block.startsWith("mass-energy/")))
      expect({ id: term.termId, lang: term.lang, definitionLang: term.definitionLang }).toEqual({
        id: term.termId,
        lang: "de",
        definitionLang: "en",
      });
  });

  test("the parallel face shows each note on its word, as a control a reader can open", async () => {
    const html = renderToStaticMarkup(
      await PaperPage({ paperId: "mass-energy", face: "parallel" } as never),
    );
    for (const { term } of terms.filter(({ term }) => term.block.startsWith("mass-energy/"))) {
      expect(html).toMatch(
        new RegExp(`<button[^>]*data-term-id="${term.termId}"[^>]*>\\s*<abbr[^>]*>${term.text}<`),
      );
    }
  });
});
