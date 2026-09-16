/**
 * Stable ID scheme, branded types, grammar regexes, and validators.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly rule?: string | undefined };

// ============================================================================
// 1. Route Slugs, Bibliographic Keys, and Paper Codes
// ============================================================================

export const ROUTE_SLUGS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
] as const;

export type RouteSlug = (typeof ROUTE_SLUGS)[number];

export const PAPER_CODES = ["lq", "bm", "sr", "me", "md"] as const;
export type PaperCode = (typeof PAPER_CODES)[number];

export const ROUTE_SLUG_TO_PAPER_CODE: Record<RouteSlug, PaperCode> = {
  "light-quanta": "lq",
  "brownian-motion": "bm",
  "special-relativity": "sr",
  "mass-energy": "me",
  "molecular-dimensions": "md",
};

export const PAPER_CODE_TO_ROUTE_SLUG: Record<PaperCode, RouteSlug> = {
  lq: "light-quanta",
  bm: "brownian-motion",
  sr: "special-relativity",
  me: "mass-energy",
  md: "molecular-dimensions",
};

export type BibKey = Brand<string, "BibKey">;
export const BIB_KEY_PATTERN = /^ap-(17|18|19|34)-\d+$/;

export function parseBibKey(raw: string): ParseResult<BibKey> {
  if (BIB_KEY_PATTERN.test(raw)) {
    return { ok: true, value: raw as BibKey };
  }
  return {
    ok: false,
    error: `Invalid bibliographic key '${raw}': must match 'ap-<volume>-<firstPage>' (e.g. 'ap-17-132')`,
    rule: "bib-key-grammar",
  };
}

export function parseRouteSlug(raw: string): ParseResult<RouteSlug> {
  if (ROUTE_SLUGS.includes(raw as RouteSlug)) {
    return { ok: true, value: raw as RouteSlug };
  }
  return {
    ok: false,
    error: `Invalid route slug '${raw}': must be one of ${ROUTE_SLUGS.join(", ")}`,
    rule: "route-slug-grammar",
  };
}

export function parsePaperCode(raw: string): ParseResult<PaperCode> {
  if (PAPER_CODES.includes(raw as PaperCode)) {
    return { ok: true, value: raw as PaperCode };
  }
  return {
    ok: false,
    error: `Invalid paper code '${raw}': must be one of ${PAPER_CODES.join(", ")}`,
    rule: "paper-code-grammar",
  };
}

// ============================================================================
// 2. Slug Grammar and Dot Rule
// ============================================================================

/**
 * Token grammar: [a-z0-9]+(\.[0-9]+[a-z0-9]*)?
 * A dot appears ONLY between two digits.
 */
export const TOKEN_PATTERN = /^[a-z0-9]+(?:\.[0-9]+[a-z0-9]*)?$/;

export function isValidSlugToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function validateSlug(slug: string): ParseResult<string> {
  if (!slug || typeof slug !== "string") {
    return { ok: false, error: "Slug must be a non-empty string", rule: "slug-grammar" };
  }
  if (slug.includes(":") || slug.includes(" ")) {
    return { ok: false, error: `Slug '${slug}' cannot contain colons or whitespace`, rule: "slug-grammar" };
  }
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) {
    return {
      ok: false,
      error: `Slug '${slug}' cannot have leading, trailing, or double hyphens`,
      rule: "slug-grammar",
    };
  }
  if (/[A-Z]/.test(slug)) {
    return { ok: false, error: `Slug '${slug}' must be lowercase`, rule: "slug-grammar" };
  }
  const tokens = slug.split("-");
  for (const token of tokens) {
    if (!isValidSlugToken(token)) {
      if (token.startsWith(".") || token.endsWith(".")) {
        return {
          ok: false,
          error: `Slug token '${token}' in '${slug}' cannot start or end with a dot`,
          rule: "slug-dot-rule",
        };
      }
      if (token.includes("..")) {
        return {
          ok: false,
          error: `Slug token '${token}' in '${slug}' cannot contain consecutive dots`,
          rule: "slug-dot-rule",
        };
      }
      if (token.includes(".")) {
        return {
          ok: false,
          error: `In slug token '${token}' in '${slug}', a dot is permitted ONLY between two digits (e.g. '0.6c')`,
          rule: "slug-dot-rule",
        };
      }
      return {
        ok: false,
        error: `Invalid slug token '${token}' in '${slug}'`,
        rule: "slug-grammar",
      };
    }
  }
  return { ok: true, value: slug };
}

