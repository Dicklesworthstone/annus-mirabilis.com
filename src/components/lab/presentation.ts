import type {
  AcceptedSnapshot,
  NumericView,
  PublishedResult,
} from "../../experiments/store/instanceStore.ts";
import { formatScaledDecimal } from "../../units/decimalScale.ts";
export function result(snapshot: AcceptedSnapshot, id: string): PublishedResult {
  const value = snapshot.outputs.find((o) => o.quantityId === id);
  if (!value) throw new TypeError(`Missing declared laboratory output: ${id}`);
  return value;
}
export function scalar(snapshot: AcceptedSnapshot, id: string): number {
  const output = result(snapshot, id);
  if (output.status !== "value" || typeof output.value !== "number")
    throw new TypeError(`Expected scalar output: ${id}`);
  return output.value;
}
export function array(snapshot: AcceptedSnapshot, id: string): NumericView {
  const output = result(snapshot, id);
  if (output.status !== "value" || typeof output.value === "number")
    throw new TypeError(`Expected array output: ${id}`);
  return output.value;
}
const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};
function superscript(digits: string): string {
  return [...digits].map((ch) => SUPERSCRIPT[ch] ?? ch).join("");
}

/**
 * "6.1705e23" as a reader writes it: 6.1705 × 10²³. An e-exponent is programming notation, and
 * a sweep of the built lab pages found 134 of them visible on 19 of 43 routes (BUILD 19).
 * Anything that is not one number in that form passes through unchanged.
 */
export function readablePowers(text: string): string {
  const match = /^(-?\d+(?:\.\d+)?)e([+-]?)(\d+)$/.exec(text);
  if (!match) return text;
  const [, mantissa = text, sign = "", exponent = ""] = match;
  return `${mantissa} × 10${superscript(sign === "-" ? `-${exponent}` : exponent)}`;
}

/** An owner's unit string with its powers raised: "mol^-1" reads mol⁻¹, "m^3" reads m³. */
export function unitText(unit: string): string {
  return unit.replace(/\^(-?\d+)/g, (_, exponent: string) => superscript(exponent));
}

/**
 * A value at a fixed number of decimal places with the trailing zeros dropped: toFixed alone printed
 * 0.500000, 1.250000 and -1.600000 beside values that needed all six places, so every reading looked
 * equally precise whether it was or not. -0 reads 0. A negative value carries the minus sign (U+2212),
 * as Sci and every typeset number on the site do, not the hyphen toFixed writes.
 */
/**
 * Whether JavaScript would write this number in exponential notation: toFixed from 10²¹ up, and
 * String() there and below 10⁻⁶. A value a reader typed can be either, and "1e+300" is not how the
 * site writes a number.
 */
function exponential(value: number): boolean {
  const magnitude = Math.abs(value);
  return Number.isFinite(value) && magnitude !== 0 && (magnitude >= 1e21 || magnitude < 1e-6);
}

/** value.toFixed(decimals), except where that would be exponential, which display() writes instead. */
export function toFixedReadable(value: number, decimals: number): string {
  return Number.isFinite(value) && Math.abs(value) >= 1e21
    ? display(value)
    : value.toFixed(decimals);
}

/** A number echoed as it is, as String() writes it, except where that would be exponential. */
export function numberText(value: number): string {
  return exponential(value) ? display(value) : String(value);
}

export function fixed(value: number, decimals: number): string {
  if (Number.isFinite(value) && Math.abs(value) >= 1e21) return display(value);
  const text = value.toFixed(decimals);
  const trimmed = text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  return trimmed === "-0" ? "0" : trimmed.replace(/^-/, "−");
}

/**
 * A number for a sentence, to `digits` significant figures with trailing zeros dropped: plain from
 * 0.001 up to 10 000, a power of ten outside it ("2.6 × 10¹¹"). display() writes 2.6006e11 out as
 * 260060000000, which no reader can take in when a status line announces it.
 */
export function sentenceNumber(value: number, digits = 3): string {
  // Total, because a status line renders it: a throw here takes the whole laboratory down. LQ-07
  // published an emission rate of Infinity for an absorbed power of 1e300 µW, which its validator
  // admits, and display() would have thrown on it inside the render.
  if (Number.isNaN(value)) return "not computed";
  if (!Number.isFinite(value)) return "too large to compute";
  const size = Math.abs(value);
  if (size === 0 || (size >= 1e-3 && size < 1e4))
    return String(Number(value.toPrecision(digits))).replace(/^-/, "−");
  const [mantissa = "", exponent = ""] = value.toExponential(digits - 1).split("e");
  const trimmed = mantissa.includes(".")
    ? mantissa.replace(/0+$/, "").replace(/\.$/, "")
    : mantissa;
  return readablePowers(`${trimmed}e${exponent}`).replace(/^-/, "−");
}

/** Presentation rounding and explicit unit conversion only; no physical laws live here. */
export function display(value: number, factor = 1): string {
  if (!Number.isFinite(value) || !Number.isFinite(factor) || factor <= 0)
    throw new TypeError("A nonfinite display value was rejected.");
  // A negative value carries the minus sign, not the hyphen formatScaledDecimal writes: sr-12's moving
  // frame read "ρ′ = -2.5017 × 10⁻⁹ C/m³".
  return readablePowers(formatScaledDecimal(value, Math.log10(factor), 5)).replace(/^-/, "−");
}
export function identity(snapshot: AcceptedSnapshot) {
  return {
    "data-instance-id": snapshot.instanceId,
    "data-run-id": snapshot.runId,
    "data-snapshot-version": snapshot.snapshotVersion,
  };
}
