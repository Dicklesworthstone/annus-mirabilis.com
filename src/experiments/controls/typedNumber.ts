import type { RequestRefusal } from "../results/refusals.ts";
import { makeRefusal } from "../results/refusals.ts";

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
  | Readonly<{
      kind: "refused";
      requirement: string;
      /**
       * The same refusal as a REGISTERED one, so a lab can mark its readouts stale (am-m79c).
       *
       * `requirement` is the inline sentence a reader reads beside the field, and a sentence is all
       * a caller used to get. It carries no code, so a form refused here could not reach
       * `CurrencyForView` or any currency surface: eight lab components call this function and every
       * one did `setError(x.requirement)`, which tells a reader WHY their value was rejected and
       * never that the numbers beside the message belong to the previous settings.
       *
       * Both codes already existed in the registry and both have `domainKind: "input"`, so nothing
       * was invented to fill this in: a value that is not a number is `invalid-parameter`, and one
       * too large to be finite is `nonfinite-input`. The specific sentence rides as the ranked
       * repair, which is what it is -- an instruction for fixing the field -- while the message
       * stays the registry's canonical one for that code, because a per-site message is how a code's
       * meaning drifts.
       */
      refusal: RequestRefusal;
    }>;

/**
 * `label` reads mid-sentence ("the boost speed"). `toStored` converts the typed number to the unit the
 * lab stores (v/c to m/s, say). `tooLarge` is the sentence for a typed number the model cannot
 * take because of its size: one that overflows on conversion, and one already too large to be a
 * double as typed. Normally the declared-domain sentence (declaredDomain.ts).
 */
/**
 * A registered refusal for a typed field, from a code the registry already defines.
 *
 * `affected` carries no `parameterIds`: this layer is handed a prose label ("the boost speed"), not
 * a parameter id, and guessing an id from a label is the kind of match AGENTS.md forbids for
 * bindings. The label goes in `details` so a caller can say which field without a false id.
 */
function typedFieldRefusal(
  code: "invalid-parameter" | "nonfinite-input",
  requirement: string,
  label: string,
): RequestRefusal {
  return makeRefusal(
    code,
    {},
    { rankedRepairs: [{ label: requirement }], details: { field: label } },
  );
}

export function readTypedNumber(
  text: string,
  label: string,
  toStored: (typed: number) => number = (typed) => typed,
  tooLarge?: string,
): TypedNumber {
  const trimmed = text.trim();
  const typed = trimmed === "" ? Number.NaN : Number(trimmed);
  if (Number.isNaN(typed)) {
    const requirement = `Enter ${label} as a number.`;
    return {
      kind: "refused",
      requirement,
      refusal: typedFieldRefusal("invalid-parameter", requirement, label),
    };
  }
  // A typed number too large for a double is a MAGNITUDE the model cannot take, not a failure to
  // type a number: Number("1e400") is Infinity, and a reader who typed four digits and an exponent
  // was told "enter it as a number". That is the sentence this bead is about, and the finiteness
  // test used to run on `typed` before the conversion, so the tooLarge sentence below - the one
  // every caller supplies for exactly this - could never be reached by it.
  const value = Number.isFinite(typed) ? toStored(typed) : typed;
  if (!Number.isFinite(value)) {
    const requirement = tooLarge ?? `Enter ${label} as a smaller number.`;
    return {
      kind: "refused",
      requirement,
      refusal: typedFieldRefusal("nonfinite-input", requirement, label),
    };
  }
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

/**
 * A typed field read for a validator that names each setting itself: the number, or NaN for a
 * blank field. Number("") is 0, which is how a cleared field used to be applied as a setting
 * (SR-04, SR-07; dispatch 170).
 */
export function typedOrNaN(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}