// ============================================================================
// 3. Instruments, Modes, Presets, Prompts, and Tapes
// ============================================================================

export type InstrumentKind = "core" | "shelf" | "discovery";

export interface NonCoreInstrumentDescriptor {
  readonly id: string;
  readonly kind: "shelf" | "discovery";
  readonly owningBead: string;
}

export const NON_CORE_INSTRUMENT_IDS: readonly NonCoreInstrumentDescriptor[] = [
  { id: "shelf-michelson-morley", kind: "shelf", owningBead: "am-disc-shelf-michelson-fizeau-dauq" },
  { id: "shelf-fizeau", kind: "shelf", owningBead: "am-disc-shelf-michelson-fizeau-dauq" },
  { id: "shelf-maxwell-galilean", kind: "shelf", owningBead: "am-disc-shelf-michelson-fizeau-dauq" },
  { id: "avogadro-lab", kind: "discovery", owningBead: "am-disc-avogadro-lab-pfi7" },
  { id: "light-thread", kind: "discovery", owningBead: "am-disc-light-thread-7wm4" },
] as const;

export const CORE_INSTRUMENT_PATTERN = /^(lq|bm|sr|me)-\d{2}$/;

export type InstrumentId = Brand<string, "InstrumentId">;

export function parseInstrumentId(
  raw: string,
): { readonly ok: true; readonly value: InstrumentId; readonly kind: InstrumentKind } | { readonly ok: false; readonly error: string; readonly rule?: string } {
  if (CORE_INSTRUMENT_PATTERN.test(raw)) {
    return { ok: true, value: raw as InstrumentId, kind: "core" };
  }
  const nonCore = NON_CORE_INSTRUMENT_IDS.find((entry) => entry.id === raw);
  if (nonCore) {
    return { ok: true, value: raw as InstrumentId, kind: nonCore.kind };
  }
  const nonCoreList = NON_CORE_INSTRUMENT_IDS.map((e) => e.id).join(", ");
  return {
    ok: false,
    error: `Invalid instrument ID '${raw}': must match core catalogue '^(lq|bm|sr|me)-\\d{2}$' or declared non-core list (${nonCoreList})`,
    rule: "instrument-id-grammar",
  };
}

export type ModeId = Brand<string, "ModeId">;
export type PresetId = Brand<string, "PresetId">;
export type PredictPromptId = Brand<string, "PredictPromptId">;
export type TapeId = Brand<string, "TapeId">;

export function parseModeId(raw: string): ParseResult<ModeId> {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Mode ID must be a non-empty string", rule: "mode-id-grammar" };
  }
  const parts = raw.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      ok: false,
      error: `Mode ID '${raw}' must have exactly one colon in '<instrumentId>:<slug>' format`,
      rule: "mode-id-grammar",
    };
  }
  const instResult = parseInstrumentId(parts[0]);
  if (!instResult.ok) {
    return { ok: false, error: `Invalid instrument in mode ID '${raw}': ${instResult.error}`, rule: instResult.rule };
  }
  const slugResult = validateSlug(parts[1]);
  if (!slugResult.ok) {
    return { ok: false, error: `Invalid mode slug in '${raw}': ${slugResult.error}`, rule: slugResult.rule };
  }
  return { ok: true, value: raw as ModeId };
}

