/**
 * Parses the `capability-matrix` fenced block from docs/FRANKENSIM_BINDING.md.
 *
 * am-fs-capability-audit-byc owns the matrix's columns, rows, and parser contract
 * (docs/FRANKENSIM_BINDING.md, "Parser contract (requirement 7)"). am-fs-slim-artifact-0yh
 * reads the matrix and never writes it: this module is the one parser every consumer
 * (the build gate, scripts/verify-wasm-artifacts.ts) imports, so a column change fails
 * in one place rather than drifting between reimplementations.
 *
 * This is not a general YAML parser. The matrix is a flat YAML sequence of maps with a
 * fixed key set and no nesting, so a targeted line-based parser can validate the exact
 * shape the parser contract promises instead of accepting whatever a general parser would.
 */

export const CAPABILITY_MATRIX_REQUIRED_KEYS = [
  "capabilityId",
  "family",
  "instrumentId",
  "upstreamStatus",
  "owner",
  "nativeTestTarget",
  "browserExport",
  "admittedDomain",
  "sourceReference",
  "releaseArtifact",
  "acceptanceState",
] as const;

type RequiredKey = (typeof CAPABILITY_MATRIX_REQUIRED_KEYS)[number];

export type CapabilityMatrixRow = Readonly<{
  capabilityId: string;
  family: string;
  instrumentId: string;
  upstreamStatus: string;
  owner: string;
  nativeTestTarget: string;
  browserExport: string;
  admittedDomain: string;
  sourceReference: string;
  releaseArtifact: string;
  acceptanceState: string;
  /** Required when instrumentId is "none"; absent otherwise. */
  reason?: string;
}>;

export class CapabilityMatrixParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityMatrixParseError";
  }
}

const FENCE_OPEN = "```capability-matrix";
const FENCE_CLOSE = "```";

/** Extracts the raw body between the ```capability-matrix fence and its closing ```. */
export function extractCapabilityMatrixBlock(bindingDocument: string): string {
  const lines = bindingDocument.split("\n");
  const openIndex = lines.findIndex((line) => line.trim() === FENCE_OPEN);
  if (openIndex === -1) {
    throw new CapabilityMatrixParseError(
      `No fenced ${FENCE_OPEN} block found in the binding document.`,
    );
  }
  const closeIndex = lines.findIndex(
    (line, index) => index > openIndex && line.trim() === FENCE_CLOSE,
  );
  if (closeIndex === -1) {
    throw new CapabilityMatrixParseError(
      `Fenced ${FENCE_OPEN} block opened at line ${openIndex + 1} is never closed with a matching \`\`\` line.`,
    );
  }
  return lines.slice(openIndex + 1, closeIndex).join("\n");
}

function unquoteScalar(raw: string, context: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new CapabilityMatrixParseError(`${context}: unterminated quoted scalar: ${raw}`);
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed !== "string") {
        throw new CapabilityMatrixParseError(
          `${context}: quoted scalar did not parse to a string: ${raw}`,
        );
      }
      return parsed;
    } catch (cause) {
      if (cause instanceof CapabilityMatrixParseError) throw cause;
      throw new CapabilityMatrixParseError(`${context}: malformed quoted scalar: ${raw}`);
    }
  }
  if (trimmed === "") {
    throw new CapabilityMatrixParseError(`${context}: value is empty.`);
  }
  return trimmed;
}

const ROW_START = /^- ([A-Za-z][A-Za-z0-9]*):\s*(.*)$/;
const CONTINUATION = /^ {2}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/;

/**
 * Parses the block body (the lines between the fences, not including them) into typed rows.
 * Refuses on anything outside "- capabilityId: value" followed by two-space "key: value"
 * continuation lines, a duplicate key within one row, a missing required key, a `reason`
 * present without `instrumentId: none`, or `instrumentId: none` without `reason`.
 */
export function parseCapabilityMatrixBody(body: string): CapabilityMatrixRow[] {
  const lines = body.split("\n");
  const rows: CapabilityMatrixRow[] = [];
  let current: Record<string, string> | null = null;

  function closeCurrent(): void {
    if (current === null) return;
    const row = current;
    for (const key of CAPABILITY_MATRIX_REQUIRED_KEYS) {
      if (!(key in row)) {
        throw new CapabilityMatrixParseError(
          `Row for capabilityId=${row.capabilityId ?? "?"} is missing required key "${key}".`,
        );
      }
    }
    const requiredKeySet: readonly string[] = CAPABILITY_MATRIX_REQUIRED_KEYS;
    const extraKeys = Object.keys(row).filter(
      (key) => !requiredKeySet.includes(key) && key !== "reason",
    );
    if (extraKeys.length > 0) {
      throw new CapabilityMatrixParseError(
        `Row for capabilityId=${row.capabilityId} has unexpected key(s): ${extraKeys.join(", ")}.`,
      );
    }
    if (row.instrumentId === "none" && !("reason" in row)) {
      throw new CapabilityMatrixParseError(
        `Row for capabilityId=${row.capabilityId} has instrumentId: none but no "reason" field.`,
      );
    }
    if (row.instrumentId !== "none" && "reason" in row) {
      throw new CapabilityMatrixParseError(
        `Row for capabilityId=${row.capabilityId} has a "reason" field but instrumentId is "${row.instrumentId}", not "none".`,
      );
    }
    rows.push(row as unknown as CapabilityMatrixRow);
    current = null;
  }

  for (const [zeroBasedIndex, line] of lines.entries()) {
    const lineNumber = zeroBasedIndex + 1;
    if (line.trim() === "") continue;

    const rowStart = ROW_START.exec(line);
    if (rowStart) {
      closeCurrent();
      const key = rowStart[1] as string;
      const value = rowStart[2] ?? "";
      if (key !== "capabilityId") {
        throw new CapabilityMatrixParseError(
          `Line ${lineNumber}: every row must start with "- capabilityId: ...", found "- ${key}: ...".`,
        );
      }
      current = { capabilityId: unquoteScalar(value, `line ${lineNumber}`) };
      continue;
    }

    const continuation = CONTINUATION.exec(line);
    if (continuation) {
      if (current === null) {
        throw new CapabilityMatrixParseError(
          `Line ${lineNumber}: continuation line appears before any "- capabilityId:" row: "${line}"`,
        );
      }
      const key = continuation[1] as RequiredKey | "reason";
      const value = continuation[2] ?? "";
      if (key in current) {
        throw new CapabilityMatrixParseError(
          `Line ${lineNumber}: duplicate key "${key}" in row for capabilityId=${current.capabilityId}.`,
        );
      }
      current[key] = unquoteScalar(value, `line ${lineNumber}`);
      continue;
    }

    throw new CapabilityMatrixParseError(
      `Line ${lineNumber}: does not match "- capabilityId: ..." or a two-space-indented "key: value" continuation: "${line}"`,
    );
  }
  closeCurrent();
  return rows;
}

/** Extracts and parses the capability matrix from a full binding-document string. */
export function parseCapabilityMatrix(bindingDocument: string): CapabilityMatrixRow[] {
  return parseCapabilityMatrixBody(extractCapabilityMatrixBlock(bindingDocument));
}
