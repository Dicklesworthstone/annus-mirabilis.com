/**
 * WORDS A SCREEN READER CAN SPEAK FOR A LINE THAT HOLDS MATHEMATICS (dispatch 152).
 *
 * The gloss face's "Read the aligned English translation" button carried the sentence as a flat
 * string in its aria-label, built from the units' text inlines only. A formula contributed nothing,
 * and neither did an emphasised word, so s0-p5-s1 was announced as "... referred to the coordinate
 * system , possess the energy ; let ..." with every quantity missing, and a sentence whose meaning
 * is its formula read as nonsense.
 *
 * speakInlines keeps every word, and speaks each formula. An authored spoken form is the right
 * words for a formula, and as of am-rc1001-bridge-plan-pcjk.29 a math inline can carry one in
 * `spoken`, which wins over everything below. No record in the corpus sets one yet, so in practice
 * every printed formula is still spoken from its own MathML. The equation records' forms are not
 * a substitute: the equation records' `spoken` forms
 * (content/equations) are in modern notation, e prime and gamma where the paper prints l* and
 * 1/sqrt(1 - (v/V)^2), and reading those would translate the notation, which the edition does not
 * do. So each formula is spoken from its own MathML, KaTeX's text alternative for it: the printed
 * symbols, with fractions, roots, powers and subscripts said in words. It is generated speech, and
 * where an authored form exists for a formula the caller passes it and it is used instead.
 */
import { renderToString } from "katex";
import type { Inline } from "../../content/schemas/source.ts";

type Node = { readonly tag: string; readonly children: Node[] } | { readonly text: string };

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X"))
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** KaTeX's MathML is well-formed and small; this reads its elements and text, nothing more. */
function parseMathml(xml: string): Node[] {
  const root: { tag: string; children: Node[] } = { tag: "#root", children: [] };
  const stack = [root];
  for (const match of xml.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const [, closing, tag, , selfClosing, text] = match;
    const top = stack[stack.length - 1] ?? root;
    if (text !== undefined) {
      top.children.push({ text: decode(text) });
    } else if (closing) {
      if (stack.length > 1) stack.pop();
    } else if (tag !== undefined) {
      const element = { tag, children: [] as Node[] };
      top.children.push(element);
      if (!selfClosing) stack.push(element);
    }
  }
  return root.children;
}

const OPERATORS: Readonly<Record<string, string>> = {
  "=": "equals",
  "+": "plus",
  "−": "minus",
  "-": "minus",
  "±": "plus or minus",
  "⋅": "times",
  "·": "times",
  "×": "times",
  "/": "divided by",
  "(": "open paren",
  ")": "close paren",
  "[": "open bracket",
  "]": "close bracket",
  "{": "open brace",
  "}": "close brace",
  "∗": "star",
  "*": "star",
  "′": "prime",
  "≈": "is approximately",
  "<": "is less than",
  ">": "is greater than",
  "≤": "is less than or equal to",
  "≥": "is greater than or equal to",
  // The double-bar forms the Annalen compositor sets, and the relations and large operators the
  // four papers print. Each was said as its raw glyph until a census over the corpus named them
  // (am-rc1001-bridge-plan-pcjk.29): a screen reader given "≧" announces the character or nothing.
  "≧": "is greater than or equal to",
  "≦": "is less than or equal to",
  "≠": "is not equal to",
  "≷": "is greater or less than",
  "…": "dot dot dot",
  "∑": "the sum of",
  "∫": "the integral of",
  "∞": "infinity",
  "→": "tends to",
  // Function application and invisible times: MathML structure, not words.
  "⁡": "",
  "⁢": "",
  "⁣": "",
};

const LETTERS: Readonly<Record<string, string>> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  ϵ: "epsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ϑ: "theta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  π: "pi",
  ρ: "rho",
  // Variant forms: the papers print ϱ for rho (the Brownian and light-quanta densities) and ϰ
  // for kappa. KaTeX emits them as themselves, so without these they were spoken as the glyph.
  ϱ: "rho",
  ϰ: "kappa",
  "∂": "partial",
  σ: "sigma",
  τ: "tau",
  υ: "upsilon",
  φ: "phi",
  ϕ: "phi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
  Γ: "capital gamma",
  Δ: "capital delta",
  Θ: "capital theta",
  Λ: "capital lambda",
  Ξ: "capital xi",
  Π: "capital pi",
  Σ: "capital sigma",
  Φ: "capital phi",
  Ψ: "capital psi",
  Ω: "capital omega",
  cos: "cosine",
  sin: "sine",
  tan: "tangent",
  log: "log",
  ln: "natural log",
  exp: "exponential",
};

/**
 * The accent characters KaTeX puts in an <mover>, and the word for each. Without these the
 * generic join said the base and then the combining glyph: `\overline{E}` was "E ‾", and the
 * mean energy of a resonator read as a letter followed by a line.
 */
