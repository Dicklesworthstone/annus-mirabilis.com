/**
 * The identifiers of a PRINTED display, read from its transcription (dispatch 224).
 *
 * A printed display keeps Einstein's LaTeX byte for byte, and its term bindings live in a separate
 * record (content/display-terms/<paper>.yaml). To colour a term, the renderer has to find where each
 * bound glyph stands in that LaTeX. It never does this by replacing letters: a letter can stand
 * inside a command name (the v of \varphi), inside \text{...}, as a subscript label (the 0 of E_0,
 * or the nu of \varrho_\nu), or as a decoration (the star of l^*). So this reads the token stream
 * (tokenize.ts) into ATOMS instead:
 *
 * - an atom's base is one letter, one Greek letter (\varphi), or an accent construct around a
 *   group (\overline{E});
 * - its name runs on through subscripts (E_0, \overline{E}_\nu) and decorations (l^*, x'), and
 *   stops at an exponent, which is mathematics of its own and is read for atoms in turn (the V of
 *   V^2 is an atom, and so is the beta of e^{\beta\nu});
 * - the limits of a big operator (\int_0^\infty, \sum_{\nu = 1}) are mathematics, not a name;
 * - text-like commands (\text, \mathrm, \operatorname) are words and hold no atom.
 *
 * A glyph in a binding record is read the same way and must be exactly one atom, so a record binds
 * "E_0" as a whole and can never bind the E inside it. Two spellings of one name compare equal only
 * where a script's braces are the only difference (E_{0} and E_0).
 *
 * Marking splices \htmlData around an atom's exact offsets and copies every other byte through
 * unchanged. no-string-substitution.test.ts scans this file too.
 */

import { wrapHtmlData } from "./markers.ts";
import { type LatexToken, tokenizeLatex } from "./tokenize.ts";

type ItemKind = "char" | "cmd" | "symbol" | "open" | "close" | "sub" | "sup" | "env";

type Item = Readonly<{
  kind: ItemKind;
  value: string;
  /** Offsets in the LaTeX string: the item is latex.slice(start, end). */
  start: number;
  end: number;
}>;

export type PrintedAtom = Readonly<{
  /** latex.slice(start, end) is the atom's whole name: base, subscripts and decorations. */
  start: number;
  end: number;
  text: string;
  /** The canonical signature two spellings of one name share. */
  signature: string;
  /**
   * The atom is a script's whole argument without braces, the n of (v/v_0)^n. KaTeX takes a
   * marked atom there only inside a group, so its mark is braced.
   */
  bare: boolean;
}>;

const GREEK = new Set(
  [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "varepsilon",
    "zeta",
    "eta",
    "theta",
    "vartheta",
    "iota",
    "kappa",
    "varkappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "pi",
    "varpi",
    "rho",
    "varrho",
    "sigma",
    "varsigma",
    "tau",
    "upsilon",
    "phi",
    "varphi",
    "chi",
    "psi",
    "omega",
    "Gamma",
    "Delta",
    "Theta",
    "Lambda",
    "Xi",
    "Pi",
    "Sigma",
    "Upsilon",
    "Phi",
    "Psi",
    "Omega",
    "ell",
  ].map((name) => `\\${name}`),
);

/** Commands that make one name of the group they take: \overline{E} is not E. */
const ACCENTS = new Set(
  [
    "overline",
    "underline",
    "bar",
    "dot",
    "ddot",
    "hat",
    "widehat",
    "tilde",
    "widetilde",
    "vec",
    "breve",
    "check",
    "acute",
    "grave",
    "mathfrak",
    "mathbf",
    "mathcal",
    "mathit",
    "boldsymbol",
  ].map((name) => `\\${name}`),
);

/** Commands whose group is words or an upright label, never a quantity's letter. */
const TEXT_LIKE = new Set(
  [
    "text",
    "textrm",
    "textit",
    "textbf",
    "textup",
    "mathrm",
    "mathsf",
    "mathtt",
    "operatorname",
    "mbox",
    "hbox",
  ].map((name) => `\\${name}`),
);

