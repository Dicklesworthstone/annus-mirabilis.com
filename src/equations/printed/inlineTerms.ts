/**
 * THE INLINE RESOLVER (dispatch 272). The owner: "I still see a ton of equations that aren't
 * properly using the colored equations with latex system like in classic-patents.com".
 *
 * CONTRACT. In: an inline formula's LaTeX, exactly as its record prints it, and its scope (the
 * paper, the block or unit that prints it, the paragraph anchor and the section the concordance
 * reads it in). Out: every atom of the formula (printedAtoms.ts) resolved to exactly one of
 *   - a quantity: the one the notation concordance binds that glyph to IN THAT SCOPE, which must be
 *     a registered quantity id; the render marks it with data-term and data-quantity-id;
 *   - a declared non-quantity: a concordance entry in scope says it names no quantity (an operator
 *     such as d, an index, a coordinate-system label); left uncoloured;
 *   - a listed exception (content/inline-terms/exceptions.yaml, each with its reason): a sign the
 *     concordance does not carry, such as the number π; left uncoloured;
 *   - a refusal, naming the formula's block or unit and the glyph: no reading in scope, or two
 *     different readings at the same level, or a quantity id the registry does not hold.
 * A formula with any refusal does not compile (compileInlineFormula throws inline-terms-refused),
 * and the build names every refusal, so nothing is left plain in silence.
 *
 * NEVER BY LETTER, NEVER BY LABEL. Atoms come from the token stream, so the v of \varphi, the 0 of
 * E_0 and the star of l^* are never bound on their own, and a glyph is matched to a concordance
 * entry by its atom signature, never by a quantity's name. The concordance's own precedence holds:
 * an entry scoped to the formula's paragraph outranks one scoped to its section (concordanceBinding
 * in displayTerms.ts reads displays the same way).
 *
 * THE RENDER is KaTeX HTML and MathML with the face's inline options (INLINE_KATEX). As for a
 * printed display (compilePrintedDisplay), the marked render replaces only the visual half: the
 * MathML, TeX annotation included, is exactly the plain render's, and is checked to be.
 *
 * Pure: no file system. A caller loads the concordance (loadConcordanceForPaper), the registry check
 * and the exceptions (paperInlines.ts, loadInlineExceptions) and passes them in, so explanations,
 * foundations and labs can resolve their own formulas with their own scopes.
 */
import { renderToString } from "katex";
import { normalizeSectionId, scopeMatches } from "../../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import {
  glyphSignature,
  markPrintedLatex,
  type PrintedAtom,
  PrintedAtomError,
  printedAtoms,
} from "../latex/printedAtoms.ts";
import { withQuantityIds } from "../termQuantities.ts";

/** Where an inline formula is printed, as the concordance reads it. */
export type InlineScope = Readonly<{
  paper: string;
  /** The block or unit that prints it: named in every refusal. */
  where: string;
  /** Its paragraph or footnote, for entries scoped to one paragraph. */
  anchor: string;
  /** Its section (s0 to s10), for entries scoped to a section. */
  section: string;
}>;

/** A sign the concordance does not carry, listed with its reason (content/inline-terms). */
export type InlineException = Readonly<{
  paper: string;
  /** One atom, as a display-terms glyph is written (\pi, e). */
  glyph: string;
  /** Sections or anchors it holds in, or ["all"]. */
  scope: readonly string[];
  reason: string;
}>;

export type InlineTermsContext = Readonly<{
  concordance: readonly ConcordanceEntry[];
  isRegistered: (quantityId: string) => boolean;
  exceptions: readonly InlineException[];
}>;

export type InlineTermsCode =
  | "inline-terms-unreadable"
  | "inline-terms-unbound-glyph"
  | "inline-terms-ambiguous-glyph"
  | "inline-terms-unregistered-quantity";

export type InlineTermsProblem = Readonly<{
  code: InlineTermsCode;
  where: string;
  glyph: string;
  message: string;
}>;

export type InlineTerm = Readonly<{
  termId: string;
  quantityId: string;
  /** The atom as printed. */
  glyph: string;
  start: number;
  end: number;
  braced: boolean;
}>;

export type ResolvedInline = Readonly<{
  latex: string;
  scope: InlineScope;
  terms: readonly InlineTerm[];
  /** Atoms a concordance entry in scope declares no quantity. */
  declared: number;
  /** Atoms left plain by a listed exception. */
  exceptions: number;
  problems: readonly InlineTermsProblem[];
}>;