export function parsePresetId(raw: string): ParseResult<PresetId> {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Preset ID must be a non-empty string", rule: "preset-id-grammar" };
  }
  if (raw.includes(":")) {
    return {
      ok: false,
      error: `Preset ID '${raw}' cannot contain a colon; presets use hyphen format '<instrumentId>-<slug>'`,
      rule: "preset-id-grammar",
    };
  }
  // Match against known non-core IDs first, then core pattern
  let instPrefix = "";
  for (const nonCore of NON_CORE_INSTRUMENT_IDS) {
    if (raw.startsWith(`${nonCore.id}-`)) {
      instPrefix = nonCore.id;
      break;
    }
  }
  if (!instPrefix) {
    const match = raw.match(/^(lq|bm|sr|me)-\d{2}-/);
    if (match) {
      instPrefix = match[0].slice(0, -1);
    }
  }
  if (!instPrefix) {
    return {
      ok: false,
      error: `Preset ID '${raw}' must begin with a valid instrument ID followed by a hyphen`,
      rule: "preset-id-grammar",
    };
  }
  const slugPart = raw.slice(instPrefix.length + 1);
  if (slugPart.startsWith("predict-") || slugPart === "predict") {
    return {
      ok: false,
      error: `Preset ID '${raw}' cannot use reserved 'predict' prefix; use parsePredictPromptId instead`,
      rule: "preset-predict-collision",
    };
  }
  const slugResult = validateSlug(slugPart);
  if (!slugResult.ok) {
    return { ok: false, error: `Invalid preset slug in '${raw}': ${slugResult.error}`, rule: slugResult.rule };
  }
  return { ok: true, value: raw as PresetId };
}

export function parsePredictPromptId(raw: string): ParseResult<PredictPromptId> {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Predict prompt ID must be a non-empty string", rule: "predict-prompt-grammar" };
  }
  if (raw.includes(":")) {
    return {
      ok: false,
      error: `Predict prompt ID '${raw}' cannot contain a colon; use '<instrumentId>-predict-<slug>'`,
      rule: "predict-prompt-grammar",
    };
  }
  let instPrefix = "";
  for (const nonCore of NON_CORE_INSTRUMENT_IDS) {
    if (raw.startsWith(`${nonCore.id}-predict-`)) {
      instPrefix = nonCore.id;
      break;
    }
  }
  if (!instPrefix) {
    const match = raw.match(/^(lq|bm|sr|me)-\d{2}-predict-/);
    if (match) {
      instPrefix = match[0].slice(0, "-predict-".length * -1);
    }
  }
  if (!instPrefix) {
    return {
      ok: false,
      error: `Predict prompt ID '${raw}' must match '<instrumentId>-predict-<slug>'`,
      rule: "predict-prompt-grammar",
    };
  }
  const slugPart = raw.slice(instPrefix.length + "-predict-".length);
  const slugResult = validateSlug(slugPart);
  if (!slugResult.ok) {
    return { ok: false, error: `Invalid prompt slug in '${raw}': ${slugResult.error}`, rule: slugResult.rule };
  }
  return { ok: true, value: raw as PredictPromptId };
}

export function parseTapeId(raw: string): ParseResult<TapeId> {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Tape ID must be a non-empty string", rule: "tape-id-grammar" };
  }
  if (raw.includes(":")) {
    return {
      ok: false,
      error: `Tape ID '${raw}' cannot contain a colon; tape IDs use slug format (e.g. 'the-locked-positions')`,
      rule: "tape-id-grammar",
    };
  }
  const slugResult = validateSlug(raw);
  if (!slugResult.ok) {
    return { ok: false, error: `Invalid tape ID slug '${raw}': ${slugResult.error}`, rule: slugResult.rule };
  }
  return { ok: true, value: raw as TapeId };
}

// ============================================================================
// 4. Source Structure IDs (Local to one document)
// ============================================================================

export type SectionId = Brand<string, "SectionId">;
export type HeadingId = Brand<string, "HeadingId">;
export type ParagraphId = Brand<string, "ParagraphId">;
export type SentenceId = Brand<string, "SentenceId">;
export type FootnoteId = Brand<string, "FootnoteId">;
export type ClosingId = Brand<string, "ClosingId">;
export type MastheadId = Brand<string, "MastheadId">;
export type PartHeadingId = Brand<string, "PartHeadingId">;

export type AlignableUnitId = Brand<string, "AlignableUnitId">;
export type TranslationUnitId = Brand<string, "TranslationUnitId">;
export type InlineMathId = Brand<string, "InlineMathId">;
export type ReferenceId = Brand<string, "ReferenceId">;

export const SECTION_ID_PATTERN = /^s\d+$/;
export const PARAGRAPH_ID_PATTERN = /^s\d+-p[1-9]\d*$/;
export const SENTENCE_ID_PATTERN = /^(?:[a-z]+-\d{4}-)?s\d+-p[1-9]\d*-s[1-9]\d*$/;
export const FOOTNOTE_ID_PATTERN = /^(?:[a-z]+-\d{4}-)?s\d+-fn[1-9]\d*$/;
export const CLOSING_ID_PATTERN = /^(?:[a-z]+-\d{4}-)?closing-(dateline|ack|received)$/;
export const MASTHEAD_ID_PATTERN = /^masthead-(title|author)$/;
export const PART_HEADING_ID_PATTERN = /^part-[12]$/;

