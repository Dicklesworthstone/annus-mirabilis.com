/**
 * A laboratory's formulas through the inline resolver (dispatch 274; the owner: "I still see a ton
 * of equations that aren't properly using the colored equations with latex system like in
 * classic-patents.com").
 *
 * SCOPE. A lab's formula is read in the notation of the paper and sections its manifest names
 * (content/experiments/<lab>.yaml, sourceRefs). A lab that names several sections of its paper is
 * tried in each, and the reading with fewest refusals is kept (the first named on a tie), so a
 * glyph a section defines is read in that section and never borrowed from a neighbour silently:
 * the resolver itself still refuses a glyph with two readings at one level.
 *
 * THE LAB'S OWN LETTERS. Resolving is not being right: a lab writes some letters in a sense its
 * paper's notation does not give them there (relativity's labs write β for v/V, where the paper
 * prints β as the factor the moderns call γ). content/inline-terms/labs.yaml holds what is true in
 * one lab only, each entry read against the page that writes it and carrying its reason:
 * - a READING binds the letter to a registered quantity, in place of the paper's readings of it;
 * - an UNREAD entry withdraws the paper's readings of the letter, where it means something the
 *   paper's colours have no slot for, so the letter is refused and named rather than coloured
 *   wrong;
 * - an EXCEPTION names a sign that is no quantity (a point), left in neutral ink.
 * A formula the lab quotes as the paper prints it (`printed`) is read in the paper's notation alone.
 *
 * RESULT. Resolved: the formula drawn with its terms marked (compileInlineFormula), in inline or
 * display mode. Refused: the resolver's problems, each naming the lab and the glyph. The component
 * then prints the formula as before and lists the glyphs on it (data-inline-refused), so a formula
 * is coloured or named, never plain in silence. The papers' listed signs
 * (content/inline-terms/exceptions.yaml, NavyKite's: π, d, δ) hold in their labs as on the faces; a
 * sign neither that file nor a lab's own exception names is a named refusal.
 *
 * Server-only: it reads the manifest, the concordance and labs.yaml from disk, once per lab and
 * formula.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { QUANTITY_LABELS } from "../../generated/quantity-labels.ts";
import { glyphSignature } from "../latex/printedAtoms.ts";
import {
  type CompiledInline,
  compileInlineFormula,
  type InlineException,
  type InlineTermsContext,
  type InlineTermsProblem,
  type ResolvedInline,
  resolveInlineTerms,
} from "./inlineTerms.ts";
import type { LabFormulaSite } from "./labFormulaSites.ts";
import { modernInlineEntries } from "./modernScope.ts";

/**
 * Whether a quantity id is registered, read from the registry's generated id map rather than the
 * registry itself: a lab page imports this file, and webpack cannot bundle the registry's directory
 * URL (content/quantities/ through import.meta.url), so importing it failed `next build` (NavyKite,
 * mail 41229). The map is generated from the registry by prepare:content, before every build.
 */
const isRegisteredForPage = (quantityId: string): boolean =>
  Object.hasOwn(QUANTITY_LABELS, quantityId);

/** Manifest paper names that are not route slugs. */
const PAPER_SLUGS: Readonly<Record<string, string>> = { relativity: "special-relativity" };

export type LabScope = Readonly<{ paper: string; sections: readonly string[] }>;

export type LabFormula =
  | Readonly<{ kind: "resolved"; compiled: CompiledInline; section: string }>
  | Readonly<{ kind: "refused"; paper: string; problems: readonly InlineTermsProblem[] }>
  | Readonly<{ kind: "unscoped" }>;

const scopes = new Map<string, LabScope | null>();
const formulas = new Map<string, LabFormula>();

/** The paper and sections a lab's manifest names, or null for a lab with no manifest source. */
export function labScope(lab: string, root = process.cwd()): LabScope | null {
  const cached = scopes.get(lab);
  if (cached !== undefined) return cached;
  let scope: LabScope | null = null;
  try {
    const manifest = parseYaml(
      readFileSync(join(root, "content/experiments", `${lab}.yaml`), "utf8"),
    ) as { sourceRefs?: readonly { paper: string; id: string }[] } | null;
    const refs = manifest?.sourceRefs ?? [];
    const first = refs[0];
    if (first) {
      const paper = PAPER_SLUGS[first.paper] ?? first.paper;
      const sections = [
        ...new Set(
          refs.filter((r) => (PAPER_SLUGS[r.paper] ?? r.paper) === paper).map((r) => r.id),
        ),
      ];
      scope = { paper, sections };
    }
  } catch {
    scope = null;
  }
  scopes.set(lab, scope);
  return scope;
}

