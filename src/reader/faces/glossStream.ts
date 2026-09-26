import { tokenizeGerman } from "../../content/editions/tokenizeGerman.ts";
import { type Inline, type MathInline, plainText } from "../../content/schemas/inlines.ts";

/**
 * What a gloss sentence prints, in order: its words, and between them the mathematics and
 * punctuation the gloss never glosses (am-read-gloss-face-lp2).
 *
 * WHY THIS EXISTS. GlossSentence printed a gloss unit's word tokens and nothing else, because a
 * gloss unit holds word tokens only. Every inline formula and every punctuation mark fell out of
 * the German line: 42 formulas in 15 of mass-energy's 34 sentences, among them the paper's result,
 * which read "... verkleinert sich seine Masse um" with its L/V^2 gone. The atoms are not glossed
 * and never will be; they stand in the line between the word pairs, where the paper prints them.
 */

type Offsets = Readonly<{ start: number; end: number }>;

/** A mathematics atom or footnote mark of one sentence, in offsets of the sentence's own text. */
export type SentenceAtom =
  | Readonly<{ kind: "math"; start: number; end: number; node: MathInline }>
  | Readonly<{ kind: "footnote-mark"; start: number; end: number; mark: string }>;

/**
 * The atoms of one sentence of a block. Offsets are counted over plainText(inlines), which is the
 * block's diplomaticText, the text a sentence span's offsets index. A display formula adds no
 * characters there (its equation block is printed after the sentence), so it is never an atom.
 */
export function sentenceAtoms(inlines: readonly Inline[], span: Offsets): readonly SentenceAtom[] {
  const atoms: SentenceAtom[] = [];
  let offset = 0;
  const walk = (nodes: readonly Inline[]) => {
    for (const node of nodes) {
      if (node.kind === "emphasis") {
        walk(node.inlines);
        continue;
      }
      const length = plainText([node]).length;
      const start = offset;
      const end = offset + length;
      offset = end;
      if (length === 0 || start < span.start || end > span.end) continue;
      if (node.kind === "math" && node.display !== true) {
        atoms.push({ kind: "math", start: start - span.start, end: end - span.start, node });
      } else if (node.kind === "misprint" && "math" in node) {
        // A misprint inside a formula is its formula, as printed (dispatch 270).
        const math = node.math;
        atoms.push({ kind: "math", start: start - span.start, end: end - span.start, node: math });
      } else if (node.kind === "footnote-mark") {
        atoms.push({
          kind: "footnote-mark",
          start: start - span.start,
          end: end - span.start,
          mark: node.mark,
        });
      }
    }
  };
  walk(inlines);
  return atoms;
}

/** Something printed beside a word, or on its own, that carries no gloss. */
export type GlossAtom =
  | Readonly<{ kind: "math"; start: number; node: MathInline }>
  | Readonly<{ kind: "punctuation"; start: number; text: string }>;

/**
 * One visual unit of the German line: what the sentence prints with no space inside it. A word
 * keeps its gloss under it and carries the atoms printed against it ("x-Achse" is one unit over
 * "axis", "Energie:" another). A unit with no word, such as a formula standing between spaces or
 * a free-standing dash, is printed with nothing beneath it.
 */
export type GlossCluster =
  | Readonly<{
      kind: "word";
      tokenIndex: number;
      leading: readonly GlossAtom[];
      trailing: readonly GlossAtom[];
    }>
  | Readonly<{ kind: "atoms"; start: number; atoms: readonly GlossAtom[] }>;

export type GlossStream = Readonly<{
  clusters: readonly GlossCluster[];
  /** The word tokens in order, for matching against the gloss unit's own tokens. */
  words: readonly string[];
}>;

/**
 * The German line of a sentence as clusters. Tokens come from tokenizeGerman, the same tokenizer
 * the gloss units are checked against, with the sentence's atoms passed in so a formula is never
 * read as words. A footnote mark is left out, as this face prints no marks (GlossFace.tsx).
 */
export function glossStream(text: string, atoms: readonly SentenceAtom[] = []): GlossStream {
  const math = atoms.filter((a) => a.kind === "math");
  const marks = atoms.filter((a) => a.kind === "footnote-mark");
  const tokens = tokenizeGerman(text, {
    mathRegions: math.map((a) => ({ start: a.start, end: a.end })),
    footnoteMarks: marks.map((a) => ({ start: a.start, end: a.end })),
  });

  // Runs of tokens with nothing between them.
  const runs: (typeof tokens)[number][][] = [];
  let previousEnd = -1;
  for (const token of tokens) {
    const run = runs[runs.length - 1];
    if (run && token.start === previousEnd) run.push(token);
    else runs.push([token]);
    previousEnd = token.end;
  }

  const words: string[] = [];
  const clusters: GlossCluster[] = [];
  for (const run of runs) {
    // Atoms before the run's first word are printed before it; atoms after a word, after it.
    const pending: GlossAtom[] = [];
    const runWords: { tokenIndex: number; leading: GlossAtom[]; trailing: GlossAtom[] }[] = [];
    for (const token of run) {
      if (token.kind === "word") {
        words.push(token.text);
        runWords.push({
          tokenIndex: token.tokenIndex ?? words.length - 1,
          leading: runWords.length === 0 ? pending.splice(0) : [],
          trailing: [],
        });
        continue;
      }
      let atom: GlossAtom | null = null;
      if (token.kind === "math") {
        const found = math.find((a) => a.start === token.start);
        if (found?.kind === "math") atom = { kind: "math", start: token.start, node: found.node };
      } else if (token.kind === "punctuation") {
        atom = { kind: "punctuation", start: token.start, text: token.text };
      }
      if (!atom) continue;
      const last = runWords[runWords.length - 1];
      if (last) last.trailing.push(atom);
      else pending.push(atom);
    }
    for (const word of runWords) clusters.push({ kind: "word", ...word });
    if (pending[0]) clusters.push({ kind: "atoms", start: pending[0].start, atoms: pending });
  }
  return { clusters, words };
}
