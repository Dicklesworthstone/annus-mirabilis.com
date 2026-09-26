/**
 * A DISCOVER PAGE'S FORMULAS, IN THEIR PAPER'S COLOURS (dispatch 276). The owner: "I still see a ton
 * of equations that aren't properly using the colored equations with latex system like in
 * classic-patents.com". On the built discover pages of b16bc66b, 65 formulas were drawn and 6 were
 * coloured, and those 6 were an embedded laboratory's.
 *
 * SCOPE. A journey's formula is read in its journey's paper and in the section of the paper its step
 * works through, by NavyKite's resolver (src/equations/printed/inlineTerms.ts) over the printed
 * concordance plus the modern readings (modernScope.ts). The anchor is the page's own
 * ("discover-<paper>" for a journey, "discover-<paper>-investigate" for its investigation), and
 * content/inline-terms/discover.yaml holds what is true only on that page, each entry with its
 * reason:
 * - a READING binds a letter the page writes to the registered quantity it names, where the paper's
 *   notation does not. The relativity investigation's a(v), b(v), d(v) and k(v) are the modern
 *   ansatz's coefficients (ansatzSpatialScale and the rest), not the printed a of § 3. On its page a
 *   reading replaces the paper's readings of that one letter, and it reaches no other page and no
 *   reading face;
 * - an EXCEPTION names a sign that is not a quantity (the number π, the order symbol O), which stays
 *   in the neutral ink.
 * Every other letter is read as an explanation reads it (explanationInlines.ts): with the section as
 * its anchor, so a section's printed entries outrank the paper-wide ones.
 * Nothing is inferred from a letter's shape, and no colour is invented: an atom is coloured only
 * when the concordance, the modern scope or a reviewed reading binds it to a registered quantity.
 *
 * ENFORCED. A formula that does not resolve stops the build (journey-formula-refused), naming the
 * page, the step and each glyph, so a discover formula is never plain in silence.
 *
 * Server-only: the concordance, the registry and the readings are read from content/ at build time.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { glyphSignature } from "../equations/latex/printedAtoms.ts";
// The registry's own check (content/quantities/registry.ts) reads content/ at run time and cannot be
// bundled into a page; this generated map names every registered id, as explanationInlines.ts uses.
import { QUANTITY_LABELS } from "../generated/quantity-labels.ts";

const isRegisteredQuantityId = (quantityId: string): boolean =>
  Object.hasOwn(QUANTITY_LABELS, quantityId);

import {
  type CompiledInline,
  compileInlineFormula,
  type InlineException,
  type InlineTermsContext,
  resolveInlineTerms,
} from "../equations/printed/inlineTerms.ts";
import { modernInlineEntries } from "../equations/printed/modernScope.ts";

export const DISCOVER_READINGS_PATH = join("content", "inline-terms", "discover.yaml");

/** Where a discover formula is printed, as the resolver reads it. */
export type JourneyScope = Readonly<{
  paper: string;
  /** The section of the paper the step works through (s0 to s10). */
  section: string;
  /**
   * The paragraph, where the step quotes one and its letters are read there: Brownian § 2 reads ν
   * as an index except in s2-p7, whose display p = RT/N ν the journey quotes.
   */
  paragraph?: string | undefined;
  /** The page's own anchor: "discover-<paper>" or "discover-<paper>-investigate". */
  anchor: string;
  /** The page and the step, named in every refusal ("discover/brownian-motion step-03"). */
  where: string;
}>;

/** A letter a discover page writes, bound to the registered quantity it names on that page. */
export type JourneyReading = Readonly<{
  paper: string;
  anchor: string;
  glyph: string;
  quantityId: string;
  reason: string;
}>;

export type JourneyReadingsCode =
  | "journey-readings-not-a-list"
  | "journey-reading-no-anchor"
  | "journey-reading-glyph-not-one-atom"
  | "journey-reading-unregistered-quantity"
  | "journey-reading-no-reason"
  | "journey-exceptions-not-a-list"
  | "journey-exception-no-scope"
  | "journey-exception-glyph-not-one-atom"
  | "journey-exception-no-reason";