const ACCENTS: Readonly<Record<string, string>> = {
  "‾": "bar",
  ˉ: "bar",
  "¯": "bar",
  "⃗": "vector",
  "^": "hat",
  "~": "tilde",
  "˙": "dot",
  "¨": "double dot",
};

const textOf = (node: Node): string =>
  "text" in node ? node.text : node.children.map(textOf).join("");

const elements = (node: Node): Node[] =>
  "text" in node ? [] : node.children.filter((child) => !("text" in child));

/** One token, or a row holding one: short enough to say "a over b" without "end fraction". */
const simple = (node: Node): boolean => {
  if ("text" in node) return true;
  if (["mi", "mn", "mo", "mtext"].includes(node.tag)) return true;
  const kids = elements(node);
  return node.tag === "mrow" && kids.length === 1 && kids[0] !== undefined && simple(kids[0]);
};

function speak(node: Node): string {
  if ("text" in node) return "";
  const kids = elements(node);
  const [a, b, c] = kids;
  const say = (n: Node | undefined) => (n === undefined ? "" : speak(n));
  switch (node.tag) {
    case "mi":
    case "mo": {
      const text = textOf(node).trim();
      return OPERATORS[text] ?? LETTERS[text] ?? text;
    }
    case "mn":
    case "mtext":
      return textOf(node).trim();
    case "annotation":
    case "annotation-xml":
    case "mspace":
    case "mphantom":
      return "";
    case "mfrac":
      return a !== undefined && b !== undefined && simple(a) && simple(b)
        ? `${say(a)} over ${say(b)}`
        : // "a over b" is ambiguous once either holds a fraction of its own, so name the parts.
          `the fraction with numerator ${say(a)}, and denominator ${say(b)}, end fraction`;
    case "msqrt": {
      const inner = kids.map(speak).join(" ");
      return kids.length === 1 && a !== undefined && simple(a)
        ? `the square root of ${inner}`
        : `the square root of ${inner}, end root`;
    }
    case "mroot":
      return `the root of index ${say(b)} of ${say(a)}, end root`;
    case "msup":
      return `${say(a)} ${power(b)}`;
    case "msub":
      return `${say(a)} sub ${say(b)}`;
    case "msubsup":
      return `${say(a)} sub ${say(b)} ${power(c)}`;
    case "mover":
    case "munder": {
      // An accent, when the second child is one: "E bar". Anything else -- a sum's limit, say --
      // keeps the same generic join the default case uses, so only the accents change.
      const accent = b === undefined ? "" : textOf(b).trim();
      const named = ACCENTS[accent];
      return named === undefined ? kids.map(speak).join(" ") : `${say(a)} ${named}`;
    }
    case "mtable":
      return kids.map(speak).join("; ");
    default:
      return kids.map(speak).join(" ");
  }
}

function power(exponent: Node | undefined): string {
  if (exponent === undefined) return "";
  const text = textOf(exponent).trim();
  if (text === "2") return "squared";
  if (text === "3") return "cubed";
  if (text === "∗" || text === "*") return "star";
  if (text === "′") return "prime";
  const said = speak(exponent);
  return simple(exponent) ? `to the power ${said}` : `to the power ${said}, end power`;
}

const tidy = (words: string): string =>
  words
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    // A row's own closing comma, then the break between aligned rows.
    .replace(/,;/g, ";")
    .trim();

/** The words for one formula, from its own MathML. */
export function speakMath(latex: string, display = false): string {
  const mathml = renderToString(latex, {
    output: "mathml",
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
    trust: false,
  });
  return tidy(parseMathml(mathml).map(speak).join(" "));
}

/**
 * A line of inlines as a screen reader should hear it: every word as written, emphasis included,
 * and each formula as its authored spoken form when `authored` has one for its equation, else as
 * speakMath says it. Footnote marks are left out; the footnote itself is announced where it stands.
 */
export function speakInlines(
  inlines: readonly Inline[],
  authored: ReadonlyMap<string, string> = new Map(),
): string {
  const walk = (nodes: readonly Inline[]): string =>
    nodes
      .map((node) => {
        if (node.kind === "math") {
          // The node's own form wins: it is authored for THIS occurrence, in printed notation, and
          // is the only channel that can correct a reading the lexicon has no word for. Then the
          // caller's map, keyed by equation id, for a formula whose printed form is authored
          // elsewhere. A non-display inline carries no equationId, so before `spoken` existed the
          // 714 expressions written inside sentences could not be corrected at all.
          const spoken =
            node.spoken ??
            (node.equationId === undefined ? undefined : authored.get(node.equationId));
          // No padding: the text around a formula carries the spaces the line prints, and
          // "the $x$-axis" is spoken "the x-axis", not "the x -axis".
          return spoken ?? speakMath(node.latex, node.display === true);
        }
        if (node.kind === "emphasis") return walk(node.inlines);
        // A misprint inside a formula is said as its formula, as printed (dispatch 270).
        if (node.kind === "misprint" && "math" in node) return walk([node.math]);
        if ("text" in node && typeof node.text === "string") return node.text;
        return "";
      })
      .join("");
  return tidy(walk(inlines));
}
