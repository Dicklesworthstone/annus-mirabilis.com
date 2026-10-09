/** Private capstone work. No physics, storage I/O, clocks or scoring live in this model. */
import type { Capstone } from "./capstoneSchema.ts";

export const WORKSHEET_LIMITS = Object.freeze({
  text: 10000,
  items: 128,
  rows: 10,
  columns: 6,
  cell: 1000,
  bytes: 131072,
});

export type WorksheetState = Readonly<{
  schemaVersion: 1;
  capstoneId: string;
  order: readonly string[];
  annotations: Readonly<Record<string, string>>;
  assumptionMarks: Readonly<Record<string, readonly string[]>>;
  explanation: string;
  table: readonly (readonly string[])[];
}>;

/** A new attempt starts in the authored order, with no answers filled in. */
export function emptyWorksheet(capstone: Pick<Capstone, "id" | "startOrder">): WorksheetState {
  return {
    schemaVersion: 1,
    capstoneId: capstone.id,
    order: [...capstone.startOrder],
    annotations: {},
    assumptionMarks: {},
    explanation: "",
    table: [],
  };
}

/** Boundaries are a no-op: nothing is lost or duplicated by an unavailable move. */
export function moveClaim(
  order: readonly string[],
  id: string,
  direction: -1 | 1,
): readonly string[] {
  const index = order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  const other = next[target];
  if (other === undefined) return order;
  next[target] = id;
  next[index] = other;
  return next;
}

export function markAssumption(
  state: WorksheetState,
  claimId: string,
  assumptionId: string,
  checked: boolean,
): WorksheetState {
  const current = state.assumptionMarks[claimId] ?? [];
  const next = checked
    ? [...new Set([...current, assumptionId])]
    : current.filter((id) => id !== assumptionId);
  return { ...state, assumptionMarks: { ...state.assumptionMarks, [claimId]: next } };
}

/** Differences are named, not graded. Extra selections remain visible for discussion. */
export function assumptionFeedback(authored: readonly string[], selected: readonly string[]) {
  return {
    alsoUses: authored.filter((id) => !selected.includes(id)),
    notUsedInWorkedVersion: selected.filter((id) => !authored.includes(id)),
  };
}

function plain(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"),
    )
  );
}
function validText(value: unknown, max: number): value is string {
  if (typeof value !== "string" || value.length > max) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) return false;
  }
  return true;
}
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/u.test(value) &&
    !["__proto__", "constructor", "prototype"].includes(value)
  );
}
function idList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= WORKSHEET_LIMITS.items &&
    value.every(validId) &&
    new Set(value).size === value.length
  );
}

/**
 * Admit external JSON without dropping unknown fields or truncating private text. Returning null
 * leaves the saved original untouched; the caller must display a refusal, never silently reset it.
 */
export function readWorksheet(input: unknown): WorksheetState | null {
  if (!plain(input)) return null;
  const fields = [
    "schemaVersion",
    "capstoneId",
    "order",
    "annotations",
    "assumptionMarks",
    "explanation",
    "table",
  ];
  if (
    Object.keys(input).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(input, key))
  )
    return null;
  if (
    input.schemaVersion !== 1 ||
    !validId(input.capstoneId) ||
    !idList(input.order) ||
    input.order.length === 0 ||
    !validText(input.explanation, WORKSHEET_LIMITS.text) ||
    !plain(input.annotations) ||
    !plain(input.assumptionMarks)
  )
    return null;
  const notes = Object.entries(input.annotations);
  const marks = Object.entries(input.assumptionMarks);
  if (
    notes.length > WORKSHEET_LIMITS.items ||
    marks.length > WORKSHEET_LIMITS.items ||
    notes.some(([key, value]) => !validId(key) || !validText(value, WORKSHEET_LIMITS.text)) ||
    marks.some(([key, value]) => !validId(key) || !idList(value))
  )
    return null;
  const table = input.table;
  if (
    !Array.isArray(table) ||
    table.length > WORKSHEET_LIMITS.rows ||
    table.some(
      (row) =>
        !Array.isArray(row) ||
        row.length === 0 ||
        row.length > WORKSHEET_LIMITS.columns ||
        row.some((cell) => !validText(cell, WORKSHEET_LIMITS.cell)),
    )
  )
    return null;
  if (table.some((row) => row.length !== table[0].length)) return null;
  if (new TextEncoder().encode(JSON.stringify(input)).length > WORKSHEET_LIMITS.bytes) return null;
  return {
    schemaVersion: 1,
    capstoneId: input.capstoneId,
    order: [...input.order],
    annotations: Object.fromEntries(notes) as Record<string, string>,
    assumptionMarks: Object.fromEntries(
      marks.map(([key, value]) => [key, [...(value as string[])]]),
    ),
    explanation: input.explanation,
    table: table.map((row: string[]) => [...row]),
  };
}

/** A changed edition must not silently erase an earlier attempt's claims or notes. */
export function worksheetMatches(
  state: WorksheetState,
  capstone: Pick<Capstone, "id" | "claims" | "assumptions">,
): boolean {
  const claims = new Set(capstone.claims.map((claim) => claim.id));
  const assumptions = new Set(capstone.assumptions.map((item) => item.id));
  return (
    state.capstoneId === capstone.id &&
    state.order.length === claims.size &&
    new Set(state.order).size === claims.size &&
    state.order.every((id) => claims.has(id)) &&
    Object.entries(state.assumptionMarks).every(
      ([claim, marks]) => claims.has(claim) && marks.every((id) => assumptions.has(id)),
    )
  );
}

export function exportWorksheet(state: WorksheetState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}
