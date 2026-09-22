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

/** Presentation rounding and explicit unit conversion only; no physical laws live here. */
export function display(value: number, factor = 1): string {
  if (!Number.isFinite(value) || !Number.isFinite(factor) || factor <= 0)
    throw new TypeError("A nonfinite display value was rejected.");
  return readablePowers(formatScaledDecimal(value, Math.log10(factor), 5));
}
export function identity(snapshot: AcceptedSnapshot) {
  return {
    "data-instance-id": snapshot.instanceId,
    "data-run-id": snapshot.runId,
    "data-snapshot-version": snapshot.snapshotVersion,
  };
}
