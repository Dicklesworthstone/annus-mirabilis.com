/**
 * The DOM readiness contract (am-test-e2e-harness-bqmh requirement 1): pure
 * parsers over already-captured attribute maps (a Playwright locator's
 * `data-*` attributes, snapshotted into a plain object), so every check can
 * be exercised with fixed fixtures. A missing attribute is reported by
 * name; an ill-formed instrument address is reported by value. This module
 * never touches a live page — the harness's checks call it with attributes
 * they have already read.
 */

export class DomContractError extends Error {
  readonly attribute: string | undefined;
  readonly value: string | undefined;
  constructor(message: string, options?: { attribute?: string; value?: string }) {
    super(message);
    this.name = "DomContractError";
    this.attribute = options?.attribute;
    this.value = options?.value;
  }
}

export type AttributeMap = Readonly<Record<string, string | null | undefined>>;

function requireAttribute(attrs: AttributeMap, name: string): string {
  const value = attrs[name];
  if (value === undefined || value === null || value === "") {
    throw new DomContractError(`missing required attribute "${name}"`, { attribute: name });
  }
  return value;
}

function optionalAttribute(attrs: AttributeMap, name: string): string | undefined {
  const value = attrs[name];
  return value === undefined || value === null || value === "" ? undefined : value;
}

// ---------------------------------------------------------------------------
// Instrument address grammar: a bare catalogue id (`bm-01`) or
// `<instrumentId>:<mode>` (`me-03:box-1906`). Both sides are hyphen-joined
// segments of lower-case ASCII letters or digits, with a dot permitted only
// between two digits (a decimal number, `0.6`). This is deliberately
// stricter than a preset id (`<instrumentId>-<slug>`, e.g.
// `sr-03-boost-0.6c`), whose slug may glue a unit letter onto a decimal
// (`0.6c`) with no hyphen — exactly the shape this grammar rejects, so a
// preset id can never be mistaken for an instrument address.
// ---------------------------------------------------------------------------

const LETTER_SEGMENT = /^[a-z]+$/;
const NUMBER_SEGMENT = /^[0-9]+(?:\.[0-9]+)?$/;

function isWellFormedAddressSide(side: string): boolean {
  if (side.length === 0) return false;
  const segments = side.split("-");
  return segments.every((segment) => LETTER_SEGMENT.test(segment) || NUMBER_SEGMENT.test(segment));
}

export interface InstrumentAddress {
  readonly raw: string;
  readonly instrumentId: string;
  /** `null` means the default mode: the bare catalogue id was mounted. */
  readonly mode: string | null;
}

/**
 * Parses and validates an instrument address's grammar. `declaredModes`, when
 * supplied, is the list of full addresses (`<instrumentId>:<mode>`) a caller
 * knows are registered (typically read from a paper's compiled manifest); an
 * address with a mode outside that list fails naming the registered modes.
 * With no list, membership is never asserted, because this Batch A harness
 * must not import the compiled content registry to read a DOM attribute.
 */
export function parseInstrumentAddress(value: string, declaredModes?: readonly string[]): InstrumentAddress {
  const colonCount = (value.match(/:/g) ?? []).length;
  if (colonCount > 1) {
    throw new DomContractError(`instrument address "${value}" has more than one colon`, { attribute: "data-instrument-id", value });
  }

  if (colonCount === 0) {
    if (!isWellFormedAddressSide(value)) {
      throw new DomContractError(`instrument address "${value}" is not a well-formed catalogue id`, {
        attribute: "data-instrument-id",
        value,
      });
    }
    return { raw: value, instrumentId: value, mode: null };
  }

  const [instrumentId, mode] = value.split(":");
  if (!instrumentId || !isWellFormedAddressSide(instrumentId)) {
    throw new DomContractError(`instrument address "${value}" has an ill-formed instrument id`, {
      attribute: "data-instrument-id",
      value,
    });
  }
  if (!mode || !isWellFormedAddressSide(mode)) {
    throw new DomContractError(`instrument address "${value}" has an ill-formed or empty mode`, {
      attribute: "data-instrument-id",
      value,
    });
  }

  if (declaredModes && !declaredModes.includes(value)) {
    throw new DomContractError(
      `instrument address "${value}" is not among the registered modes: ${declaredModes.join(", ") || "<none>"}`,
      { attribute: "data-instrument-id", value },
    );
  }

  return { raw: value, instrumentId, mode };
}

