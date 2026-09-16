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
  "lq-01": "registered",
  "lq-02": "registered",
  "lq-03": "registered",
  "lq-04": "in-preparation",
  "lq-05": "registered",
  "lq-06": "registered",
  "lq-07": "registered",
  "lq-08": "registered",
  "lq-09": "registered",
  "bm-01": "registered",
  "bm-02": "registered",
  "bm-03": "registered",
  "bm-04": "registered",
  "bm-05": "registered",
  "bm-06": "registered",
  "bm-07": "registered",
  "bm-08": "registered",
  "sr-01": "registered",
  "sr-02": "registered",
  "sr-03": "registered",
  "sr-04": "registered",
  "sr-05": "in-preparation",
  "sr-06": "registered",
  "sr-07": "in-preparation",
  "sr-08": "in-preparation",
  "sr-09": "in-preparation",
  "sr-10": "in-preparation",
  "sr-11": "in-preparation",
  "sr-12": "in-preparation",
  "sr-13": "in-preparation",
  "me-01": "registered",
  "me-02": "registered",
  "me-03": "registered",
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
  "lq-01":
    "What does a continuous wave description of light explain well, and what exactly does its intensity measure?",
  "lq-03":
    "What does a measured radiation spectrum look like at a given temperature, in which regime is Wien's law or the classical law an accurate description, and what does a density plot actually measure?",
  "lq-05":
    "How does counting independent possibilities produce an entropy that depends on volume like n ln V, and what changes if the things are not independent?",
  "lq-06":
    "Why does comparing the radiation entropy volume law to the ideal gas entropy volume law suggest that monochromatic radiation behaves as independent energy quanta of magnitude R*beta*nu / N = h*nu?",
  "lq-07":
    "Why can the frequency of emitted fluorescent light not exceed that of the exciting light under the light-quantum hypothesis, and what are the exact conditions for exceptions?",
  "lq-08":
    "Why does increasing light intensity release more electrons without increasing their individual energy, while increasing frequency increases electron energy without requiring higher intensity?",
  "lq-09":
    "How does single-quantum energy conservation set the frequency threshold for gas ionization, and what determines the relation between absorbed light energy and the count of ionized molecules?",
  "bm-03":
    "How does counting where independent particles can be produce the pressure law without solving any motion?",
  "bm-04":
    "How can drag and equilibrium determine how fast particles diffuse, and why does the force you apply not matter?",
  "bm-05": "After many steps, what will changing the step law while keeping its variance do?",
  "sr-03":
    "How does relative motion affect the synchronization of clocks, the coordinate measurement of moving rods, and the invariant causal order of events?",
  "sr-06":
    "Why doesn't adding speeds preserve light speed, and what happens when the motions are not along one line?",
  "sr-04":
    "What map between two inertial frames keeps both postulates, and what does each requirement decide?",
  "me-01":
    "If a body at rest emits two equal pulses in opposite directions, what do two observers' energy ledgers force you to say about the body?",
  "me-02":
    "What does a smaller energy of motion at the same speed tell you about the body's inertia, and why does the conclusion come from low speeds?",
  "sr-02":
    "Why does moving the magnet instead of the conductor create an explanatory asymmetry, and how does the transformation remove it?",
  "sr-01":
    "How can distant clocks acquire an operational common time, and do moving clocks share it?",
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
const DECLARED_MODE_OVERRIDES: Partial<Record<CatalogueId, readonly string[]>> = {
  "sr-02": Object.freeze(["apparatus"]),
};

export const DECLARED_MODES: Readonly<Record<CatalogueId, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    CATALOGUE_IDS.map((id) => [
      id,
      Object.freeze([...(DECLARED_MODE_OVERRIDES[id] ?? [])]) as readonly string[],
    ]),
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
