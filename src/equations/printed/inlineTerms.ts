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
  /**
   * THIS occurrence of the formula, where the record names one (a math inline's `inlineId`), for an
   * entry scoped to one printing of a glyph rather than to the paragraph (am-rse2). Relativity's
   * s10-p10 prints "auf der X-Achse unter der Wirkung einer elektrostatischen Kraft X" (p. 920,
   * line 1): the axis and the electrostatic force are the same LaTeX in one sentence, so a reading
   * keyed by the paragraph cannot tell them apart, and the axis was drawn in the force's colour.
   */
  occurrence?: string | undefined;
}>;

/** A sign the concordance does not carry, listed with its reason (content/inline-terms). */
export type InlineException = Readonly<{
  paper: string;
  /** One atom, as a display-terms glyph is written (\pi, e). */
  glyph: string;
  /** Sections or anchors it holds in, or ["all"]. */
  scope: readonly string[];
  reason: string;
  /**
   * What the sign names, in the reader's words, shown when a reader points at it on a reading face
   * (dispatch 280, step 1b). The reason is the editor's; this is the reader's.
   */
  note?: string | undefined;
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

/**
 * An atom left plain on purpose: a concordance entry in scope declares it no quantity, or a listed
 * exception holds it (dispatch 280, step 1b). It carries what it names, so a reading face can say
 * so when a reader points at it. `source` names where the reading came from: the concordance
 * entry's id, or the exception's paper, glyph and place in the list. A caller that wants the atom
 * marked in the render gives it a `labelId`; without one it stays unmarked, as before.
 */
export type InlineLabel = Readonly<{
  source: string;
  /** The atom as printed. */
  glyph: string;
  /** What it names, in the reader's words; absent where its exception gives none. */
  note?: string | undefined;
  start: number;
  end: number;
  braced: boolean;
  labelId?: string | undefined;
}>;

export type ResolvedInline = Readonly<{
  latex: string;
  scope: InlineScope;
  terms: readonly InlineTerm[];
  /** The atoms declared or excepted, each with what it names (InlineLabel). */
  labels: readonly InlineLabel[];
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
  /** Each bound atom, with its glyph as printed (for a legend or the inspector). */
  terms: readonly Readonly<{ termId: string; quantityId: string; glyph: string }>[];
  /**
   * Each atom marked as a label (data-label), with what it names: only where the caller gave the
   * label an id, which the reading faces do (paperInlines.ts). Absent otherwise.
   */
  labels?: readonly Readonly<{ labelId: string; glyph: string; note?: string | undefined }>[];
  /**
   * Where the whole formula is a number the paper prints in its prose: what it is the value of
   * (inlineValues.ts). Not a term, because the number is not the quantity it lights: "6 · 10^23" is
   * what the paper assigns to N, so it must not join N's glyph list or the coloured census. The
   * quantity is absent where the sentence supports none, and the note is always present.
   */
  value?: Readonly<{ quantityId?: string | undefined; note: string }> | undefined;
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

function signatureOrUndefined(glyph: string): string | undefined {
  try {
    return glyphSignature(glyph);
  } catch {
    // An entry for an expression (L/2, \cos\varphi) says nothing about one atom.
    return undefined;
  }
}

/**
 * The concordance's readings of one atom in scope, at the level that decides: entries scoped to this
 * printing of the formula if any, else those scoped to its paragraph, else those scoped more widely.
 * The paragraph level is the same precedence as concordanceBinding (displayTerms.ts); the occurrence
 * level is narrower still (am-rse2), and it is what lets one paragraph read two printings of one
 * glyph differently. Returned whole so that two readings can be told apart from none.
 */
function readingsInScope(
  entries: readonly ConcordanceEntry[],
  signature: string,
  scope: InlineScope,
): readonly Readonly<{
  id: string;
  binds: string;
  quantityId?: string | undefined;
  meaning?: string | undefined;
}>[] {
  const own = normalizeSectionId(scope.anchor);
  const here = scope.occurrence === undefined ? undefined : normalizeSectionId(scope.occurrence);
  const opinions = entries.flatMap((entry) => {
    // An entry scoped to an occurrence is in scope only at that occurrence. scopeMatches knows
    // nothing of occurrences, so such an entry would otherwise never match at all.
    const atOccurrence =
      here !== undefined && entry.scope.some((s) => normalizeSectionId(s) === here);
    if (!atOccurrence && !scopeMatches(entry.scope, scope.anchor, scope.section)) return [];
    if (signatureOrUndefined(entry.glyph.latex ?? "") !== signature) return [];
    const quantityId = "quantityId" in entry.binding ? entry.binding.quantityId : undefined;
    const binds =
      quantityId ??
      `not a quantity (${"nonQuantityKind" in entry.binding ? entry.binding.nonQuantityKind : "?"})`;
    const local = entry.scope.some((s) => normalizeSectionId(s) === own);
    return [{ id: entry.id, binds, quantityId, meaning: entry.meaning, local, atOccurrence }];
  });
  if (opinions.some((o) => o.atOccurrence)) return opinions.filter((o) => o.atOccurrence);
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
  // Each glyph's first listed exception in scope, with its place in the whole list, which names it.
  const excepted = new Map<string, Readonly<{ exception: InlineException; index: number }>>();
  for (const exception of exceptions) {
    const signature = signatureOrUndefined(exception.glyph);
    if (signature !== undefined && !excepted.has(signature))
      excepted.set(signature, { exception, index: context.exceptions.indexOf(exception) });
  }
  const terms: InlineTerm[] = [];
  const labels: InlineLabel[] = [];
  let declared = 0;
  let listed = 0;
  for (const atom of atoms) {
    const readings = readingsInScope(context.concordance, atom.signature, scope);
    const [first] = readings;
    if (!first) {
      const listing = excepted.get(atom.signature);
      if (listing) {
        listed++;
        labels.push({
          source: `exception ${listing.index}`,
          glyph: atom.text,
          ...(listing.exception.note ? { note: listing.exception.note } : {}),
          start: atom.start,
          end: atom.markEnd,
          braced: atom.bare,
        });
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
    // Two readings disagree only where they would draw the glyph differently: two quantities, or a
    // quantity and a sign. Two signs of different kinds (a function label, an operator) both leave
    // it plain (dispatch 278).
    if (readings.some((r) => r.quantityId !== first.quantityId)) {
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
      labels.push({
        source: first.id,
        glyph: atom.text,
        ...(first.meaning ? { note: first.meaning } : {}),
        start: atom.start,
        end: atom.markEnd,
        braced: atom.bare,
      });
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
      // Short on purpose: it is printed once per coloured atom on faces held to a byte budget, and
      // it only has to be unique within its formula, which is what the compile check reads.
      // Colour and lighting key on data-quantity-id.
      termId: `i${terms.length + 1}`,
      quantityId: first.quantityId,
      glyph: atom.text,
      start: atom.start,
      end: atom.markEnd,
      braced: atom.bare,
    });
  }
  return { latex, scope, terms, labels, declared, exceptions: listed, problems };
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
  // A label is marked only where the caller named it (the reading faces, dispatch 280); its term id
  // is l1, l2 in the formula, beside the quantities' i1, i2.
  const labels = resolved.labels.flatMap((label, i) =>
    label.labelId === undefined ? [] : [{ ...label, labelId: label.labelId, termId: `l${i + 1}` }],
  );
  if (resolved.terms.length === 0 && labels.length === 0)
    return { ...base, html: plain, terms: [] };
  const allowed = new Set([...resolved.terms, ...labels].map((t) => t.termId));
  const marked = markPrintedLatex(
    latex,
    [...resolved.terms, ...labels].map(({ start, end, termId, braced }) => ({
      start,
      end,
      termId,
      braced,
    })),
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
  const terms = resolved.terms.map(({ termId, quantityId, glyph }) => ({
    termId,
    quantityId,
    glyph,
  }));
  const withTerms = withQuantityIds(drawn, terms);
  if (labels.length === 0) return { ...base, html: withTerms, terms };
  // Each label's mark names its label: the same letter with the same meaning in the same section
  // shares one id across the page, which is what the face lights together.
  const labelOf = new Map(labels.map((l) => [l.termId, l.labelId]));
  const withLabels = withTerms.replace(/data-term="(l\d+)"/g, (whole, termId: string) => {
    const labelId = labelOf.get(termId);
    return labelId === undefined ? whole : `${whole} data-label="${labelId}"`;
  });
  return {
    ...base,
    html: withLabels,
    terms,
    labels: labels.map(({ labelId, glyph, note }) => ({
      labelId,
      glyph,
      ...(note ? { note } : {}),
    })),
  };
}