export type CompiledInline = Readonly<{
  paper: string;
  where: string;
  latex: string;
  /** KaTeX HTML and MathML, each bound atom wrapped with data-term and data-quantity-id. */
  html: string;
  terms: readonly Readonly<{ termId: string; quantityId: string }>[];
}>;

/** The KaTeX options every face renders an inline formula with (inlines.tsx). */
export const INLINE_KATEX = Object.freeze({
  displayMode: false,
  output: "htmlAndMathml" as const,
  throwOnError: false,
  strict: "warn" as const,
  trust: false,
});

export class InlineTermsError extends Error {
  readonly code:
    | "inline-terms-refused"
    | "inline-terms-term-dropped"
    | "inline-terms-mathml-changed";
  constructor(code: InlineTermsError["code"], message: string) {
    super(`${code}: ${message}`);
    this.name = "InlineTermsError";
    this.code = code;
  }
}

/** A short, stable name for a formula within its block: FNV-1a over its LaTeX. */
function formulaKey(latex: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < latex.length; i++) {
    h ^= latex.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function signatureOrUndefined(glyph: string): string | undefined {
  try {
    return glyphSignature(glyph);
  } catch {
    // An entry for an expression (L/2, \cos\varphi) says nothing about one atom.
    return undefined;
  }
}

/**
 * The concordance's readings of one atom in scope, at the level that decides: entries scoped to the
 * formula's own paragraph if any, else those scoped more widely. The same precedence as
 * concordanceBinding (displayTerms.ts), returned whole so that two readings can be told apart from
 * none.
 */
function readingsInScope(
  entries: readonly ConcordanceEntry[],
  signature: string,
  scope: InlineScope,
): readonly Readonly<{ id: string; binds: string; quantityId?: string | undefined }>[] {
  const own = normalizeSectionId(scope.anchor);
  const opinions = entries.flatMap((entry) => {
    if (!scopeMatches(entry.scope, scope.anchor, scope.section)) return [];
    if (signatureOrUndefined(entry.glyph.latex ?? "") !== signature) return [];
    const quantityId = "quantityId" in entry.binding ? entry.binding.quantityId : undefined;
    const binds =
      quantityId ??
      `not a quantity (${"nonQuantityKind" in entry.binding ? entry.binding.nonQuantityKind : "?"})`;
    const local = entry.scope.some((s) => normalizeSectionId(s) === own);
    return [{ id: entry.id, binds, quantityId, local }];
  });
  return opinions.some((o) => o.local) ? opinions.filter((o) => o.local) : opinions;
}

/** Resolves every atom of an inline formula in its scope. Never throws: refusals are returned. */
export function resolveInlineTerms(
  latex: string,
  scope: InlineScope,
  context: InlineTermsContext,
): ResolvedInline {
  const problems: InlineTermsProblem[] = [];
  const at = `${scope.paper} ${scope.where}`;
  let atoms: readonly PrintedAtom[] = [];
  try {
    atoms = printedAtoms(latex);
  } catch (error) {
    problems.push({
      code: "inline-terms-unreadable",
      where: scope.where,
      glyph: latex,
      message: `${at}: ${JSON.stringify(latex)} cannot be read into atoms: ${error instanceof PrintedAtomError ? error.message : String(error)}`,
    });
  }
  const exceptions = context.exceptions.filter(
    (e) => e.paper === scope.paper && scopeMatches(e.scope, scope.anchor, scope.section),
  );
  const excepted = new Set(exceptions.flatMap((e) => signatureOrUndefined(e.glyph) ?? []));
  const key = formulaKey(latex);
  const terms: InlineTerm[] = [];
  let declared = 0;
  let listed = 0;
  for (const atom of atoms) {
    const readings = readingsInScope(context.concordance, atom.signature, scope);
    const [first] = readings;
    if (!first) {
      if (excepted.has(atom.signature)) {
        listed++;
        continue;
      }
      problems.push({
        code: "inline-terms-unbound-glyph",
        where: scope.where,
        glyph: atom.text,
        message: `${at}: "${atom.text}" in ${JSON.stringify(latex)} has no concordance reading in ${scope.anchor} (section ${scope.section || "none"}), and is not a listed exception (content/inline-terms/exceptions.yaml).`,
      });
      continue;
    }
    if (readings.some((r) => r.binds !== first.binds)) {
      problems.push({
        code: "inline-terms-ambiguous-glyph",
        where: scope.where,
        glyph: atom.text,
        message: `${at}: "${atom.text}" in ${JSON.stringify(latex)} has two readings at the same level in ${scope.anchor}: ${readings.map((r) => `${r.id} reads ${r.binds}`).join("; ")}.`,
      });
      continue;
    }
    if (first.quantityId === undefined) {
      declared++;
      continue;
    }
    if (!context.isRegistered(first.quantityId)) {
      problems.push({
        code: "inline-terms-unregistered-quantity",
        where: scope.where,
        glyph: atom.text,
        message: `${at}: "${atom.text}" binds ${first.quantityId} (concordance ${first.id}), which is not a registered quantity id (content/quantities/).`,
      });
      continue;
    }
    terms.push({
      termId: `${scope.paper}.${scope.where}.m${key}.t${terms.length + 1}`,
      quantityId: first.quantityId,
      glyph: atom.text,
      start: atom.start,
      end: atom.markEnd,
      braced: atom.bare,
    });
  }
  return { latex, scope, terms, declared, exceptions: listed, problems };
}

const KATEX_HTML = '<span class="katex-html" aria-hidden="true">';
const INLINE_CLOSE = "</span>";

/** The MathML's structure, up to the TeX annotation (which carries the source it was drawn from). */
function mathmlStructure(html: string): string {
  const start = html.indexOf('<span class="katex-mathml">');
  const end = html.indexOf("<annotation", start);
  return start < 0 || end < 0 ? "" : html.slice(start, end);
}

/** Where the visual part of an inline render begins and ends: the katex-html span. */
function visualSpan(html: string): { start: number; end: number } | undefined {
  const start = html.indexOf(KATEX_HTML);
  return start < 0 || !html.endsWith(`${INLINE_CLOSE}${INLINE_CLOSE}`)
    ? undefined
    : { start, end: html.length - INLINE_CLOSE.length };
}

/**
 * The formula drawn with its terms marked. `render` is KaTeX's renderToString; it is a parameter so
 * a test can show the checks refuse a render that drops a term or changes the MathML.
 */
export function compileInlineFormula(
  resolved: ResolvedInline,
  render: typeof renderToString = renderToString,
): CompiledInline {
  const { latex, scope } = resolved;
  if (resolved.problems.length > 0)
    throw new InlineTermsError(
      "inline-terms-refused",
      resolved.problems.map((p) => p.message).join("\n"),
    );
  const plain = render(latex, INLINE_KATEX);
  const base = { paper: scope.paper, where: scope.where, latex };
  if (resolved.terms.length === 0) return { ...base, html: plain, terms: [] };
  const allowed = new Set(resolved.terms.map((t) => t.termId));
  const marked = markPrintedLatex(
    latex,
    resolved.terms.map(({ start, end, termId, braced }) => ({ start, end, termId, braced })),
  );
  const html = render(marked, {
    ...INLINE_KATEX,
    throwOnError: true,
    strict: (code: string) => (code === "htmlExtension" ? "ignore" : "warn"),
    trust: (context) => {
      if (context.command !== "\\htmlData") return false;
      const attributes = Object.entries(context.attributes as Record<string, string>);
      const [only] = attributes;
      return attributes.length === 1 && only?.[0] === "data-term" && allowed.has(only[1]);
    },
  });
  for (const id of allowed)
    if (!html.includes(`data-term="${id}"`))
      throw new InlineTermsError(
        "inline-terms-term-dropped",
        `${scope.paper} ${scope.where}: the render of ${JSON.stringify(latex)} dropped ${id}.`,
      );
  const markedVisual = visualSpan(html);
  const plainVisual = visualSpan(plain);
  if (
    !markedVisual ||
    !plainVisual ||
    mathmlStructure(html) === "" ||
    mathmlStructure(html) !== mathmlStructure(plain)
  )
    throw new InlineTermsError(
      "inline-terms-mathml-changed",
      `${scope.paper} ${scope.where}: marking ${JSON.stringify(latex)} changed its MathML, or the render is not inline.`,
    );
  const drawn =
    plain.slice(0, plainVisual.start) +
    html.slice(markedVisual.start, markedVisual.end) +
    plain.slice(plainVisual.end);
  const terms = resolved.terms.map(({ termId, quantityId }) => ({ termId, quantityId }));
  return { ...base, html: withQuantityIds(drawn, terms), terms };
}
