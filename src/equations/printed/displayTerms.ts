/**
 * PRINTED DISPLAYS IN COLOUR (dispatch 224; the owner: "all the equations should be done in the
 * nice colored equation format that's interactive with hover over and all that stuff").
 *
 * A printed display is Einstein's formula as transcribed, on the German, English, parallel and
 * gloss faces. Its LaTeX stays the transcription byte for byte: the term bindings live beside it,
 * in content/display-terms/<paper>.yaml, one entry per display, and never in the source block, so
 * the ledger and the German/English byte-identity rule are untouched. An entry names:
 *
 * - `latex`, a copy of the printed LaTeX, which must equal the source block's exactly. A changed
 *   transcription fails the build here instead of colouring a formula the entry was not written
 *   for;
 * - `spoken`, the display's authored spoken form (AGENTS.md: generated speech is often wrong for
 *   physics notation);
 * - `terms`, each printed glyph and the exact canonical quantity id it binds IN THIS DISPLAY'S
 *   SCOPE. Where the notation concordance has an entry for the glyph in that scope, the two must
 *   agree: Einstein's φ is the §8 propagation angle in the cited formula of mass-energy ¶5 and the
 *   emission angle from ¶7 on, and a record that said otherwise would be refused;
 * - `notQuantities`, glyphs that name no quantity (a differential d, the number π), each with its
 *   reason. The file may declare them once for every display.
 *
 * Every letter of the display must be bound or declared, so no glyph is left uncoloured by
 * accident, and every binding must be used, so a stale entry cannot sit unnoticed. Glyphs are found
 * by reading the LaTeX into atoms (latex/printedAtoms.ts), never by replacing letters.
 *
 * A content author adds a display's colours by adding its entry to the YAML file. No code changes.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import { scopeMatches } from "../../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  glyphSignature,
  markPrintedLatex,
  PrintedAtomError,
  printedAtoms,
} from "../latex/printedAtoms.ts";
import { withQuantityIds } from "../termQuantities.ts";

export type DisplayTermBinding = Readonly<{ glyph: string; quantityId: string }>;
export type NotAQuantity = Readonly<{ glyph: string; reason: string }>;

export type DisplayTermsEntry = Readonly<{
  display: string;
  latex: string;
  spoken: string;
  terms: readonly DisplayTermBinding[];
  notQuantities: readonly NotAQuantity[];
}>;

export type DisplayTermsFile = Readonly<{
  paper: string;
  /** Glyphs that name no quantity in any display of this paper. */
  notQuantities: readonly NotAQuantity[];
  displays: readonly DisplayTermsEntry[];
}>;

export type DisplayTermsCode =
  | "display-terms-shape"
  | "display-terms-paper-mismatch"
  | "display-terms-duplicate-display"
  | "display-terms-unknown-display"
  | "display-terms-transcription-changed"
  | "display-terms-no-spoken"
  | "display-terms-glyph"
  | "display-terms-duplicate-glyph"
  | "display-terms-unregistered-quantity"
  | "display-terms-concordance-conflict"
  | "display-terms-unbound-glyph"
  | "display-terms-unused-glyph"
  | "display-terms-term-dropped"
  | "display-terms-mathml-changed"
  | "display-terms-invalid"
  | "display-terms-key-collision";

export type DisplayTermsProblem = Readonly<{
  code: DisplayTermsCode;
  display: string;
  message: string;
}>;

export class DisplayTermsError extends Error {
  readonly code: DisplayTermsCode;
  /** The code is the FIRST argument, as a kebab-case string literal, per the am-p465 ruling. */
  constructor(code: DisplayTermsCode, message: string) {
    super(message);
    this.name = "DisplayTermsError";
    this.code = code;
  }
}

export const DISPLAY_TERMS_DIR = join("content", "display-terms");

/** A malformed file: every shape check in parseDisplayTerms refuses through here. */
function malformed(message: string): never {
  throw new DisplayTermsError("display-terms-shape", message);
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

function onlyKeys(o: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(o))
    if (!allowed.includes(key)) malformed(`${where}: unknown field "${key}".`);
}

function text(o: Record<string, unknown>, key: string, where: string): string {
  const value = o[key];
  if (typeof value !== "string") malformed(`${where}: "${key}" must be a string.`);
  return value;
}