export const LAB_INLINES_PATH = join("content", "inline-terms", "labs.yaml");

/** A letter one lab reads as a registered quantity of its own. */
export type LabReading = Readonly<{
  lab: string;
  glyph: string;
  quantityId: string;
  reason: string;
}>;
/** A letter one lab withdraws from its paper's readings (unread) or names as no quantity. */
export type LabLetter = Readonly<{ lab: string; glyph: string; reason: string }>;
export type LabInlineTerms = Readonly<{
  readings: readonly LabReading[];
  unread: readonly LabLetter[];
  exceptions: readonly LabLetter[];
}>;

export class LabInlineTermsError extends Error {
  readonly code: "lab-inline-terms-invalid";
  constructor(code: "lab-inline-terms-invalid", message: string) {
    super(`${code}: ${message}`);
    this.name = "LabInlineTermsError";
    this.code = code;
  }
}

function invalid(message: string): never {
  throw new LabInlineTermsError("lab-inline-terms-invalid", message);
}

function signatureOf(glyph: string): string | undefined {
  try {
    return glyphSignature(glyph);
  } catch {
    return undefined;
  }
}

/**
 * labs.yaml's three lists, each entry checked: a lab id, one printed name, a registered quantity
 * for a reading, and a reason of a sentence.
 */
export function parseLabInlineTerms(
  raw: unknown,
  where: string,
  isRegistered: (quantityId: string) => boolean,
): LabInlineTerms {
  const record = (raw ?? {}) as Record<string, unknown>;
  const list = (name: "readings" | "unread" | "exceptions") => {
    const items = record[name] ?? [];
    if (!Array.isArray(items)) invalid(`${where}: ${name} must be a list.`);
    return items.map((item, i) => {
      const at = `${where} ${name}[${i}]`;
      const e = (item ?? {}) as Record<string, unknown>;
      const lab = typeof e.lab === "string" ? e.lab : "";
      if (!/^(lq|bm|sr|me)-\d{2}$/.test(lab)) invalid(`${at}: "${lab}" is not a lab id.`);
      const glyph = typeof e.glyph === "string" ? e.glyph : "";
      if (signatureOf(glyph) === undefined) invalid(`${at}: "${glyph}" is not one printed name.`);
      if (typeof e.reason !== "string" || e.reason.trim().length < 20)
        invalid(`${at}: an entry needs a reason of a sentence.`);
      const quantityId = typeof e.quantityId === "string" ? e.quantityId : "";
      if (name === "readings" && !isRegistered(quantityId))
        invalid(`${at}: "${quantityId}" is not a registered quantity id (content/quantities/).`);
      return { lab, glyph, quantityId, reason: (e.reason as string).trim() };
    });
  };
  return {
    readings: list("readings"),
    unread: list("unread").map(({ lab, glyph, reason }) => ({ lab, glyph, reason })),
    exceptions: list("exceptions").map(({ lab, glyph, reason }) => ({ lab, glyph, reason })),
  };
}

let labFile: LabInlineTerms | null = null;

/** content/inline-terms/labs.yaml, read and checked once per process. */
export function loadLabInlineTerms(root = process.cwd()): LabInlineTerms {
  if (labFile && root === process.cwd()) return labFile;
  const path = join(root, LAB_INLINES_PATH);
  const file = parseLabInlineTerms(
    existsSync(path) ? strictParse(readFileSync(path, "utf8"), "yaml", LAB_INLINES_PATH) : {},
    LAB_INLINES_PATH,
    isRegisteredForPage,
  );
  if (root === process.cwd()) labFile = file;
  return file;
}

/** A lab's reading as a concordance entry, for that lab's context only. */
function asEntry(paper: string, reading: LabReading, index: number): ConcordanceEntry {
  return {
    id: `lab.${reading.lab}.${index}`,
    paper,
    scope: ["all"],
    glyph: { unicode: reading.glyph, latex: reading.glyph },
    meaning: reading.reason,
    binding: { quantityId: reading.quantityId },
    operation: { kind: "rename", target: { form: "symbol", modernGlyph: reading.glyph } },
    sources: { anchor: `lab-${reading.lab}` },
    verification: {
      printed: false,
      checkedAgainst: LAB_INLINES_PATH,
      by: "labInlines.ts",
      date: "",
    },
  };
}