export function parseSectionId(raw: string): ParseResult<SectionId> {
  if (SECTION_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as SectionId };
  }
  return {
    ok: false,
    error: `Invalid section ID '${raw}': must match 's<n>' with n >= 0 (e.g. 's0', 's3')`,
    rule: "section-id-grammar",
  };
}

export function parseHeadingId(raw: string): ParseResult<HeadingId> {
  if (/^s[1-9]\d*$/.test(raw) || PART_HEADING_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as HeadingId };
  }
  if (raw === "s0") {
    return {
      ok: false,
      error: "Section 's0' has no heading block; heading IDs start from s1 or use part-1/part-2",
      rule: "heading-id-grammar",
    };
  }
  if (raw.endsWith("-h")) {
    return {
      ok: false,
      error: `Retired heading ID '${raw}': heading IDs match the section ID itself (e.g. 's3'), not 's3-h'`,
      rule: "heading-id-grammar",
    };
  }
  return {
    ok: false,
    error: `Invalid heading ID '${raw}': must be 's<n>' (n >= 1) or 'part-1'/'part-2'`,
    rule: "heading-id-grammar",
  };
}

export function parseParagraphId(raw: string): ParseResult<ParagraphId> {
  if (PARAGRAPH_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as ParagraphId };
  }
  return {
    ok: false,
    error: `Invalid paragraph ID '${raw}': must match 's<n>-p<m>' with m >= 1 (e.g. 's3-p2')`,
    rule: "paragraph-id-grammar",
  };
}

export function parseSentenceId(raw: string): ParseResult<SentenceId> {
  if (SENTENCE_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as SentenceId };
  }
  if (/[a-z]$/.test(raw) && /s\d+-p\d+-s\d+[a-z]$/.test(raw)) {
    return {
      ok: false,
      error: `Invalid German sentence ID '${raw}': letter suffixes belong only to split English translation units`,
      rule: "german-sentence-no-suffix",
    };
  }
  return {
    ok: false,
    error: `Invalid sentence ID '${raw}': must match 's<n>-p<m>-s<k>' with k >= 1 (e.g. 's3-p2-s1')`,
    rule: "sentence-id-grammar",
  };
}

export function parseFootnoteId(raw: string): ParseResult<FootnoteId> {
  if (FOOTNOTE_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as FootnoteId };
  }
  if (raw.includes("-s")) {
    return {
      ok: false,
      error: `Retired footnote sentence ID '${raw}': footnotes align as block-level units without sentence IDs (e.g. 's3-fn1')`,
      rule: "footnote-id-grammar",
    };
  }
  return {
    ok: false,
    error: `Invalid footnote ID '${raw}': must match 's<n>-fn<k>' with k >= 1 (e.g. 's3-fn1')`,
    rule: "footnote-id-grammar",
  };
}

export function parseClosingId(raw: string): ParseResult<ClosingId> {
  if (CLOSING_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as ClosingId };
  }
  if (raw.includes("-s")) {
    return {
      ok: false,
      error: `Retired closing sentence ID '${raw}': closings align as block-level units without sentence IDs (e.g. 'closing-ack')`,
      rule: "closing-id-grammar",
    };
  }
  return {
    ok: false,
    error: `Invalid closing ID '${raw}': must be 'closing-dateline', 'closing-ack', or 'closing-received'`,
    rule: "closing-id-grammar",
  };
}

export function parseAlignableUnitId(raw: string): ParseResult<AlignableUnitId> {
  if (
    SENTENCE_ID_PATTERN.test(raw) ||
    /^s[1-9]\d*$/.test(raw) ||
    FOOTNOTE_ID_PATTERN.test(raw) ||
    CLOSING_ID_PATTERN.test(raw) ||
    MASTHEAD_ID_PATTERN.test(raw) ||
    PART_HEADING_ID_PATTERN.test(raw)
  ) {
    return { ok: true, value: raw as AlignableUnitId };
  }
  return {
    ok: false,
    error: `Invalid alignable unit ID '${raw}'`,
    rule: "alignable-unit-grammar",
  };
}