function notQuantities(value: unknown, where: string): readonly NotAQuantity[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) malformed(`${where}: notQuantities must be a list.`);
  return value.map((item, i) => {
    const at = `${where} notQuantities[${i}]`;
    if (!isRecord(item)) malformed(`${at}: not a map.`);
    onlyKeys(item, ["glyph", "reason"], at);
    const reason = text(item, "reason", at).trim();
    if (!reason) malformed(`${at}: a declaration needs a reason.`);
    return { glyph: text(item, "glyph", at), reason };
  });
}

/** A parsed file, or a thrown DisplayTermsError naming the first malformed field. */
export function parseDisplayTerms(raw: unknown, where: string): DisplayTermsFile {
  if (!isRecord(raw)) malformed(`${where}: not a map.`);
  onlyKeys(raw, ["paper", "notQuantities", "displays"], where);
  if (!Array.isArray(raw.displays)) malformed(`${where}: displays must be a list.`);
  return {
    paper: text(raw, "paper", where),
    notQuantities: notQuantities(raw.notQuantities, where),
    displays: raw.displays.map((entry, i) => {
      const at = `${where} displays[${i}]`;
      if (!isRecord(entry)) malformed(`${at}: not a map.`);
      onlyKeys(entry, ["display", "latex", "spoken", "terms", "notQuantities"], at);
      if (!Array.isArray(entry.terms)) malformed(`${at}: terms must be a list.`);
      const display = text(entry, "display", at);
      return {
        display,
        latex: text(entry, "latex", at),
        spoken: text(entry, "spoken", at),
        terms: entry.terms.map((term, j) => {
          const t = `${at} (${display}) terms[${j}]`;
          if (!isRecord(term)) malformed(`${t}: not a map.`);
          onlyKeys(term, ["glyph", "quantityId"], t);
          return { glyph: text(term, "glyph", t), quantityId: text(term, "quantityId", t) };
        }),
        notQuantities: notQuantities(entry.notQuantities, `${at} (${display})`),
      };
    }),
  };
}

/** The paper's display-terms file, or null when it has none yet. */
export function loadDisplayTerms(root: string, paper: string): DisplayTermsFile | null {
  const path = join(root, DISPLAY_TERMS_DIR, `${paper}.yaml`);
  if (!existsSync(path)) return null;
  const where = `content/display-terms/${paper}.yaml`;
  return parseDisplayTerms(strictParse(readFileSync(path, "utf8"), "yaml", where), where);
}

/** One place a display is printed: a German source block, or an English translation unit. */
export type DisplayOccurrence = Readonly<{
  /** The block or unit that prints it. */
  where: string;
  latex: string;
  /** The concordance scope it is read in: its paragraph, and its section. */
  anchor: string;
  section: string;
}>;

type Holder = Readonly<{
  id: string;
  kind?: string | undefined;
  inlines: readonly Inline[];
  diplomaticText?: string | undefined;
  section?: string | undefined;
  containedIn?: string | undefined;
}>;

function mathInlines(inlines: readonly Inline[]): { latex: string; equationId: string }[] {
  return inlines.flatMap((inline) => {
    if (inline.kind === "math")
      return typeof inline.equationId === "string"
        ? [{ latex: inline.latex, equationId: inline.equationId }]
        : [];
    const nested = (inline as { inlines?: readonly Inline[] }).inlines;
    return Array.isArray(nested) ? mathInlines(nested) : [];
  });
}

/**
 * Every place each display is printed, keyed by display id. A German equation block is read in the
 * paragraph it belongs to (containedIn); a paragraph that carries the display inline, in itself.
 * An English unit carries no section, so its scope is the German one found for the same display.
 */
export function displayOccurrences(
  blocks: readonly Holder[],
  units: readonly Holder[] = [],
): ReadonlyMap<string, readonly DisplayOccurrence[]> {
  const out = new Map<string, DisplayOccurrence[]>();
  const add = (id: string, o: DisplayOccurrence) => out.set(id, [...(out.get(id) ?? []), o]);
  for (const block of blocks) {
    const scope = { anchor: block.containedIn ?? block.id, section: block.section ?? "" };
    for (const math of mathInlines(block.inlines))
      add(math.equationId, { where: block.id, latex: math.latex, ...scope });
    // An equation block's diplomatic text is what the gloss face draws (SourceBlock.tsx).
    if (
      block.kind === "equation" &&
      typeof block.diplomaticText === "string" &&
      block.diplomaticText
    )
      add(block.id, {
        where: `${block.id} (diplomaticText)`,
        latex: block.diplomaticText,
        ...scope,
      });
  }
  for (const unit of units)
    for (const math of mathInlines(unit.inlines)) {
      const german = out.get(math.equationId)?.[0];
      add(math.equationId, {
        where: unit.id,
        latex: math.latex,
        anchor: german?.anchor ?? unit.id,
        section: german?.section ?? "",
      });
    }
  return out;
}