const PAPER_EXCEPTIONS_PATH = join("content", "inline-terms", "exceptions.yaml");
let paperExceptions: readonly InlineException[] | null = null;

/**
 * The papers' listed signs (content/inline-terms/exceptions.yaml, NavyKite's): π, d and the like,
 * which name no quantity, each with its scope, so a lab's formula reads them as the faces do. Read
 * here rather than through paperInlines.ts, whose registry import a page cannot bundle. Every
 * prepare:content checks the file entry by entry (build-equations.ts, checkPaperInlines) and stops
 * on a malformed one, before any page is built; an entry missing a field is not taken here.
 */
function loadPaperExceptions(root = process.cwd()): readonly InlineException[] {
  if (paperExceptions && root === process.cwd()) return paperExceptions;
  const path = join(root, PAPER_EXCEPTIONS_PATH);
  const raw = existsSync(path)
    ? (strictParse(readFileSync(path, "utf8"), "yaml", PAPER_EXCEPTIONS_PATH) as {
        exceptions?: unknown;
      } | null)
    : null;
  const list = Array.isArray(raw?.exceptions) ? (raw.exceptions as unknown[]) : [];
  const exceptions = list.flatMap((item) => {
    const e = (item ?? {}) as Record<string, unknown>;
    return typeof e.paper === "string" &&
      typeof e.glyph === "string" &&
      typeof e.reason === "string" &&
      Array.isArray(e.scope) &&
      e.scope.every((s) => typeof s === "string")
      ? [{ paper: e.paper, glyph: e.glyph, scope: e.scope as string[], reason: e.reason }]
      : [];
  });
  if (root === process.cwd()) paperExceptions = exceptions;
  return exceptions;
}

/**
 * One lab's context: its paper's printed and modern readings and its listed signs; unless the
 * formula is quoted as printed, with each letter the lab reads or withdraws taken out, its readings
 * put in, and its own exceptions.
 */
export function labContext(
  lab: string,
  paper: string,
  printed: boolean,
  file: LabInlineTerms = loadLabInlineTerms(),
): InlineTermsContext {
  // The printed readings, and the modern ones a lab writes in (c, k_B, a rename's letter):
  // modernScope.ts, whose precedence refuses a printed and a modern reading that disagree.
  const paperEntries = modernInlineEntries(paper, loadConcordanceForPaper(paper));
  // Scoped by section or anchor as in the file; the resolver matches the scope.
  const paperSigns = loadPaperExceptions().filter((e) => e.paper === paper);
  if (printed)
    return {
      concordance: paperEntries,
      isRegistered: isRegisteredForPage,
      exceptions: paperSigns,
    };
  const own = file.readings.filter((r) => r.lab === lab);
  const excepted = file.exceptions.filter((e) => e.lab === lab);
  // The resolver consults an exception only where no reading holds, so an exception withdraws the
  // paper's readings of its letter too, as a reading and an unread entry do.
  const withdrawn = new Set(
    [...own, ...file.unread.filter((u) => u.lab === lab), ...excepted].map((r) =>
      signatureOf(r.glyph),
    ),
  );
  const exceptions: InlineException[] = [
    ...paperSigns,
    ...excepted.map((e) => ({ paper, glyph: e.glyph, scope: ["all"], reason: e.reason })),
  ];
  return {
    concordance: [
      ...paperEntries.filter((entry) => !withdrawn.has(signatureOf(entry.glyph.latex))),
      ...own.map((r, i) => asEntry(paper, r, i)),
    ],
    isRegistered: isRegisteredForPage,
    exceptions,
  };
}

const display = ((tex: string, options: object) =>
  renderToString(tex, { ...options, displayMode: true })) as typeof renderToString;

/**
 * A lab's formula, resolved in its lab's scope and compiled, or the refusals that name its gaps.
 * `printed`: the lab quotes the formula as the paper prints it, so it is read in the paper's
 * notation alone, without the lab's own letters.
 */
export function labFormula(
  lab: string,
  latex: string,
  displayMode: boolean,
  printed = false,
): LabFormula {
  const key = `${lab}\u0000${displayMode ? "d" : "i"}${printed ? "p" : ""}\u0000${latex}`;
  const cached = formulas.get(key);
  if (cached) return cached;
  const scope = labScope(lab);
  const result =
    !scope || scope.sections.length === 0
      ? ({ kind: "unscoped" } as const)
      : resolveInSections(
          { paper: scope.paper, sections: scope.sections, where: `lab ${lab}` },
          latex,
          displayMode,
          labContext(lab, scope.paper, printed),
        );
  formulas.set(key, result);
  return result;
}

