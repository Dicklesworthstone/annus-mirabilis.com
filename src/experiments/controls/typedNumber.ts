/**
 * A number a reader typed into a field, or the sentence saying it is not one (dispatch 165,
 * am-lab-domains-silently-clamped-pzj5).
 *
 * A form that stored Number(field) as it went turned a cleared field into 0: Number("") is 0, and a
 * browser hands "" for anything that is not a number in a number field. SR-08 then applied a frame
 * speed of 0c, with no word to the reader. A form keeps the text as typed and reads it here on
 * Apply, so an empty or non-numeric field is refused by name instead of becoming 0 or a default.
 */
export type TypedNumber =
  | Readonly<{ kind: "number"; value: number }>
  | Readonly<{ kind: "refused"; requirement: string }>;

/**
 * `label` reads mid-sentence ("the boost speed"). `toStored` converts the typed number to the unit the
 * lab stores (v/c to m/s, say). `tooLarge` is the sentence for a typed number that is finite but
 * overflows once converted, normally the declared-domain sentence (declaredDomain.ts).
 */
export function readTypedNumber(
  text: string,
  label: string,
  toStored: (typed: number) => number = (typed) => typed,
  tooLarge?: string,
): TypedNumber {
  const trimmed = text.trim();
  const typed = trimmed === "" ? Number.NaN : Number(trimmed);
  if (!Number.isFinite(typed))
    return { kind: "refused", requirement: `Enter ${label} as a number.` };
  const value = toStored(typed);
  if (!Number.isFinite(value))
    return { kind: "refused", requirement: tooLarge ?? `Enter ${label} as a smaller number.` };
  return { kind: "number", value };
}

/**
 * An optional numeric setting read from a record: its default when absent, and NaN, for the
 * validator's own check to refuse by name, when present but not a number. Validators used to take
 * the default for a present "abc" too, which accepted a text value without a word and made a
 * shared link replay to a different state (ME-03, SR-12, SR-13; dispatch 165).
 */
export function optionalNumber(
  record: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number,
): number {
  const value = record[key];
  if (value === undefined) return fallback;
  return typeof value === "number" ? value : Number.NaN;
}