export class JourneyReadingsError extends Error {
  readonly code: JourneyReadingsCode;
  constructor(code: JourneyReadingsCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "JourneyReadingsError";
    this.code = code;
  }
}

export class JourneyFormulaError extends Error {
  readonly code: "journey-formula-refused";
  constructor(code: "journey-formula-refused", message: string) {
    super(`${code}: ${message}`);
    this.name = "JourneyFormulaError";
    this.code = code;
  }
}

function signatureOf(glyph: string | undefined): string | undefined {
  try {
    return glyph ? glyphSignature(glyph) : undefined;
  } catch {
    return undefined;
  }
}

/** The readings of discover.yaml, each checked: a page anchor, one atom, a registered quantity, a reason. */
export function parseJourneyReadings(
  raw: unknown,
  where: string,
  isRegistered: (quantityId: string) => boolean,
): readonly JourneyReading[] {
  const list = (raw as { readings?: unknown } | null)?.readings ?? [];
  if (!Array.isArray(list))
    throw new JourneyReadingsError(
      "journey-readings-not-a-list",
      `${where}: readings must be a list.`,
    );
  return list.map((item, i) => {
    const at = `${where} readings[${i}]`;
    const r = (item ?? {}) as Record<string, unknown>;
    if (
      typeof r.paper !== "string" ||
      typeof r.anchor !== "string" ||
      !/^discover-[a-z-]+$/.test(r.anchor)
    )
      throw new JourneyReadingsError(
        "journey-reading-no-anchor",
        `${at}: a reading needs its paper and its page's anchor (discover-<paper>...).`,
      );
    const glyph = typeof r.glyph === "string" ? r.glyph : "";
    if (signatureOf(glyph) === undefined)
      throw new JourneyReadingsError(
        "journey-reading-glyph-not-one-atom",
        `${at}: "${glyph}" is not one printed name.`,
      );
    if (typeof r.quantityId !== "string" || !isRegistered(r.quantityId))
      throw new JourneyReadingsError(
        "journey-reading-unregistered-quantity",
        `${at}: "${String(r.quantityId)}" is not a registered quantity id (content/quantities/).`,
      );
    if (typeof r.reason !== "string" || r.reason.trim().length < 20)
      throw new JourneyReadingsError(
        "journey-reading-no-reason",
        `${at}: a reading needs a reason of a sentence.`,
      );
    return {
      paper: r.paper,
      anchor: r.anchor,
      glyph,
      quantityId: r.quantityId,
      reason: r.reason.trim(),
    };
  });
}

/**
 * The exceptions of discover.yaml, each checked as paperInlines.ts checks the reading faces': one
 * atom, a scope of page anchors, and a reason. Parsed here because paperInlines.ts imports the
 * quantity registry, which a page cannot bundle.
 */
export function parseJourneyExceptions(raw: unknown, where: string): readonly InlineException[] {
  const list = (raw as { exceptions?: unknown } | null)?.exceptions ?? [];
  if (!Array.isArray(list))
    throw new JourneyReadingsError(
      "journey-exceptions-not-a-list",
      `${where}: exceptions must be a list.`,
    );
  return list.map((item, i) => {
    const at = `${where} exceptions[${i}]`;
    const e = (item ?? {}) as Record<string, unknown>;
    if (
      typeof e.paper !== "string" ||
      !Array.isArray(e.scope) ||
      e.scope.length === 0 ||
      e.scope.some((s) => typeof s !== "string" || !/^discover-[a-z-]+$/.test(s))
    )
      throw new JourneyReadingsError(
        "journey-exception-no-scope",
        `${at}: an exception needs its paper and a scope of page anchors (discover-<paper>...).`,
      );
    const glyph = typeof e.glyph === "string" ? e.glyph : "";
    if (signatureOf(glyph) === undefined)
      throw new JourneyReadingsError(
        "journey-exception-glyph-not-one-atom",
        `${at}: "${glyph}" is not one printed name.`,
      );
    if (typeof e.reason !== "string" || e.reason.trim().length < 20)
      throw new JourneyReadingsError(
        "journey-exception-no-reason",
        `${at}: an exception needs a reason of a sentence.`,
      );
    return { paper: e.paper, glyph, scope: e.scope as string[], reason: e.reason.trim() };
  });
}