/**
 * A formula read in the given sections of a paper, in the paper's notation and its listed signs
 * alone (dispatch 274, for GreenBarn's explanation displays, 273): no lab's letters reach it. Tried
 * in each section, keeping the reading with fewest refusals, the first named on a tie.
 */
export function scopedFormula(
  scope: Readonly<{ paper: string; sections: readonly string[]; where: string }>,
  latex: string,
  displayMode: boolean,
): LabFormula {
  const key = `\u0001${scope.paper}\u0000${scope.sections.join(" ")}\u0000${scope.where}\u0000${displayMode ? "d" : "i"}\u0000${latex}`;
  const cached = formulas.get(key);
  if (cached) return cached;
  const result =
    scope.sections.length === 0
      ? ({ kind: "unscoped" } as const)
      : resolveInSections(scope, latex, displayMode, labContext("", scope.paper, true));
  formulas.set(key, result);
  return result;
}

function resolveInSections(
  scope: Readonly<{ paper: string; sections: readonly string[]; where: string }>,
  latex: string,
  displayMode: boolean,
  context: InlineTermsContext,
): LabFormula {
  let best: ResolvedInline | null = null;
  for (const section of scope.sections) {
    const resolved = resolveInlineTerms(
      latex,
      { paper: scope.paper, where: scope.where, anchor: section, section },
      context,
    );
    if (!best || resolved.problems.length < best.problems.length) best = resolved;
  }
  return best && best.problems.length === 0
    ? {
        kind: "resolved",
        compiled: displayMode ? compileInlineFormula(best, display) : compileInlineFormula(best),
        section: best.scope.section,
      }
    : { kind: "refused", paper: scope.paper, problems: best?.problems ?? [] };
}

/** A coloured lab formula as the build's colour slots take it: its quantities, by glyph. */
export type LabInlineView = Readonly<{
  lab: string;
  latex: string;
  terms: readonly Readonly<{ quantityId: string; glyph: string }>[];
}>;

/** Each paper's coloured lab formulas and quantities, and each lab's quantities. */
export type LabInlineViews = Readonly<{
  papers: Readonly<
    Record<
      string,
      Readonly<{
        paper: string;
        formulas: readonly LabInlineView[];
        /** Each bound quantity, with its glyphs and the scope of its first use, as the facts expect. */
        quantities: Readonly<
          Record<
            string,
            Readonly<{
              glyphs: readonly string[];
              scope: Readonly<{ anchor: string; section: string }>;
            }>
          >
        >;
      }>
    >
  >;
  labs: Readonly<Record<string, Readonly<{ paper: string; quantityIds: readonly string[] }>>>;
}>;

/**
 * The labs' coloured formulas, resolved exactly as the pages resolve them (labFormula), for
 * build-equations.ts: their quantities join each paper's inline views, so two quantities of one lab
 * formula take different colours as on the faces, and each lab's island gets its quantities' facts.
 */
export function labInlineViews(sites: readonly LabFormulaSite[]): LabInlineViews {
  const papers: Record<
    string,
    {
      paper: string;
      formulas: LabInlineView[];
      quantities: Record<string, { glyphs: string[]; scope: { anchor: string; section: string } }>;
    }
  > = {};
  const labs: Record<string, { paper: string; quantityIds: string[] }> = {};
  for (const site of sites) {
    const result = labFormula(site.lab, site.latex, site.display, site.printed);
    if (result.kind !== "resolved" || result.compiled.terms.length === 0) continue;
    const paper = result.compiled.paper;
    const terms = result.compiled.terms.map(({ quantityId, glyph }) => ({ quantityId, glyph }));
    const own = papers[paper] ?? { paper, formulas: [], quantities: {} };
    papers[paper] = own;
    own.formulas.push({ lab: site.lab, latex: site.latex, terms });
    const lab = labs[site.lab] ?? { paper, quantityIds: [] };
    labs[site.lab] = lab;
    for (const { quantityId, glyph } of terms) {
      const use = own.quantities[quantityId];
      if (!use)
        own.quantities[quantityId] = {
          glyphs: [glyph],
          scope: { anchor: result.section, section: result.section },
        };
      else if (!use.glyphs.includes(glyph)) use.glyphs.push(glyph);
      if (!lab.quantityIds.includes(quantityId)) lab.quantityIds.push(quantityId);
    }
  }
  return { papers, labs };
}