// ---------------------------------------------------------------------------
// Instrument root: [data-instrument-id] and its sibling attributes.
// ---------------------------------------------------------------------------

export const EXECUTION_LABELS = ["frankensim", "host", "static", "unavailable"] as const;
export type ExecutionLabel = (typeof EXECUTION_LABELS)[number];

export interface InstrumentRootAttributes {
  readonly address: InstrumentAddress;
  readonly instanceId: string;
  readonly runId: string;
  readonly snapshotVersion: string;
  readonly inputRevision: string;
  readonly acceptedInputRevision: string;
  readonly pending: boolean;
  readonly executionLabel: ExecutionLabel;
  readonly resultStatus: string | undefined;
  readonly refusalCode: string | undefined;
  readonly acceptedActionIndex: string | undefined;
  readonly viewState: string | undefined;
}

/**
 * Parses one instrument root's full attribute set. `data-accepted-action-index`
 * and `data-view-state` (defined by am-rt-snapshot-store-aft) are read when
 * present and never required, because a paper journey may run against a page
 * that predates that bead.
 */
export function parseInstrumentRoot(attrs: AttributeMap, declaredModes?: readonly string[]): InstrumentRootAttributes {
  const address = parseInstrumentAddress(requireAttribute(attrs, "data-instrument-id"), declaredModes);
  const instanceId = requireAttribute(attrs, "data-instance-id");
  const runId = requireAttribute(attrs, "data-run-id");
  const snapshotVersion = requireAttribute(attrs, "data-snapshot-version");
  const inputRevision = requireAttribute(attrs, "data-input-revision");
  const acceptedInputRevision = requireAttribute(attrs, "data-accepted-input-revision");
  const pendingRaw = requireAttribute(attrs, "data-pending");
  const executionLabelRaw = requireAttribute(attrs, "data-execution-label");

  if (!(EXECUTION_LABELS as readonly string[]).includes(executionLabelRaw)) {
    throw new DomContractError(
      `attribute "data-execution-label" has an unknown value "${executionLabelRaw}"; expected one of ${EXECUTION_LABELS.join(", ")}`,
      { attribute: "data-execution-label", value: executionLabelRaw },
    );
  }

  return {
    address,
    instanceId,
    runId,
    snapshotVersion,
    inputRevision,
    acceptedInputRevision,
    pending: pendingRaw === "true",
    executionLabel: executionLabelRaw as ExecutionLabel,
    resultStatus: optionalAttribute(attrs, "data-result-status"),
    refusalCode: optionalAttribute(attrs, "data-refusal-code"),
    acceptedActionIndex: optionalAttribute(attrs, "data-accepted-action-index"),
    viewState: optionalAttribute(attrs, "data-view-state"),
  };
}

// ---------------------------------------------------------------------------
// One view of an instrument instance (trace, distribution, equation live
// values, table, accessible description): identity attributes only.
// ---------------------------------------------------------------------------

export interface InstrumentViewAttributes {
  readonly instanceId: string;
  readonly runId: string;
  readonly snapshotVersion: string;
}

export function parseInstrumentView(attrs: AttributeMap): InstrumentViewAttributes {
  return {
    instanceId: requireAttribute(attrs, "data-instance-id"),
    runId: requireAttribute(attrs, "data-run-id"),
    snapshotVersion: requireAttribute(attrs, "data-snapshot-version"),
  };
}

// ---------------------------------------------------------------------------
// Reader root: [data-reader-root], data-ready, data-view; <html data-detail>.
// ---------------------------------------------------------------------------

export interface ReaderRootAttributes {
  readonly ready: boolean;
  readonly view: string;
}

export function parseReaderRoot(attrs: AttributeMap): ReaderRootAttributes {
  const view = requireAttribute(attrs, "data-view");
  return { ready: optionalAttribute(attrs, "data-ready") === "true", view };
}

export interface AnchorAttributes {
  readonly id: string;
  readonly anchor: string;
}

/** Anchors carry `id` and `data-anchor`; both are required and must agree. */
export function parseAnchor(attrs: AttributeMap): AnchorAttributes {
  const id = requireAttribute(attrs, "id");
  const anchor = requireAttribute(attrs, "data-anchor");
  if (id !== anchor) {
    throw new DomContractError(`anchor element's id "${id}" does not match its data-anchor "${anchor}"`, {
      attribute: "data-anchor",
      value: anchor,
    });
  }
  return { id, anchor };
}