export type CheckedTerm = Readonly<{
  termId: string;
  quantityId: string;
  glyph: string;
  start: number;
  end: number;
}>;

export type CheckedDisplay = Readonly<{
  paper: string;
  display: string;
  latex: string;
  spoken: string;
  /** Every coloured occurrence, in reading order. */
  terms: readonly CheckedTerm[];
}>;

export type DisplayTermsContext = Readonly<{
  occurrences: ReadonlyMap<string, readonly DisplayOccurrence[]>;
  concordance: readonly ConcordanceEntry[];
  isRegistered: (quantityId: string) => boolean;
}>;

/** The concordance's binding for a glyph in a scope, where it has exactly one opinion. */
function concordanceBinding(
  entries: readonly ConcordanceEntry[],
  signature: string,
  scope: DisplayOccurrence,
): { id: string; binds: string } | undefined {
  const opinions = entries.flatMap((entry) => {
    if (!scopeMatches(entry.scope, scope.anchor, scope.section)) return [];
    let entrySignature: string;
    try {
      entrySignature = glyphSignature(entry.glyph.latex);
    } catch {
      // An entry for an expression (L/2, K_0 - K_1, \cos\varphi) says nothing about one atom.
      return [];
    }
    if (entrySignature !== signature) return [];
    const binds =
      "quantityId" in entry.binding
        ? entry.binding.quantityId
        : `not a quantity (${entry.binding.nonQuantityKind})`;
    return [{ id: entry.id, binds }];
  });
  return opinions[0];
}

/**
 * Checks every entry of a paper's file against its printed source, the quantity registry and the
 * notation concordance. Returns the displays that passed, and every problem found by name.
 */
