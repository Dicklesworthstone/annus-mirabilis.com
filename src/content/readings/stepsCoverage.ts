/**
 * DOES "SHOW EVERY STEP" SHOW EVERY STEP? (am-r2-contains-r1-gate-wxf5)
 *
 * AGENTS.md: R2 expands R1. Every step of every derivation is shown, including the algebra, so R2
 * holds every display formula of R1 and at least as many words. Measured on 2026-09-24, R2 had
 * fewer authored words than R1 in 23 of 24 sections, and on live it showed fewer formulas on 22 of
 * 24 section pages: the opposite of its contract.
 *
 * An R1 display formula is in R2 when an R2 formula shows the same equation record, or its LaTeX,
 * spacing aside, appears in R2 as a display formula or as inline math. Words are the passage's own
 * prose: paragraphs and step items, with inline math taken out. A foundation lesson embedded in
 * R2 is a reference, not authored words, so it adds none: R2 made longer only by a generic lesson
 * has not shown any more of this derivation.
 */
import type { Block } from "../schemas/reading.ts";

export type StepsCoverage = Readonly<{
  /** Each R1 display formula, named by its equation record ids or, without one, its LaTeX. */
  r1Formulas: readonly string[];
  /** The R1 formulas R2 does not show. */
  missing: readonly string[];
  r1Words: number;
  r2Words: number;
}>;

/** LaTeX with its spacing and sizing commands and trailing punctuation taken out. */
export function normaliseLatex(latex: string): string {
  return latex.replace(/\\left|\\right|\\[,;!: ]|\s+/g, "").replace(/[.,]+$/, "");
}

const INLINE = /\\\((.+?)\\\)/g;

/** The words of a piece of prose, inline math taken out. */
export function proseWords(text: string): number {
  return text
    .replace(INLINE, " ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function words(blocks: readonly Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.kind === "paragraph") n += proseWords(b.text);
    else if (b.kind === "steps") for (const item of b.items) n += proseWords(item);
  }
  return n;
}

function inlineMath(text: string): string[] {
  return [...text.matchAll(INLINE)].map((m) => normaliseLatex(m[1] ?? ""));
}

const formulaName = (b: Extract<Block, { kind: "formula" }>) =>
  b.equations && b.equations.length > 0 ? b.equations.join("+") : normaliseLatex(b.latex);

export function stepsCoverage(full: readonly Block[], steps: readonly Block[]): StepsCoverage {
  const r1 = full.filter((b): b is Extract<Block, { kind: "formula" }> => b.kind === "formula");
  const r2 = steps.filter((b): b is Extract<Block, { kind: "formula" }> => b.kind === "formula");
  const r2Records = new Set(r2.flatMap((b) => b.equations ?? []));
  const r2Latex = new Set([
    ...r2.map((b) => normaliseLatex(b.latex)),
    ...steps.flatMap((b) =>
      b.kind === "paragraph"
        ? inlineMath(b.text)
        : b.kind === "steps"
          ? b.items.flatMap(inlineMath)
          : [],
    ),
  ]);
  const shown = (f: (typeof r1)[number]) =>
    (f.equations ?? []).some((id) => r2Records.has(id)) || r2Latex.has(normaliseLatex(f.latex));
  return {
    r1Formulas: r1.map(formulaName),
    missing: r1.filter((f) => !shown(f)).map(formulaName),
    r1Words: words(full),
    r2Words: words(steps),
  };
}

/** A passage violates the contract when R2 lacks an R1 formula or has fewer words than R1. */
export const violates = (c: StepsCoverage): boolean =>
  c.missing.length > 0 || c.r2Words < c.r1Words;