/** Operators whose subscript and superscript are limits: mathematics, not part of a name. */
const BIG_OPERATORS = new Set(
  [
    "sum",
    "prod",
    "coprod",
    "int",
    "iint",
    "iiint",
    "oint",
    "lim",
    "max",
    "min",
    "sup",
    "inf",
    "bigcup",
    "bigcap",
  ].map((name) => `\\${name}`),
);

/** What a superscript may hold and still be part of the name: l^*, x^\prime, A^{\prime\prime}. */
const DECORATIONS = new Set(["*", "'", "\\ast", "\\star", "\\prime", "\\dagger"]);

export type PrintedAtomErrorKind = "latex-unreadable" | "glyph-not-one-atom" | "marks-overlap";

export class PrintedAtomError extends Error {
  readonly kind: PrintedAtomErrorKind;
  /** The code is the FIRST argument, as a kebab-case string literal, per the am-p465 ruling. */
  constructor(kind: PrintedAtomErrorKind, message: string) {
    super(message);
    this.name = "PrintedAtomError";
    this.kind = kind;
  }
}

function tokens(latex: string): readonly LatexToken[] {
  try {
    return tokenizeLatex(latex);
  } catch (error) {
    throw new PrintedAtomError(
      "latex-unreadable",
      `The LaTeX does not tokenize (${error instanceof Error ? error.message : String(error)}): ${latex}`,
    );
  }
}

function items(latex: string): readonly Item[] {
  const out: Item[] = [];
  for (const token of tokens(latex)) {
    const { kind, value, offset } = token;
    if (kind === "whitespace") continue;
    if (kind === "text") {
      // A text run is several atoms in mathematics: "dx" is d and x. One item per code point.
      let at = offset;
      for (const ch of value) {
        out.push({ kind: "char", value: ch, start: at, end: at + ch.length });
        at += ch.length;
      }
      continue;
    }
    const itemKind: ItemKind =
      kind === "control-word"
        ? "cmd"
        : kind === "control-symbol"
          ? "symbol"
          : kind === "group-open"
            ? "open"
            : kind === "group-close"
              ? "close"
              : kind === "subscript"
                ? "sub"
                : kind === "superscript"
                  ? "sup"
                  : "env";
    out.push({ kind: itemKind, value, start: offset, end: offset + value.length });
  }
  return out;
}

/** For each group-open, the index of its group-close. */
function closers(list: readonly Item[]): ReadonlyMap<number, number> {
  const map = new Map<number, number>();
  const stack: number[] = [];
  for (const [index, item] of list.entries()) {
    if (item.kind === "open") stack.push(index);
    else if (item.kind === "close") {
      const open = stack.pop();
      if (open !== undefined) map.set(open, index);
    }
  }
  return map;
}

/** The signature of list[from, to): a script's single-item group loses its braces. */
function signature(list: readonly Item[], from: number, to: number): string {
  const parts: string[] = [];
  for (let i = from; i < to; i++) {
    const item = list[i] as Item;
    parts.push(`${item.kind}:${item.value}`);
    const next = list[i + 1];
    const after = list[i + 3];
    if (
      (item.kind === "sub" || item.kind === "sup") &&
      next?.kind === "open" &&
      after?.kind === "close" &&
      i + 3 < to
    ) {
      parts.push(`${(list[i + 2] as Item).kind}:${(list[i + 2] as Item).value}`);
      i += 3;
    }
  }
  return parts.join(" ");
}

type Span = Readonly<{ from: number; to: number }>;

