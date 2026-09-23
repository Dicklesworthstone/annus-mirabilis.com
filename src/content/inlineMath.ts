/**
 * Inline mathematics in reading prose, written `\( … \)`.
 *
 * WHY. A paragraph's text was plain text and nothing else, so our explanations typed their
 * mathematics in ASCII: light quanta's reader met "the classical mean energy k_B T produces a
 * spectral energy density uν" directly above a formula typeset as ρ_ν, "hv_in, emits hv_out"
 * above a typeset ν_in and ν_out, and "B = h/k_B". On BUILD 24 that was 33 places in 10 of the 12
 * light-quanta records, and about 83 `x_Y` forms across every paper's argument records. The
 * sentence and the formula beside it named the same quantity in two different notations.
 *
 * A paragraph or a step may now carry inline mathematics between `\(` and `\)`, the LaTeX inline
 * delimiters. This module only SPLITS the text. The reading face and the offline chapter render
 * the mathematics with KaTeX (src/equations/render/inlineKatex.ts); the reading-record validator
 * checks each piece against the same command allowlist as a formula block; the Markdown export
 * writes `$ … $`; search reads a plain form. Malformed delimiters are refused here, by code, so a
 * stray `\(` fails the build rather than reaching a reader as raw text.
 */

export type InlineSegment = Readonly<{
  kind: "text" | "math";
  value: string;
  /** Offset of the segment in the source text: a stable key that is not an array index. */
  start: number;
}>;

export type InlineMathErrorCode =
  | "inline-math-unclosed"
  | "inline-math-stray-close"
  | "inline-math-empty"
  | "inline-math-nested";

export class InlineMathError extends Error {
  readonly code: InlineMathErrorCode;
  constructor(code: InlineMathErrorCode, message: string) {
    super(message);
    this.name = "InlineMathError";
    this.code = code;
  }
}

const OPEN = "\\(";
const CLOSE = "\\)";

export function hasInlineMath(text: string): boolean {
  return text.includes(OPEN) || text.includes(CLOSE);
}

export function splitInlineMath(text: string): readonly InlineSegment[] {
  const segments: InlineSegment[] = [];
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf(OPEN, at);
    const close = text.indexOf(CLOSE, at);
    if (close !== -1 && (open === -1 || close < open)) {
      throw new InlineMathError(
        "inline-math-stray-close",
        `"\\)" at offset ${close} closes no "\\(".`,
      );
    }
    if (open === -1) {
      segments.push({ kind: "text", value: text.slice(at), start: at });
      break;
    }
    if (open > at) segments.push({ kind: "text", value: text.slice(at, open), start: at });
    const end = text.indexOf(CLOSE, open + OPEN.length);
    if (end === -1) {
      throw new InlineMathError("inline-math-unclosed", `"\\(" at offset ${open} is never closed.`);
    }
    const latex = text.slice(open + OPEN.length, end);
    if (latex.includes(OPEN)) {
      throw new InlineMathError(
        "inline-math-nested",
        `"\\(" at offset ${open} opens again before it closes.`,
      );
    }
    if (!latex.trim()) {
      throw new InlineMathError("inline-math-empty", `"\\(" at offset ${open} holds nothing.`);
    }
    segments.push({ kind: "math", value: latex, start: open });
    at = end + CLOSE.length;
  }
  return segments;
}

/** For the Markdown export: `\( x \)` becomes `$x$`, which Markdown renderers read as math. */
export function inlineMathToMarkdown(text: string): string {
  if (!hasInlineMath(text)) return text;
  return splitInlineMath(text)
    .map((segment) => (segment.kind === "math" ? `$${segment.value.trim()}$` : segment.value))
    .join("");
}

const PLAIN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2"],
  [/\\(?:mathrm|text|operatorname|mathbf)\{([^{}]*)\}/g, "$1"],
  [/\\nu(?![A-Za-z])/g, "ν"],
  [/\\rho(?![A-Za-z])/g, "ρ"],
  [/\\Delta(?![A-Za-z])/g, "Δ"],
  [/\\lambda(?![A-Za-z])/g, "λ"],
  [/\\pi(?![A-Za-z])/g, "π"],
  [/\\tau(?![A-Za-z])/g, "τ"],
  [/\\beta(?![A-Za-z])/g, "β"],
  [/\\gamma(?![A-Za-z])/g, "γ"],
  [/\\varphi(?![A-Za-z])/g, "φ"],
  [/\\sigma(?![A-Za-z])/g, "σ"],
  [/\\mu(?![A-Za-z])/g, "μ"],
  [/\\eta(?![A-Za-z])/g, "η"],
  [/\\alpha(?![A-Za-z])/g, "α"],
  [/\\omega(?![A-Za-z])/g, "ω"],
  [/\\Phi(?![A-Za-z])/g, "Φ"],
  [/\\cdot(?![A-Za-z])/g, "·"],
  [/\\times(?![A-Za-z])/g, "×"],
  [/\\le(?![A-Za-z])/g, "≤"],
  [/\\ge(?![A-Za-z])/g, "≥"],
  [/\\approx(?![A-Za-z])/g, "≈"],
  [/\\to(?![A-Za-z])/g, "→"],
  [/\\(ln|exp|lg|sin|cos|lim)(?![A-Za-z])/g, "$1"],
  [/\\[,;! ]/g, " "],
  [/[{}]/g, ""],
];

/** For search and any other plain-text reader: the mathematics without its markup. */
export function inlineMathPlain(text: string): string {
  if (!hasInlineMath(text)) return text;
  return splitInlineMath(text)
    .map((segment) => {
      if (segment.kind === "text") return segment.value;
      let plain = segment.value;
      for (const [pattern, replacement] of PLAIN) plain = plain.replace(pattern, replacement);
      return plain.replace(/\s+/g, " ").trim();
    })
    .join("");
}
