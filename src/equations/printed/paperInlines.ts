/**
 * The reading faces' inline formulas, resolved and compiled at build time (dispatch 272), with the
 * inline resolver (inlineTerms.ts).
 *
 * EVERY PLACE A FORMULA IS PRINTED gets a holder: each German block (not an equation block, whose
 * display is coloured by content/display-terms), each of its sentences (the gloss and the result
 * cards quote by sentence), and each English unit, which is read in the scope of the German block
 * its source sentence belongs to. A holder names a SCOPE (paper, paragraph anchor, section), and a
 * formula is compiled once per scope and LaTeX, so a German block and its English units share one
 * render. The faces look a formula up by the holder that prints it (printedInlines.ts).
 *
 * THE CENSUS counts every inline formula a paper prints, German and English: coloured (at least one
 * bound quantity), plain by declaration (every atom a declared non-quantity or a listed exception),
 * and refused. For a paper in ENFORCED_INLINE_PAPERS a refusal stops the build by name; for any
 * other the refused formulas stay plain and are reported by name, never silently.
 */
import { renderToString } from "katex";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { misprintNotes } from "../../content/provenance/misprints.ts";
import { loadReaderDescriptions } from "../../content/quantities/readerDescriptions.ts";
import { getQuantityRegistry, isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import { type BilingualEdition, loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import type { TermFacts } from "../termFacts.ts";
import { fallbackTermFacts, notationFor, notationLink } from "./fallbackFacts.ts";
import { ENFORCED_INLINE_PAPERS, loadInlineExceptions } from "./inlineExceptions.ts";
import { inlineLabelId } from "./inlineLabels.ts";
import {
  type CompiledInline,
  compileInlineFormula,
  type InlineException,
  type InlineScope,
  type InlineTermsProblem,
  resolveInlineTerms,
} from "./inlineTerms.ts";
import { type InlineValue, inlineValuesByScope, loadInlineValues } from "./inlineValues.ts";

export {
  ENFORCED_INLINE_PAPERS,
  INLINE_EXCEPTIONS_PATH,
  type InlineExceptionsCode,
  InlineExceptionsError,
  loadInlineExceptions,
  parseInlineExceptions,
} from "./inlineExceptions.ts";

/** The scope key a holder names: one render per scope and LaTeX. */
export function scopeKey(scope: Pick<InlineScope, "paper" | "anchor" | "section">): string {
  return `${scope.paper}|${scope.anchor}|${scope.section}`;
}

/**
 * The key one compiled render is stored under. A formula the record marks with an `inlineId` is
 * stored under that occurrence as well, so one paragraph can print one glyph twice and read the two
 * differently (am-rse2): relativity's s10-p10 names the X-axis and an electrostatic force X in one
 * sentence. Everything else keeps the one-render-per-scope-and-LaTeX key it had, so no other
 * formula on any face is compiled or stored twice.
 */
export function formulaKey(scope: string, latex: string, occurrence?: string | undefined): string {
  return occurrence === undefined
    ? `${scope}\u0000${latex}`
    : `${scope}\u0000${occurrence}\u0000${latex}`;
}

type Holder = Readonly<{
  id: string;
  kind?: string | undefined;
  section?: string | undefined;
  containedIn?: string | undefined;
  inlines: readonly Inline[];
  sentenceSpans?: readonly Readonly<{ id: string }>[] | undefined;
  sourceRefs?: readonly Readonly<{ id: string }>[] | undefined;
}>;

/**
 * The LaTeX of every inline (not display) formula in these inlines, in reading order. A misprint
 * inside a formula (dispatch 270) prints the formula as set and, in its note, the formula meant
 * (inlines.tsx): both are counted and compiled in the holder's scope, since both are inline
 * formulas on the face.
 */
export function inlineFormulas(inlines: readonly Inline[]): string[] {
  return inlineFormulaSites(inlines).map((site) => site.latex);
}

/**
 * The same walk, with the occurrence each formula is printed at where the record names one: a math
 * inline's `inlineId` (am-rse2). A misprint's two readings share the misprint's own site, since they
 * are one printing of one formula.
 */
export function inlineFormulaSites(
  inlines: readonly Inline[],
): { latex: string; occurrence?: string | undefined }[] {
  return inlines.flatMap((inline) => {
    if (inline.kind === "math")
      return inline.display === true
        ? []
        : [
            {
              latex: inline.latex,
              ...(inline.inlineId === undefined ? {} : { occurrence: inline.inlineId }),
            },
          ];
    if (inline.kind === "misprint" && "math" in inline) {
      const meant = misprintNotes().get(inline.recordId)?.formula?.reading;
      return [{ latex: inline.math.latex }, ...(meant === undefined ? [] : [{ latex: meant }])];
    }
    const nested = (inline as { inlines?: readonly Inline[] }).inlines;
    return Array.isArray(nested) ? inlineFormulaSites(nested) : [];
  });
}

export type InlineOccurrence = InlineScope &
  Readonly<{ latex: string; face: "german" | "english" }>;

export type PaperInlineHolders = Readonly<{
  /** Every holder id (block, sentence, unit) to the scope key it is read in. */
  holders: Readonly<Record<string, string>>;
  occurrences: readonly InlineOccurrence[];
}>;

/** Every inline formula of a paper's German blocks and English units, with the scope it is read in. */
export function paperInlineHolders(
  paper: string,
  edition: Pick<BilingualEdition, "blocks" | "units">,
): PaperInlineHolders {
  const holders: Record<string, string> = {};
  const occurrences: InlineOccurrence[] = [];
  const scopeOfBlock = new Map<string, Omit<InlineScope, "where">>();
  const equationBlocks = new Set<string>();
  for (const block of edition.blocks as readonly Holder[]) {
    if (block.kind === "equation") {
      equationBlocks.add(block.id);
      continue;
    }
    const scope = { paper, anchor: block.containedIn ?? block.id, section: block.section ?? "" };
    scopeOfBlock.set(block.id, scope);
    holders[block.id] = scopeKey(scope);
    for (const sentence of block.sentenceSpans ?? []) {
      scopeOfBlock.set(sentence.id, scope);
      holders[sentence.id] = scopeKey(scope);
    }
    for (const { latex, occurrence } of inlineFormulaSites(block.inlines))
      occurrences.push({
        ...scope,
        where: block.id,
        latex,
        face: "german",
        ...(occurrence === undefined ? {} : { occurrence }),
      });
  }
  for (const unit of edition.units as readonly Holder[]) {
    // A unit that translates an equation block prints that display: content/display-terms colours
    // it, as on the German face.
    if ((unit.sourceRefs ?? []).some((r) => equationBlocks.has(r.id))) continue;
    const german = (unit.sourceRefs ?? []).map((r) => scopeOfBlock.get(r.id)).find(Boolean);
    const scope = german ?? { paper, anchor: unit.id, section: "" };
    holders[unit.id] = scopeKey(scope);
    for (const { latex, occurrence } of inlineFormulaSites(unit.inlines))
      occurrences.push({
        ...scope,
        where: unit.id,
        latex,
        face: "english",
        ...(occurrence === undefined ? {} : { occurrence }),
      });
  }
  return { holders, occurrences };
}

export type InlineCensus = Readonly<{
  /** Every inline formula printed, German and English. */
  formulas: number;
  german: number;
  english: number;
  coloured: number;
  /** Every atom a declared non-quantity or a listed exception: plain on purpose. */
  plainDeclared: number;
  /**
   * Whole formulas that are a number the paper prints in its prose, carrying what they are the
   * value of (dispatch 302). Counted apart from `coloured`, because a numeral is not a symbol, and
   * apart from `plainDeclared`, because it is not left plain.
   */
  valued: number;
  refused: number;
}>;

/** Each quantity an inline formula binds, with the glyphs and the first scope it is printed in. */
export type InlineQuantityUse = Readonly<{
  glyphs: readonly string[];
  scope: Readonly<{ anchor: string; section: string }>;
}>;

export type PaperInlines = Readonly<{
  paper: string;
  holders: Readonly<Record<string, string>>;
  /** Keyed by scope key and LaTeX, joined by a NUL. */
  formulas: Readonly<Record<string, CompiledInline>>;
  /**
   * Where one paragraph prints one LaTeX at named occurrences, their ids in printed order, keyed by
   * scope and LaTeX (am-rse2). A result card quotes a paragraph from its text and has no inline
   * record to read an id from, so it counts printings instead: the nth `X` of this paragraph is the
   * nth id here. Empty for every paragraph whose formulas are not named, which is all but one.
   */
  occurrences: Readonly<Record<string, readonly string[]>>;
  quantities: Readonly<Record<string, InlineQuantityUse>>;
  problems: readonly InlineTermsProblem[];
  census: InlineCensus;
}>;

/** One paper's inline formulas, resolved in their scopes and compiled where nothing is refused. */
export async function checkPaperInlines(
  root: string,
  paper: string,
  overrides: Readonly<{
    edition?: Pick<BilingualEdition, "blocks" | "units">;
    concordance?: readonly ConcordanceEntry[];
    exceptions?: readonly InlineException[];
    values?: readonly InlineValue[];
  }> = {},
): Promise<PaperInlines> {
  const edition = overrides.edition ?? (await loadBilingualEdition(paper, root));
  const { holders, occurrences } = paperInlineHolders(paper, edition ?? { blocks: [], units: [] });
  const context = {
    concordance: overrides.concordance ?? loadConcordanceForPaper(paper).entries,
    isRegistered: isRegisteredQuantityId,
    exceptions: overrides.exceptions ?? loadInlineExceptions(root),
  };
  // What each number printed in the prose is the value of, keyed by the paragraph and the formula.
  const values = inlineValuesByScope(overrides.values ?? loadInlineValues(root), paper);
  const formulas: Record<string, CompiledInline> = {};
  const quantities: Record<
    string,
    { glyphs: string[]; scope: { anchor: string; section: string } }
  > = {};
  const refusedKeys = new Set<string>();
  const occurrenceOrder: Record<string, string[]> = {};
  const problems: InlineTermsProblem[] = [];
  // Each label's id on the page (dispatch 280, step 1b): one per reading and section, so a point A
  // of § 1 lights with every other A of § 1 and never with the A of § 7, which is an amplitude. It
  // is derived, not counted, so an explanation panel resolving the same name as the page renders
  // (explanationInlines.ts) reaches the same id and lights with it (inlineLabels.ts).
  const census = {
    formulas: 0,
    german: 0,
    english: 0,
    coloured: 0,
    plainDeclared: 0,
    valued: 0,
    refused: 0,
  };
  for (const at of occurrences) {
    census.formulas++;
    census[at.face]++;
    const key = formulaKey(scopeKey(at), at.latex, at.occurrence);
    if (at.occurrence !== undefined && at.face === "german") {
      const shared = formulaKey(scopeKey(at), at.latex);
      const ordered = occurrenceOrder[shared] ?? [];
      if (!ordered.includes(at.occurrence)) ordered.push(at.occurrence);
      occurrenceOrder[shared] = ordered;
    }
    if (!formulas[key] && !refusedKeys.has(key)) {
      const read = resolveInlineTerms(at.latex, at, context);
      const resolved = {
        ...read,
        labels: read.labels.map((l) => ({
          ...l,
          labelId: inlineLabelId(l.source, at.section),
        })),
      };
      if (resolved.problems.length > 0) {
        refusedKeys.add(key);
        problems.push(...resolved.problems);
      } else {
        const compiledHere = compileInlineFormula(resolved);
        const value = values.get(`${at.anchor}\u0000${at.latex}`);
        formulas[key] = value
          ? {
              ...compiledHere,
              value: {
                ...(value.quantityId === undefined ? {} : { quantityId: value.quantityId }),
                note: value.note,
              },
            }
          : compiledHere;
        for (const term of resolved.terms) {
          const use = quantities[term.quantityId] ?? {
            glyphs: [],
            scope: { anchor: at.anchor, section: at.section },
          };
          quantities[term.quantityId] = use;
          if (!use.glyphs.includes(term.glyph)) use.glyphs.push(term.glyph);
        }
      }
    }
    const compiled = formulas[key];
    if (!compiled) census.refused++;
    else if (compiled.terms.length > 0) census.coloured++;
    else if (compiled.value) census.valued++;
    else census.plainDeclared++;
  }
  return {
    paper,
    holders,
    formulas,
    quantities,
    occurrences: occurrenceOrder,
    problems,
    census,
  };
}

/** What the page's inspector says about a quantity an inline formula binds (InlineTermLighting). */
export type InlineQuantityFacts = Readonly<{
  name: string;
  /** The glyph as first printed, drawn at build time so the reader ships no KaTeX. */
  glyphHtml: string;
  facts: TermFacts;
  /** Its entry on /notation/, and what the letter means there where the entry says. */
  href: string;
  hrefMeaning?: string | undefined;
}>;

/**
 * Each inline quantity's facts, as a printed display's are found where no model record names the
 * quantity (paperDisplays.ts, dispatch 250): the registry, the reader description, and what each
 * printed letter means in the scope it is first printed in.
 */
export function inlineQuantityFacts(
  root: string,
  inlines: Pick<PaperInlines, "paper" | "quantities">,
  options: Readonly<{ firstUse?: (paper: string, anchor: string) => string | null }> = {},
): Readonly<Record<string, InlineQuantityFacts>> {
  const registry = getQuantityRegistry().quantities;
  const descriptions = loadReaderDescriptions(root, isRegisteredQuantityId);
  const concordance = loadConcordanceForPaper(inlines.paper).entries;
  const out: Record<string, InlineQuantityFacts> = {};
  for (const [quantityId, use] of Object.entries(inlines.quantities)) {
    const quantity = registry.get(quantityId);
    const [glyph] = use.glyphs;
    if (!quantity || glyph === undefined) continue;
    const link = notationLink(concordance, glyph, quantityId, use.scope, inlines.paper);
    out[quantityId] = {
      name: quantity.name,
      glyphHtml: renderToString(glyph, {
        output: "html",
        throwOnError: true,
        strict: "error",
        trust: false,
        maxExpand: 100,
        maxSize: 10,
      }),
      facts: fallbackTermFacts({
        paper: inlines.paper,
        quantity,
        about: descriptions.get(quantityId),
        notation: notationFor(concordance, use.glyphs, quantityId, use.scope, options.firstUse),
      }),
      href: link.href,
      ...(link.meaning ? { hrefMeaning: link.meaning } : {}),
    };
  }
  return out;
}

export class InlineTermsBuildError extends Error {
  readonly code: "inline-terms-build-refused";
  constructor(code: "inline-terms-build-refused", message: string) {
    super(`${code}: ${message}`);
    this.name = "InlineTermsBuildError";
    this.code = code;
  }
}

/** Stops the build on any refusal in an enforced paper, naming every one. */
export function assertInlinesPublishable(
  papers: readonly PaperInlines[],
  enforced: readonly string[] = ENFORCED_INLINE_PAPERS,
): void {
  const refused = papers
    .filter((p) => enforced.includes(p.paper))
    .flatMap((p) => p.problems.map((problem) => problem.message));
  if (refused.length > 0)
    throw new InlineTermsBuildError(
      "inline-terms-build-refused",
      `${refused.length} inline glyph(s) have no single reading:\n${refused.join("\n")}`,
    );
}