export function parseTranslationUnitId(raw: string): ParseResult<TranslationUnitId> {
  const alignable = parseAlignableUnitId(raw);
  if (alignable.ok) {
    return { ok: true, value: raw as TranslationUnitId };
  }
  // Split translation units:
  // 1. Ending in digit: append letter directly (e.g. s3-p2-s1a, s3-fn1a, s3a, part-1a)
  // 2. Ending in letter: join with hyphen (e.g. closing-ack-a, masthead-title-b)
  const digitSplitMatch = raw.match(/^(s\d+-p\d+-s\d+|s[1-9]\d*|s\d+-fn\d+|part-[12])([a-z])$/);
  if (digitSplitMatch) {
    return { ok: true, value: raw as TranslationUnitId };
  }
  const letterSplitMatch = raw.match(
    /^(closing-dateline|closing-ack|closing-received|masthead-title|masthead-author)-([a-z])$/,
  );
  if (letterSplitMatch) {
    return { ok: true, value: raw as TranslationUnitId };
  }
  if (/^(closing-dateline|closing-ack|closing-received|masthead-title|masthead-author)[a-z]$/.test(raw)) {
    return {
      ok: false,
      error: `Invalid split translation ID '${raw}': letter-ending block IDs join split suffix with hyphen (e.g. 'closing-ack-a', not 'closing-acka')`,
      rule: "split-suffix-grammar",
    };
  }
  return {
    ok: false,
    error: `Invalid translation unit ID '${raw}'`,
    rule: "translation-unit-grammar",
  };
}

export function parseInlineMathId(raw: string): ParseResult<InlineMathId> {
  if (/^(?:[a-z]+-\d{4}-)?s\d+-p[1-9]\d*-s[1-9]\d*-m[1-9]\d*$/.test(raw) || /^(?:[a-z]+-\d{4}-)?s\d+-fn[1-9]\d*-m[1-9]\d*$/.test(raw)) {
    return { ok: true, value: raw as InlineMathId };
  }
  return {
    ok: false,
    error: `Invalid inline math ID '${raw}': must match 's<n>-p<m>-s<k>-m<i>' or 's<n>-fn<k>-m<i>' with i >= 1`,
    rule: "inline-math-grammar",
  };
}

export function parseReferenceId(raw: string): ParseResult<ReferenceId> {
  const match = raw.match(/^(.+)-r([1-9]\d*)$/);
  if (match && match[1]) {
    const unitResult = parseAlignableUnitId(match[1]);
    if (unitResult.ok) {
      return { ok: true, value: raw as ReferenceId };
    }
  }
  return {
    ok: false,
    error: `Invalid reference occurrence ID '${raw}': must match '<alignableUnitId>-r<i>' with i >= 1 (e.g. 's3-p2-s1-r1')`,
    rule: "reference-id-grammar",
  };
}

// ============================================================================
// 5. Equations and Printed Label Normalization
// ============================================================================

export type EquationAnchor = Brand<string, "EquationAnchor">;
export type EquationRecordId = Brand<string, "EquationRecordId">;
export type EquationTermId = Brand<string, "EquationTermId">;
export type EquationOpId = Brand<string, "EquationOpId">;

/**
 * Normalizes printed equation labels to canonical ID tokens according to §22.5.
 * 1. Strip surrounding parentheses or brackets: (7) -> 7, [12] -> 12
 * 2. Roman numerals -> roman-<arabic>: (II) -> roman-2
 * 3. Primes (ASCII ' or typographic ′) -> p: (1') -> 1p, (1'') -> 1pp, (2′) -> 2p
 * 4. Suffix letters are lowercased and kept: (IIa) -> roman-2a, (II') -> roman-2p
 */