function readAtoms(latex: string): { list: readonly Item[]; atoms: (PrintedAtom & Span)[] } {
  const list = items(latex);
  const close = closers(list);
  const atoms: (PrintedAtom & Span)[] = [];
  /** Where the argument starting at k ends (exclusive), and its inner span. */
  const arg = (k: number): { end: number; inner: Span } => {
    const item = list[k];
    if (item?.kind === "open") {
      const c = close.get(k) ?? list.length - 1;
      return { end: c + 1, inner: { from: k + 1, to: c } };
    }
    return {
      end: Math.min(k + 1, list.length),
      inner: { from: k, to: Math.min(k + 1, list.length) },
    };
  };
  const decorated = (span: Span) =>
    span.to > span.from &&
    list.slice(span.from, span.to).every((item) => DECORATIONS.has(item.value));
  const scan = (from: number, to: number): void => {
    let i = from;
    while (i < to) {
      const item = list[i] as Item;
      if (item.kind === "open") {
        const c = close.get(i) ?? to;
        scan(i + 1, c);
        i = c + 1;
        continue;
      }
      if (item.kind === "cmd" && TEXT_LIKE.has(item.value)) {
        i = arg(i + 1).end;
        continue;
      }
      let baseEnd: number | undefined;
      let operator = false;
      if (item.kind === "cmd" && ACCENTS.has(item.value)) baseEnd = arg(i + 1).end;
      else if (item.kind === "cmd" && GREEK.has(item.value)) baseEnd = i + 1;
      else if (item.kind === "char" && /^\p{L}$/u.test(item.value)) baseEnd = i + 1;
      else if (item.kind === "cmd" && BIG_OPERATORS.has(item.value)) {
        baseEnd = i + 1;
        operator = true;
      }
      if (baseEnd === undefined) {
        i++;
        continue;
      }
      let j = baseEnd;
      let nameEnd = baseEnd;
      for (;;) {
        const next = list[j];
        if (next?.kind === "sub" || next?.kind === "sup") {
          const { end, inner } = arg(j + 1);
          if (!operator && next.kind === "sub") {
            nameEnd = end;
            j = end;
            continue;
          }
          if (!operator && decorated(inner)) {
            nameEnd = end;
            j = end;
            continue;
          }
          scan(inner.from, inner.to);
          j = end;
          // A limit may be followed by the other limit; an exponent ends the name.
          if (operator) continue;
          break;
        }
        if (!operator && next?.kind === "char" && next.value === "'") {
          nameEnd = j + 1;
          j++;
          continue;
        }
        break;
      }
      if (!operator) {
        const start = item.start;
        const end = (list[nameEnd - 1] as Item).end;
        const before = list[i - 1]?.kind;
        atoms.push({
          start,
          end,
          text: latex.slice(start, end),
          signature: signature(list, i, nameEnd),
          bare: before === "sub" || before === "sup",
          from: i,
          to: nameEnd,
        });
      }
      i = j;
    }
  };
  scan(0, list.length);
  atoms.sort((a, b) => a.start - b.start);
  return { list, atoms };
}

/** Every atom of a printed display, in reading order. */
export function printedAtoms(latex: string): readonly PrintedAtom[] {
  return readAtoms(latex).atoms.map(({ start, end, text, signature, bare }) => ({
    start,
    end,
    text,
    signature,
    bare,
  }));
}

/** The signature of a record's glyph, which must be exactly one atom and nothing else. */
export function glyphSignature(glyph: string): string {
  const { list, atoms } = readAtoms(glyph);
  const [only] = atoms;
  if (atoms.length !== 1 || !only || only.from !== 0 || only.to !== list.length) {
    throw new PrintedAtomError(
      "glyph-not-one-atom",
      `"${glyph}" is not one printed name: a binding names one letter with its subscripts and decorations (E_0, l^*, \\overline{E}_\\nu), never an expression.`,
    );
  }
  return only.signature;
}

export type PrintedMark = Readonly<{
  start: number;
  end: number;
  termId: string;
  /** Wrap the mark in a group: the atom is a bare script argument (PrintedAtom.bare). */
  braced?: boolean | undefined;
}>;

/**
 * The display's LaTeX with each marked atom wrapped as \htmlData{term=<id>}{...}, every other byte
 * copied through. Marks must lie on atom boundaries and must not overlap.
 */
export function markPrintedLatex(latex: string, marks: readonly PrintedMark[]): string {
  const ordered = [...marks].sort((a, b) => a.start - b.start);
  let out = "";
  let at = 0;
  for (const mark of ordered) {
    if (mark.start < at || mark.end <= mark.start || mark.end > latex.length)
      throw new PrintedAtomError(
        "marks-overlap",
        `Marks overlap or fall outside the display at ${mark.start}-${mark.end}.`,
      );
    out += latex.slice(at, mark.start);
    const wrapped = wrapHtmlData("term", mark.termId, latex.slice(mark.start, mark.end));
    out += mark.braced ? `{${wrapped}}` : wrapped;
    at = mark.end;
  }
  return out + latex.slice(at);
}
