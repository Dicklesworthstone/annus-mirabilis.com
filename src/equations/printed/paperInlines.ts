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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { loadReaderDescriptions } from "../../content/quantities/readerDescriptions.ts";
import { getQuantityRegistry, isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { type BilingualEdition, loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { glyphSignature } from "../latex/printedAtoms.ts";
import type { TermFacts } from "../termFacts.ts";
import { fallbackTermFacts, notationFor, notationLink } from "./fallbackFacts.ts";
import {
  type CompiledInline,
  compileInlineFormula,
  type InlineException,
  type InlineScope,
  type InlineTermsProblem,
  resolveInlineTerms,
} from "./inlineTerms.ts";

export const INLINE_EXCEPTIONS_PATH = join("content", "inline-terms", "exceptions.yaml");

/**
 * Papers whose every inline formula is coloured or declared: a refusal stops the build, and only
 * these are drawn in colour (scripts/build-equations.ts), so a paper turns over whole. A paper joins
 * when its concordance reads every glyph its formulas print.
 */
export const ENFORCED_INLINE_PAPERS: readonly string[] = ["mass-energy"];

export type InlineExceptionsCode =
  | "inline-exceptions-not-a-list"
  | "inline-exceptions-no-paper"
  | "inline-exceptions-glyph-not-one-atom"
  | "inline-exceptions-no-scope"
  | "inline-exceptions-no-reason";

export class InlineExceptionsError extends Error {
  readonly code: InlineExceptionsCode;
  constructor(code: InlineExceptionsCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "InlineExceptionsError";
    this.code = code;
  }
}

/** The listed exceptions, each checked: a known paper, one atom, a scope, and a reason. */
export function parseInlineExceptions(raw: unknown, where: string): readonly InlineException[] {
  const list = (raw as { exceptions?: unknown } | null)?.exceptions;
  if (!Array.isArray(list))
    throw new InlineExceptionsError(
      "inline-exceptions-not-a-list",
      `${where}: exceptions must be a list.`,
    );
  return list.map((item, i) => {
    const at = `${where} exceptions[${i}]`;
    const e = (item ?? {}) as Record<string, unknown>;
    if (typeof e.paper !== "string" || !e.paper)
      throw new InlineExceptionsError("inline-exceptions-no-paper", `${at}: paper is required.`);
    const glyph = typeof e.glyph === "string" ? e.glyph : "";
    let oneAtom = true;
    try {
      glyphSignature(glyph);
    } catch {
      oneAtom = false;
    }
    if (!oneAtom)
      throw new InlineExceptionsError(
        "inline-exceptions-glyph-not-one-atom",
        `${at}: "${glyph}" is not one printed name.`,
      );
    if (
      !Array.isArray(e.scope) ||
      e.scope.length === 0 ||
      e.scope.some((s) => typeof s !== "string" || !s)
    )
      throw new InlineExceptionsError(
        "inline-exceptions-no-scope",
        `${at}: scope must list sections, anchors or "all".`,
      );
    if (typeof e.reason !== "string" || e.reason.trim().length < 20)
      throw new InlineExceptionsError(
        "inline-exceptions-no-reason",
        `${at}: a reason of a sentence is required.`,
      );
    return { paper: e.paper, glyph, scope: e.scope as string[], reason: e.reason.trim() };
  });
}

export function loadInlineExceptions(root: string): readonly InlineException[] {
  const path = join(root, INLINE_EXCEPTIONS_PATH);
  if (!existsSync(path)) return [];
  return parseInlineExceptions(
    strictParse(readFileSync(path, "utf8"), "yaml", INLINE_EXCEPTIONS_PATH),
    INLINE_EXCEPTIONS_PATH,
  );
}

/** The scope key a holder names: one render per scope and LaTeX. */
export function scopeKey(scope: Pick<InlineScope, "paper" | "anchor" | "section">): string {
  return `${scope.paper}|${scope.anchor}|${scope.section}`;
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

/** The LaTeX of every inline (not display) formula in these inlines, in reading order. */
export function inlineFormulas(inlines: readonly Inline[]): string[] {
  return inlines.flatMap((inline) => {
    if (inline.kind === "math") return inline.display === true ? [] : [inline.latex];
    const nested = (inline as { inlines?: readonly Inline[] }).inlines;
    return Array.isArray(nested) ? inlineFormulas(nested) : [];
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
    for (const latex of inlineFormulas(block.inlines))
      occurrences.push({ ...scope, where: block.id, latex, face: "german" });
  }
  for (const unit of edition.units as readonly Holder[]) {
    // A unit that translates an equation block prints that display: content/display-terms colours
    // it, as on the German face.
    if ((unit.sourceRefs ?? []).some((r) => equationBlocks.has(r.id))) continue;
    const german = (unit.sourceRefs ?? []).map((r) => scopeOfBlock.get(r.id)).find(Boolean);
    const scope = german ?? { paper, anchor: unit.id, section: "" };
    holders[unit.id] = scopeKey(scope);
    for (const latex of inlineFormulas(unit.inlines))
      occurrences.push({ ...scope, where: unit.id, latex, face: "english" });
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
  }> = {},
): Promise<PaperInlines> {
  const edition = overrides.edition ?? (await loadBilingualEdition(paper, root));
  const { holders, occurrences } = paperInlineHolders(paper, edition ?? { blocks: [], units: [] });
  const context = {
    concordance: overrides.concordance ?? loadConcordanceForPaper(paper).entries,
    isRegistered: isRegisteredQuantityId,
    exceptions: overrides.exceptions ?? loadInlineExceptions(root),
  };
  const formulas: Record<string, CompiledInline> = {};
  const quantities: Record<
    string,
    { glyphs: string[]; scope: { anchor: string; section: string } }
  > = {};
  const refusedKeys = new Set<string>();
  const problems: InlineTermsProblem[] = [];
  const census = { formulas: 0, german: 0, english: 0, coloured: 0, plainDeclared: 0, refused: 0 };
  for (const at of occurrences) {
    census.formulas++;
    census[at.face]++;
    const key = `${scopeKey(at)}\u0000${at.latex}`;
    if (!formulas[key] && !refusedKeys.has(key)) {
      const resolved = resolveInlineTerms(at.latex, at, context);
      if (resolved.problems.length > 0) {
        refusedKeys.add(key);
        problems.push(...resolved.problems);
      } else {
        formulas[key] = compileInlineFormula(resolved);
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
    else census.plainDeclared++;
  }
  return { paper, holders, formulas, quantities, problems, census };
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