export function normalizePrintedLabel(label: string): string {
  if (!label || typeof label !== "string") return "";
  let clean = label.trim().replace(/^[\(\[\{]/, "").replace(/[\)\]\}]$/, "").trim();

  // Roman numerals conversion at start of token
  const romanMap: Record<string, string> = {
    XII: "12",
    XI: "11",
    VIII: "8",
    VII: "7",
    VI: "6",
    IV: "4",
    IX: "9",
    III: "3",
    II: "2",
    I: "1",
    X: "10",
    V: "5",
  };

  for (const [roman, arabic] of Object.entries(romanMap)) {
    const regex = new RegExp(`^${roman}(.*)$`, "i");
    const match = clean.match(regex);
    if (match) {
      clean = `roman-${arabic}${match[1] ?? ""}`;
      break;
    }
  }

  // Replace typographic primes (′ / ″ / ‴) and ASCII primes (' / '') with 'p'
  clean = clean.replace(/′/g, "p").replace(/″/g, "pp").replace(/‴/g, "ppp");
  clean = clean.replace(/'/g, "p");

  return clean.toLowerCase();
}

export function parseEquationAnchor(raw: string): ParseResult<EquationAnchor> {
  if (/^eq-(?:s\d+-)?(?:d[1-9]\d*|[0-9a-z]+(?:p+)?|roman-[0-9a-z]+(?:p+)?)$/.test(raw)) {
    return { ok: true, value: raw as EquationAnchor };
  }
  return {
    ok: false,
    error: `Invalid equation anchor '${raw}': must match 'eq-<suffix>' (e.g. 'eq-7', 'eq-s3-1', 'eq-s3-d4')`,
    rule: "equation-anchor-grammar",
  };
}

export function parseEquationRecordId(raw: string): ParseResult<EquationRecordId> {
  const match = raw.match(/^eq-(lq|bm|sr|me|md)-(.+)$/);
  if (match && match[2]) {
    const anchorForm = `eq-${match[2]}`;
    if (parseEquationAnchor(anchorForm).ok) {
      return { ok: true, value: raw as EquationRecordId };
    }
  }
  return {
    ok: false,
    error: `Invalid global equation record ID '${raw}': must match 'eq-<paperCode>-<suffix>' (e.g. 'eq-bm-s3-d4')`,
    rule: "equation-record-id-grammar",
  };
}

export interface RawEquationInput {
  readonly section: string; // e.g. "s1", "s3"
  readonly printedLabel?: string; // e.g. "(1)", "(2)", "(1')"
  readonly displayIndex?: number; // 1-based index within section if unnumbered
}

export interface AllocatedEquationId {
  readonly localId: string; // e.g. "eq-s1-1", "eq-2", "eq-s3-1", "eq-s3-d4"
  readonly globalRecordId: string; // e.g. "eq-sr-s1-1"
  readonly pageAnchor: string; // e.g. "#eq-s1-1"
  readonly originalLabel?: string;
}

/**
 * Allocates canonical equation IDs across a paper, enforcing section-qualification
 * when printed labels repeat within a document.
 */
export function allocateEquationIds(
  paper: PaperCode | RouteSlug,
  equations: readonly RawEquationInput[],
): AllocatedEquationId[] {
  const paperCode: PaperCode = (PAPER_CODES as readonly string[]).includes(paper)
    ? (paper as PaperCode)
    : ROUTE_SLUG_TO_PAPER_CODE[paper as RouteSlug];

  // Count frequencies of normalized printed labels across document
  const labelFrequencies = new Map<string, number>();
  for (const eq of equations) {
    if (eq.printedLabel) {
      const norm = normalizePrintedLabel(eq.printedLabel);
      labelFrequencies.set(norm, (labelFrequencies.get(norm) ?? 0) + 1);
    }
  }

  // Display counters per section
  const sectionDisplayCounters = new Map<string, number>();

  return equations.map((eq) => {
    let suffix = "";
    if (eq.printedLabel) {
      const norm = normalizePrintedLabel(eq.printedLabel);
      const freq = labelFrequencies.get(norm) ?? 1;
      if (freq > 1) {
        // Section-qualified form for repeated labels
        const s = eq.section.startsWith("s") ? eq.section : `s${eq.section}`;
        suffix = `${s}-${norm}`;
      } else {
        // Unique printed label
        suffix = norm;
      }
    } else {
      // Unnumbered display
      const s = eq.section.startsWith("s") ? eq.section : `s${eq.section}`;
      const nextD = (sectionDisplayCounters.get(s) ?? 0) + 1;
      sectionDisplayCounters.set(s, nextD);
      const dIndex = eq.displayIndex ?? nextD;
      suffix = `${s}-d${dIndex}`;
    }

    const localId = `eq-${suffix}`;
    const globalRecordId = `eq-${paperCode}-${suffix}`;
    const pageAnchor = `#eq-${suffix}`;

    return {
      localId,
      globalRecordId,
      pageAnchor,
      ...(eq.printedLabel ? { originalLabel: eq.printedLabel } : {}),
    };
  });
}

export function parseEquationTermId(raw: string): ParseResult<EquationTermId> {
  const match = raw.match(/^(.+)\.t\.([a-zA-Z0-9_-]+)$/);
  if (match && match[1] && parseEquationRecordId(match[1]).ok) {
    return { ok: true, value: raw as EquationTermId };
  }
  return {
    ok: false,
    error: `Invalid equation term ID '${raw}': must match '<equationRecordId>.t.<name>'`,
    rule: "equation-term-id-grammar",
  };
}

export function parseEquationOpId(raw: string): ParseResult<EquationOpId> {
  const match = raw.match(/^(.+)\.op\.([a-zA-Z0-9_-]+)$/);
  if (match && match[1] && parseEquationRecordId(match[1]).ok) {
    return { ok: true, value: raw as EquationOpId };
  }
  return {
    ok: false,
    error: `Invalid equation operation ID '${raw}': must match '<equationRecordId>.op.<name>'`,
    rule: "equation-op-id-grammar",
  };
}

// ============================================================================
// 6. Concordance, Quantities, Knowledge Cards, and First-Encounters
// ============================================================================

export type QuantityId = Brand<string, "QuantityId">;
export const QUANTITY_ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export function parseQuantityId(raw: string): ParseResult<QuantityId> {
  if (QUANTITY_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as QuantityId };
  }
  return {
    ok: false,
    error: `Invalid quantity ID '${raw}': must be semantic lower camelCase (e.g. 'stoppingPotentialMagnitude')`,
    rule: "quantity-id-grammar",
  };
}

