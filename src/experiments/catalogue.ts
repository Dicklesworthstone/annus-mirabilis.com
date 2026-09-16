/**
 * The closed catalogue of instrument ids (am-inst-registry-dispatcher-66l0).
 * AGENTS.md's donor-seam table states the rule this file exists to enforce:
 * "Unknown experiment ids fail explicitly instead of showing a plausible
 * wrong model." There is no default case and no fallback instrument.
 */

export type LqId =
  | "lq-01"
  | "lq-02"
  | "lq-03"
  | "lq-04"
  | "lq-05"
  | "lq-06"
  | "lq-07"
  | "lq-08"
  | "lq-09";
export type BmId = "bm-01" | "bm-02" | "bm-03" | "bm-04" | "bm-05" | "bm-06" | "bm-07" | "bm-08";
export type SrId =
  | "sr-01"
  | "sr-02"
  | "sr-03"
  | "sr-04"
  | "sr-05"
  | "sr-06"
  | "sr-07"
  | "sr-08"
  | "sr-09"
  | "sr-10"
  | "sr-11"
  | "sr-12"
  | "sr-13";
export type MeId = "me-01" | "me-02" | "me-03";
export type CoreCatalogueId = LqId | BmId | SrId | MeId;

export type NonCoreCatalogueId =
  | "shelf-michelson-morley"
  | "shelf-fizeau"
  | "shelf-maxwell-galilean"
  | "avogadro-lab"
  | "light-thread";

export type CatalogueId = CoreCatalogueId | NonCoreCatalogueId;

export type CatalogueStatus = "registered" | "in-preparation";

/**
 * A `Record<CatalogueId, ...>` forces every key present: omitting an id
 * from this object, or adding an id to the union above without adding it
 * here, fails `tsc` at this declaration. This is the "exhaustiveness check
 * compiles only when all ids are handled" acceptance criterion, enforced by
 * the type system itself rather than a runtime assertion.
 */
export const CATALOGUE_STATUS: Readonly<Record<CatalogueId, CatalogueStatus>> = Object.freeze({
  "lq-01": "in-preparation",
  "lq-02": "in-preparation",
  "lq-03": "in-preparation",
  "lq-04": "in-preparation",
  "lq-05": "in-preparation",
  "lq-06": "in-preparation",
  "lq-07": "in-preparation",
  "lq-08": "registered",
  "lq-09": "in-preparation",
  "bm-01": "registered",
  "bm-02": "in-preparation",
  "bm-03": "in-preparation",
  "bm-04": "in-preparation",
  "bm-05": "registered",
  "bm-06": "registered",
  "bm-07": "registered",
  "bm-08": "registered",
  "sr-01": "in-preparation",
  "sr-02": "in-preparation",
  "sr-03": "in-preparation",
  "sr-04": "in-preparation",
  "sr-05": "in-preparation",
  "sr-06": "in-preparation",
  "sr-07": "in-preparation",
  "sr-08": "in-preparation",
  "sr-09": "in-preparation",
  "sr-10": "in-preparation",
  "sr-11": "in-preparation",
  "sr-12": "in-preparation",
  "sr-13": "in-preparation",
  "me-01": "in-preparation",
  "me-02": "in-preparation",
  "me-03": "in-preparation",
  "shelf-michelson-morley": "in-preparation",
  "shelf-fizeau": "in-preparation",
  "shelf-maxwell-galilean": "in-preparation",
  "avogadro-lab": "in-preparation",
  "light-thread": "in-preparation",
});

export const CATALOGUE_IDS: readonly CatalogueId[] = Object.freeze(
  Object.keys(CATALOGUE_STATUS) as CatalogueId[],
);

export const REGISTERED_IDS: readonly CatalogueId[] = Object.freeze(
  CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered"),
);

/**
 * Authored explanatory questions, only where one is genuinely authored
 * (requirement: "with its explanatory question from the catalogue when
 * authored"). Absence is honest: most ids have no authored question yet.
 */
export const CATALOGUE_QUESTIONS: Readonly<Partial<Record<CatalogueId, string>>> = Object.freeze({
  "lq-08":
    "Why does increasing light intensity release more electrons without increasing their individual energy, while increasing frequency increases electron energy without requiring higher intensity?",
  "bm-05": "After many steps, what will changing the step law while keeping its variance do?",
});

/** Runtime guard for an id read from a URL, permalink, or reader link: never assume the string is valid. */
export function isCatalogueId(value: string): value is CatalogueId {
  return Object.hasOwn(CATALOGUE_STATUS, value);
}

export function catalogueStatus(id: CatalogueId): CatalogueStatus {
  return CATALOGUE_STATUS[id];
}

/**
 * The literal switch-with-`never`-fallthrough form the acceptance criteria
 * name explicitly, alongside the `Record` above. Two independent
 * mechanisms enforcing the same exhaustiveness: this one fails to compile
 * if a case is *removed* while the id stays in the union (the `Record`
 * above fails if a case is never *added*), so together they catch both
 * directions of drift.
 */
