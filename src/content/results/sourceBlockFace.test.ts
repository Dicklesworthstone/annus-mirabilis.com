/**
 * The German face result cards read for a paper with no ledger draft (dispatch 241). Relativity's
 * receipt says ledgerStatus: not-started, so loadGermanSourceFace is null and its German face is
 * rendered from its source blocks; the cards read the same blocks through sourceBlockFace.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGermanSourceFace } from "../editions/germanSourceFace.ts";
import { parseYaml } from "../provenance/yaml.ts";
import type { Inline } from "../schemas/inlines.ts";
import { resultContext } from "./resultCards.ts";
import { inlinesMarkup, markupPlainText, sourceBlockFace } from "./sourceBlockFace.ts";

const ROOT = process.cwd();
const PAPER = "special-relativity";

describe("a face read from source blocks", () => {
  test("relativity has no ledger face, so its cards need this one", () => {
    expect(loadGermanSourceFace(PAPER)).toBeNull();
    const context = resultContext(ROOT, PAPER);
    expect(context).not.toBeNull();
    expect(context?.face.blocks.length).toBeGreaterThan(0);
  });

  test("every sentence's markup stands for exactly the block's diplomatic text over its span", () => {
    const face = sourceBlockFace(ROOT, PAPER);
    if (!face) throw new Error("relativity's source blocks did not load");
    const dir = join(ROOT, "content", "source-blocks", PAPER);
    let sentences = 0;
    const wrong: string[] = [];
    for (const name of readdirSync(dir).filter(
      (n) => /\.ya?ml$/.test(n) && !n.startsWith("manifest"),
    )) {
      const record = parseYaml(readFileSync(join(dir, name), "utf8")) as {
        id?: string;
        diplomaticText?: string;
        sentenceSpans?: { id: string; span: { start: number; end: number } }[];
      } | null;
      if (!record?.id || !record.sentenceSpans) continue;
      const block = face.blocks.find((b) => b.id === record.id);
      for (const [k, s] of record.sentenceSpans.entries()) {
        sentences++;
        const expected = (record.diplomaticText ?? "").slice(s.span.start, s.span.end);
        const got = block?.sentences?.[k];
        if (got?.id !== s.id || markupPlainText(got.text) !== expected) wrong.push(s.id);
      }
    }
    // Non-vacuity, not a census: with no spans read, the loop would compare nothing and pass.
    expect(sentences).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  test("each kind of ledger markup occurs, so the equality above covered all of them", () => {
    const face = sourceBlockFace(ROOT, PAPER);
    const all = (face?.blocks ?? []).flatMap((b) => (b.sentences ?? []).map((s) => s.text));
    expect(all.filter((t) => /\$[^$]+\$/.test(t)).length).toBeGreaterThan(0);
    expect(all.filter((t) => t.includes("[[FN-MARK ")).length).toBeGreaterThan(0);
    expect(all.filter((t) => t.includes("[[SPERR]]")).length).toBeGreaterThan(0);
  });

  test("a display is its diplomatic LaTeX, and its page is the block's first printed page", () => {
    const face = sourceBlockFace(ROOT, PAPER);
    const beta = face?.blocks.find((b) => b.id === "eq-s6-d3");
    expect(beta?.kind).toBe("equation");
    expect(beta?.text).toContain("\\beta = \\frac{1}{\\sqrt{1 - \\left( \\frac{v}{V} \\right)^2}}");
    expect(face?.printedPages.pages["eq-s6-d3"]).toBe(908);
    expect(face?.anchors.anchorOf["s6-p2"]).toBe("s6-p2");
  });

  test("a paper with a ledger face keeps it", () => {
    const context = resultContext(ROOT, "mass-energy");
    // Only the ledger face carries its receipt's notice.
    expect(context && "notice" in context.face).toBe(true);
  });
});

describe("inlinesMarkup", () => {
  const inlines: Inline[] = [
    { kind: "text", text: "Es sei " },
    { kind: "math", latex: "v" },
    { kind: "text", text: " die Geschwindigkeit." },
    { kind: "footnote-mark", mark: "1)", footnoteId: "s1-fn1" },
    { kind: "space" },
    { kind: "math", latex: "x", display: true, equationId: "eq-x" },
    { kind: "emphasis", inlines: [{ kind: "text", text: "Zweiter" }] },
    { kind: "text", text: " Satz." },
  ];

  test("the whole block, and a sentence cut at its span", () => {
    expect(inlinesMarkup(inlines)).toBe(
      "Es sei $v$ die Geschwindigkeit.[[FN-MARK 1)]] [[SPERR]]Zweiter[[/SPERR]] Satz.",
    );
    // "Es sei v die Geschwindigkeit.1)" is 31 characters; the second sentence starts at 32.
    expect(inlinesMarkup(inlines, { start: 0, end: 31 })).toBe(
      "Es sei $v$ die Geschwindigkeit.[[FN-MARK 1)]]",
    );
    expect(inlinesMarkup(inlines, { start: 32, end: 45 })).toBe("[[SPERR]]Zweiter[[/SPERR]] Satz.");
  });

  test("a formula outside the span is left out, and a display adds nothing", () => {
    const out = inlinesMarkup(inlines, { start: 9, end: 31 });
    expect(out).not.toContain("$v$");
    expect(out).not.toContain("$x$");
    expect(markupPlainText(out)).toBe("die Geschwindigkeit.1)");
  });
});