export function checkDisplayTerms(
  file: DisplayTermsFile,
  paper: string,
  context: DisplayTermsContext,
): { displays: readonly CheckedDisplay[]; problems: readonly DisplayTermsProblem[] } {
  const problems: DisplayTermsProblem[] = [];
  const displays: CheckedDisplay[] = [];
  const problem = (code: DisplayTermsCode, display: string, message: string) =>
    problems.push({ code, display, message: `${paper} ${display}: ${message}` });
  if (file.paper !== paper)
    problem("display-terms-paper-mismatch", "*", `the file names paper "${file.paper}".`);
  const seen = new Set<string>();
  const signatureOf = (glyph: string, display: string): string | undefined => {
    try {
      return glyphSignature(glyph);
    } catch (error) {
      problem(
        "display-terms-glyph",
        display,
        error instanceof PrintedAtomError ? error.message : String(error),
      );
      return undefined;
    }
  };
  const paperWide = new Map<string, NotAQuantity>();
  for (const declared of file.notQuantities) {
    const signature = signatureOf(declared.glyph, "*");
    if (signature) paperWide.set(signature, declared);
  }
  for (const entry of file.displays) {
    const { display } = entry;
    const before = problems.length;
    if (seen.has(display)) {
      problem("display-terms-duplicate-display", display, "listed twice.");
      continue;
    }
    seen.add(display);
    const printed = context.occurrences.get(display) ?? [];
    if (printed.length === 0) {
      problem("display-terms-unknown-display", display, "no source block prints this display.");
      continue;
    }
    // The display's own equation block is the transcription the entry copies, byte for byte.
    const own = printed.find((at) => at.where === display) ?? (printed[0] as DisplayOccurrence);
    if (own.latex !== entry.latex)
      problem(
        "display-terms-transcription-changed",
        display,
        `${own.where} prints ${JSON.stringify(own.latex)}, and the entry was written for ${JSON.stringify(entry.latex)}. Check the bindings against the new transcription and copy it into the entry.`,
      );
    if (!entry.spoken.trim())
      problem("display-terms-no-spoken", display, "an authored spoken form is required.");
    const scope = printed[0] as DisplayOccurrence;
    // Signature to what the entry says about it: a quantity, or a declared non-quantity.
    const bound = new Map<string, DisplayTermBinding>();
    const declared = new Map<string, NotAQuantity>();
    for (const term of entry.terms) {
      const signature = signatureOf(term.glyph, display);
      if (!signature) continue;
      if (bound.has(signature)) {
        problem("display-terms-duplicate-glyph", display, `"${term.glyph}" is bound twice.`);
        continue;
      }
      bound.set(signature, term);
      if (!context.isRegistered(term.quantityId))
        problem(
          "display-terms-unregistered-quantity",
          display,
          `"${term.glyph}" binds "${term.quantityId}", which is not a registered quantity id (content/quantities/).`,
        );
      const opinion = concordanceBinding(context.concordance, signature, scope);
      if (opinion && opinion.binds !== term.quantityId)
        problem(
          "display-terms-concordance-conflict",
          display,
          `"${term.glyph}" binds ${term.quantityId}, and the concordance entry ${opinion.id} reads it as ${opinion.binds} in ${scope.anchor}.`,
        );
    }
    for (const item of entry.notQuantities) {
      const signature = signatureOf(item.glyph, display);
      if (!signature) continue;
      if (bound.has(signature) || declared.has(signature))
        problem(
          "display-terms-duplicate-glyph",
          display,
          `"${item.glyph}" is both bound and declared, or declared twice.`,
        );
      else declared.set(signature, item);
    }
    let atoms: ReturnType<typeof printedAtoms> = [];
    try {
      atoms = printedAtoms(entry.latex);
    } catch (error) {
      problem(
        "display-terms-glyph",
        display,
        error instanceof Error ? error.message : String(error),
      );
    }
    const used = new Set<string>();
    const terms: CheckedTerm[] = [];
    /** For each atom, the index in terms of its coloured occurrence, if it is bound. */
    const termOfAtom: (number | undefined)[] = [];
    for (const atom of atoms) {
      const term = bound.get(atom.signature);
      if (term) {
        used.add(atom.signature);
        termOfAtom.push(terms.length);
        terms.push({
          termId: `${paper}.${display}.t${terms.length + 1}`,
          quantityId: term.quantityId,
          glyph: term.glyph,
          start: atom.start,
          end: atom.end,
        });
        continue;
      }
      termOfAtom.push(undefined);
      if (declared.has(atom.signature)) {
        used.add(atom.signature);
        continue;
      }
      if (paperWide.has(atom.signature)) continue;
      problem(
        "display-terms-unbound-glyph",
        display,
        `"${atom.text}" at offset ${atom.start} is neither bound to a quantity nor declared as notQuantities with a reason.`,
      );
    }
    for (const [signature, term] of bound)
      if (!used.has(signature))
        problem("display-terms-unused-glyph", display, `"${term.glyph}" is bound but not printed.`);
    for (const [signature, item] of declared)
      if (!used.has(signature))
        problem(
          "display-terms-unused-glyph",
          display,
          `"${item.glyph}" is declared but not printed.`,
        );
    // A copy printed elsewhere (a paragraph that carries the display inline, an English unit) may
    // differ from the block only in bytes that are not letters, such as the comma the paragraph
    // prints after it. It shares the bindings atom for atom; a letter that differs is a changed
    // transcription.
    const variants = new Map<string, CheckedTerm[]>();
    const signatures = atoms.map((a) => a.signature).join("\u0000");
    for (const at of printed) {
      if (at.latex === entry.latex || variants.has(at.latex)) continue;
      let copy: ReturnType<typeof printedAtoms> = [];
      try {
        copy = printedAtoms(at.latex);
      } catch {
        // Reported below as a changed transcription.
      }
      if (copy.map((a) => a.signature).join("\u0000") !== signatures) {
        problem(
          "display-terms-transcription-changed",
          display,
          `${at.where} prints ${JSON.stringify(at.latex)}, whose letters differ from the entry's ${JSON.stringify(entry.latex)}.`,
        );
        continue;
      }
      variants.set(
        at.latex,
        copy.flatMap((atom, k) => {
          const index = termOfAtom[k];
          const term = index === undefined ? undefined : terms[index];
          return term ? [{ ...term, start: atom.start, end: atom.end }] : [];
        }),
      );
    }
    if (problems.length === before) {
      const spoken = entry.spoken.trim();
      displays.push({ paper, display, latex: entry.latex, spoken, terms });
      for (const [latex, copyTerms] of variants)
        displays.push({ paper, display, latex, spoken, terms: copyTerms });
    }
  }
  return { displays, problems };
}