export function catalogueLabel(id: CatalogueId): string {
  switch (id) {
    case "lq-01":
    case "lq-02":
    case "lq-03":
    case "lq-04":
    case "lq-05":
    case "lq-06":
    case "lq-07":
    case "lq-08":
    case "lq-09":
      return `Light quanta instrument ${id}`;
    case "bm-01":
    case "bm-02":
    case "bm-03":
    case "bm-04":
    case "bm-05":
    case "bm-06":
    case "bm-07":
    case "bm-08":
      return `Brownian motion instrument ${id}`;
    case "sr-01":
    case "sr-02":
    case "sr-03":
    case "sr-04":
    case "sr-05":
    case "sr-06":
    case "sr-07":
    case "sr-08":
    case "sr-09":
    case "sr-10":
    case "sr-11":
    case "sr-12":
    case "sr-13":
      return `Special relativity instrument ${id}`;
    case "me-01":
    case "me-02":
    case "me-03":
      return `Mass-energy instrument ${id}`;
    case "shelf-michelson-morley":
      return "1904 shelf: Michelson-Morley";
    case "shelf-fizeau":
      return "1904 shelf: Fizeau drag";
    case "shelf-maxwell-galilean":
      return "1904 shelf: Maxwell under Galilean substitution";
    case "avogadro-lab":
      return "Avogadro's-number laboratory";
    case "light-thread":
      return "The light-quanta cross-paper thread";
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unhandled catalogue id: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Mode-address grammar. Mirrors scripts/e2e/domContract.ts's
// parseInstrumentAddress (am-test-e2e-harness-bqmh): a bare catalogue id, or
// `<instrumentId>:<mode>` with a single colon, lower-case ASCII words or
// digit groups joined by hyphens on each side, a dot only between two
// digits. This bead is the *writer* of addresses that grammar validates and
// the *owner* of mode membership; catalogue.test.ts cross-checks agreement
// with the harness's independent parser directly.
// ---------------------------------------------------------------------------

const LETTER_SEGMENT = /^[a-z]+$/;
const NUMBER_SEGMENT = /^[0-9]+(?:\.[0-9]+)?$/;

function isWellFormedAddressSide(side: string): boolean {
  if (side.length === 0) return false;
  return side
    .split("-")
    .every((segment) => LETTER_SEGMENT.test(segment) || NUMBER_SEGMENT.test(segment));
}

/**
 * Declared modes per catalogue id. Every registered id currently declares
 * none: no `<instrumentId>:<mode>` addresses exist in this repository yet
 * (`bm-07:kitchen` in the bead's own prose is a planned example, not a
 * shipped one). The `Record` is exhaustive over every id for the same
 * compile-time reason as `CATALOGUE_STATUS`.
 */
export const DECLARED_MODES: Readonly<Record<CatalogueId, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    CATALOGUE_IDS.map((id) => [id, Object.freeze([]) as readonly string[]]),
  ) as Record<CatalogueId, readonly string[]>,
);

export interface ParsedCatalogueAddress {
  readonly raw: string;
  readonly instrumentId: string;
  /** `null` means the bare catalogue id was addressed: the default mode. */
  readonly mode: string | null;
}

export class CatalogueAddressError extends Error {
  readonly value: string;
  constructor(message: string, value: string) {
    super(message);
    this.name = "CatalogueAddressError";
    this.value = value;
  }
}

/** Parses the grammar only; says nothing about whether the instrument id or mode is real. */
export function parseCatalogueAddress(value: string): ParsedCatalogueAddress {
  const colonCount = (value.match(/:/g) ?? []).length;
  if (colonCount > 1) {
    throw new CatalogueAddressError(`instrument address "${value}" has more than one colon`, value);
  }
  if (colonCount === 0) {
    if (!isWellFormedAddressSide(value)) {
      throw new CatalogueAddressError(
        `instrument address "${value}" is not a well-formed catalogue id`,
        value,
      );
    }
    return { raw: value, instrumentId: value, mode: null };
  }
  const [instrumentId, mode] = value.split(":");
  if (!instrumentId || !isWellFormedAddressSide(instrumentId)) {
    throw new CatalogueAddressError(
      `instrument address "${value}" has an ill-formed instrument id`,
      value,
    );
  }
  if (!mode || !isWellFormedAddressSide(mode)) {
    throw new CatalogueAddressError(
      `instrument address "${value}" has an ill-formed or empty mode`,
      value,
    );
  }
  return { raw: value, instrumentId, mode };
}

/**
 * Resolves a parsed address's `instrumentId` to a known `CatalogueId` and,
 * if a mode is present, checks it against that id's `DECLARED_MODES`. A
 * preset id (hyphen-joined, no colon) is a bare instrument-id shape and is
 * never looked up as a mode; a preset offered as a mode (via a colon) fails
 * here because no id currently declares any mode.
 */
export function resolveCatalogueAddress(
  value: string,
): { id: CatalogueId; mode: string | null } | { error: string } {
  let parsed: ParsedCatalogueAddress;
  try {
    parsed = parseCatalogueAddress(value);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (!isCatalogueId(parsed.instrumentId)) {
    return { error: `unknown catalogue id "${parsed.instrumentId}"` };
  }
  if (parsed.mode === null) {
    return { id: parsed.instrumentId, mode: null };
  }
  const declared = DECLARED_MODES[parsed.instrumentId];
  if (!declared.includes(parsed.mode)) {
    return {
      error: `"${parsed.mode}" is not a declared mode of ${parsed.instrumentId}; declared modes: ${
        declared.join(", ") || "<none>"
      }`,
    };
  }
  return { id: parsed.instrumentId, mode: parsed.mode };
}