/** A reading as a concordance entry, for its own page's context only (journeyContext). */
function asEntry(reading: JourneyReading, index: number): ConcordanceEntry {
  return {
    id: `discover.${reading.anchor}.${index}`,
    paper: reading.paper,
    scope: ["all"],
    glyph: { unicode: reading.glyph, latex: reading.glyph },
    meaning: reading.reason,
    binding: { quantityId: reading.quantityId },
    operation: { kind: "rename", target: { form: "symbol", modernGlyph: reading.glyph } },
    sources: { anchor: reading.anchor },
    verification: {
      printed: false,
      checkedAgainst: DISCOVER_READINGS_PATH,
      by: "journeyFormulas.ts",
      date: "",
    },
  };
}

type DiscoverFile = Readonly<{
  readings: readonly JourneyReading[];
  exceptions: readonly InlineException[];
}>;

let discoverFile: DiscoverFile | null = null;

/** content/inline-terms/discover.yaml, read and checked once per process. */
export function loadDiscoverReadings(root = process.cwd()): DiscoverFile {
  if (discoverFile && root === process.cwd()) return discoverFile;
  const path = join(root, DISCOVER_READINGS_PATH);
  const raw = existsSync(path)
    ? strictParse(readFileSync(path, "utf8"), "yaml", DISCOVER_READINGS_PATH)
    : { readings: [], exceptions: [] };
  const file = {
    readings: parseJourneyReadings(raw, DISCOVER_READINGS_PATH, isRegisteredQuantityId),
    exceptions: parseJourneyExceptions(raw, DISCOVER_READINGS_PATH),
  };
  if (root === process.cwd()) discoverFile = file;
  return file;
}

const contexts = new Map<string, InlineTermsContext>();

/**
 * One page's context: the paper's concordance and modern readings, with each letter the page reads
 * for itself taken out and its reading put in; and the page's exceptions.
 */
export function journeyContext(
  paper: string,
  anchor: string,
  file: DiscoverFile = loadDiscoverReadings(),
): InlineTermsContext {
  const key = `${paper}\u0000${anchor}`;
  const cached = contexts.get(key);
  if (cached && file === discoverFile) return cached;
  const own = file.readings.filter((r) => r.paper === paper && r.anchor === anchor);
  const replaced = new Set(own.map((r) => signatureOf(r.glyph)));
  const context: InlineTermsContext = {
    concordance: [
      ...modernInlineEntries(paper, loadConcordanceForPaper(paper)).filter(
        (entry) => !replaced.has(signatureOf(entry.glyph.latex)),
      ),
      ...own.map(asEntry),
    ],
    isRegistered: isRegisteredQuantityId,
    exceptions: file.exceptions
      .filter((e) => e.paper === paper && e.scope.includes(anchor))
      .map((e) => ({ ...e, scope: ["all"] })),
  };
  if (file === discoverFile) contexts.set(key, context);
  return context;
}

const display = ((tex: string, options: object) =>
  renderToString(tex, { ...options, displayMode: true })) as typeof renderToString;

/**
 * The formula drawn with its terms marked, in display or inline mode. Throws
 * journey-formula-refused, naming the page, the step and each glyph, when any atom does not
 * resolve in its scope.
 */
export function journeyFormula(
  latex: string,
  scope: JourneyScope,
  displayMode: boolean,
  context: InlineTermsContext = journeyContext(scope.paper, scope.anchor),
): CompiledInline {
  const resolved = resolveInlineTerms(
    latex,
    {
      paper: scope.paper,
      where: scope.where,
      anchor: scope.paragraph ?? scope.section,
      section: scope.section,
    },
    context,
  );
  if (resolved.problems.length > 0)
    throw new JourneyFormulaError(
      "journey-formula-refused",
      resolved.problems.map((p) => p.message).join("\n"),
    );
  return displayMode ? compileInlineFormula(resolved, display) : compileInlineFormula(resolved);
}