/** The printed glyph of a legend line, drawn at build time so the reader ships no KaTeX. */
function glyphHtml(glyph: string): string {
  return renderToString(glyph, {
    output: "html",
    throwOnError: true,
    strict: "error",
    trust: false,
    maxExpand: 100,
    maxSize: 10,
  });
}

/** The KaTeX options every face renders a printed display with (SourceBlock.tsx and the others). */
export const FACE_KATEX = Object.freeze({
  displayMode: true,
  output: "htmlAndMathml" as const,
  throwOnError: false,
  strict: "warn" as const,
  trust: false,
});

/** The MathML's structure, up to the TeX annotation (which carries the source it was drawn from). */
function mathmlStructure(html: string): string {
  const start = html.indexOf('<span class="katex-mathml">');
  const end = html.indexOf("<annotation", start);
  return start < 0 || end < 0 ? "" : html.slice(start, end);
}

const KATEX_HTML = '<span class="katex-html" aria-hidden="true">';
const DISPLAY_CLOSE = "</span></span>";

/** Where the visual part of a display render begins and ends: the katex-html span. */
function visualSpan(html: string): { start: number; end: number } | undefined {
  const start = html.indexOf(KATEX_HTML);
  return start < 0 || !html.endsWith(DISPLAY_CLOSE)
    ? undefined
    : { start, end: html.length - DISPLAY_CLOSE.length };
}

export type CompiledPrintedDisplay = Readonly<{
  paper: string;
  display: string;
  latex: string;
  spoken: string;
  /** KaTeX HTML and MathML, each bound glyph wrapped with data-term and data-quantity-id. */
  html: string;
  terms: readonly Readonly<{ termId: string; quantityId: string }>[];
  /** Each quantity once per glyph, in the order it first appears, with the glyph as printed. */
  legend: readonly Readonly<{ quantityId: string; glyph: string; glyphHtml: string }>[];
}>;

/**
 * The display drawn with its terms marked: the unmarked render, whose visual part is replaced by the
 * marked render's. So the MathML, TeX annotation included, is exactly what the face printed before,
 * and the marked MathML is checked to have the same structure, so the colouring cannot change what
 * assistive technology reads. A term KaTeX dropped fails here rather than publishing a formula that
 * is silently not interactive.
 */
export function compilePrintedDisplay(checked: CheckedDisplay): CompiledPrintedDisplay {
  const allowed = new Set(checked.terms.map((t) => t.termId));
  const marked = markPrintedLatex(
    checked.latex,
    checked.terms.map(({ start, end, termId }) => ({ start, end, termId })),
  );
  const html = renderToString(marked, {
    ...FACE_KATEX,
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
      throw new DisplayTermsError(
        "display-terms-term-dropped",
        `${checked.paper} ${checked.display}: the render dropped ${id}.`,
      );
  const plain = renderToString(checked.latex, FACE_KATEX);
  const markedVisual = visualSpan(html);
  const plainVisual = visualSpan(plain);
  if (
    !markedVisual ||
    !plainVisual ||
    mathmlStructure(html) === "" ||
    mathmlStructure(html) !== mathmlStructure(plain)
  )
    throw new DisplayTermsError(
      "display-terms-mathml-changed",
      `${checked.paper} ${checked.display}: marking changed the MathML, or the render is not a display.`,
    );
  const drawn =
    plain.slice(0, plainVisual.start) +
    html.slice(markedVisual.start, markedVisual.end) +
    plain.slice(plainVisual.end);
  const seen = new Set<string>();
  const legend = checked.terms.flatMap((t) => {
    const key = `${t.quantityId}\u0000${t.glyph}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ quantityId: t.quantityId, glyph: t.glyph, glyphHtml: glyphHtml(t.glyph) }];
  });
  const terms = checked.terms.map(({ termId, quantityId }) => ({ termId, quantityId }));
  return {
    paper: checked.paper,
    display: checked.display,
    latex: checked.latex,
    spoken: checked.spoken,
    html: withQuantityIds(drawn, terms),
    terms,
    legend,
  };
}