export type ConcordanceEntryId = Brand<string, "ConcordanceEntryId">;
export const CONCORDANCE_ID_PATTERN = /^(lq|bm|sr|me|md)\.([a-zA-Z0-9_'-]+)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseConcordanceEntryId(raw: string): ParseResult<ConcordanceEntryId> {
  if (CONCORDANCE_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as ConcordanceEntryId };
  }
  return {
    ok: false,
    error: `Invalid concordance entry ID '${raw}': must match '<paperCode>.<glyph>.<meaning>' (e.g. 'bm.k.viscosity', 'sr.L.magnetic-field-x')`,
    rule: "concordance-id-grammar",
  };
}

export type PremiseId = Brand<string, "PremiseId">;
export const PREMISE_ID_PATTERN = /^[a-z]+(-[a-z]+)*-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/;

export function parsePremiseId(raw: string): ParseResult<PremiseId> {
  if (raw.length <= 80 && PREMISE_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as PremiseId };
  }
  return {
    ok: false,
    error: `Invalid knowledge card / premise ID '${raw}': must match '<author>-<year>-<topic>' (max 80 chars, e.g. 'rayleigh-1900-radiation-law')`,
    rule: "premise-id-grammar",
  };
}

export type EntranceId = Brand<string, "EntranceId">;
export const ENTRANCE_PAPER_SLUGS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

export function parseEntranceId(raw: string): ParseResult<EntranceId> {
  const prefix = "entrance-";
  if (raw.startsWith(prefix)) {
    const slug = raw.slice(prefix.length);
    if ((ENTRANCE_PAPER_SLUGS as readonly string[]).includes(slug)) {
      return { ok: true, value: raw as EntranceId };
    }
  }
  return {
    ok: false,
    error: `Invalid entrance record ID '${raw}': must be 'entrance-<paperSlug>' for one of the four main papers (e.g. 'entrance-brownian-motion')`,
    rule: "entrance-id-grammar",
  };
}

export type RecordId = Brand<string, "RecordId">;
export const GENERIC_RECORD_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseGenericRecordId(raw: string): ParseResult<RecordId> {
  if (raw.length <= 80 && GENERIC_RECORD_ID_PATTERN.test(raw)) {
    return { ok: true, value: raw as RecordId };
  }
  return {
    ok: false,
    error: `Invalid record ID '${raw}': must be lowercase kebab-case (max 80 chars)`,
    rule: "record-id-grammar",
  };
}
