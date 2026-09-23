import { exponentialText } from "../../units/scientific.ts";
import type { Baseline } from "./Baseline.ts";
import type { ComparisonResult } from "./compatibility.ts";
import type { ComparisonContract } from "./singleVariationLock.ts";

/**
 * Five significant figures, as plain text: this string also goes into the comparison statement and
 * the notebook export, which hold no markup. Number#toString switches to e-notation below 10⁻⁶ and
 * from 10²¹, so a 10^300 μm radius read "from 0.5 μm to 1e+300 μm" with ratios of "5e-301"; those
 * are written in the one-line power-of-ten form instead ("5 × 10^−301").
 */
export function comparisonDisplay(value: number | string | boolean, factor = 1): string {
  if (typeof value !== "number") return String(value);
  const scaled = value * factor;
  if (!Number.isFinite(scaled)) return "Outside display range";
  const rounded = Number(scaled.toPrecision(5));
  const text = rounded.toString();
  return /e/.test(text) ? exponentialText(rounded) : text;
}
export const COMMON_RANDOM_NUMBERS_NOTE =
  "Same seed (common random numbers): isolates the effect of the change; these are not independent trials.";

/** Describes accepted data and command semantics; contains no physical law or assumed result ratio. */
export function comparisonStatement(
  baseline: Baseline,
  variant: Baseline,
  contract: ComparisonContract,
  result: ComparisonResult,
): string {
  if (result.kind === "refused") return result.message;
  const { changedInput, command } = result.variation;
  if (command === "presentation-change")
    return "Only the view changed. Physically changed: nothing. Re-described: the view. Held fixed: the scientific inputs. Changed as a consequence: no scientific result.";
  const changed = changedInput === null ? null : contract.inputs[changedInput];
  const value = (key: string, source: Baseline) => {
    const input = contract.inputs[key],
      v = source.parameters[key];
    return input && v !== undefined
      ? `${comparisonDisplay(v, input.displayFactor)}${input.unit ? ` ${input.unit}` : ""}`
      : "unavailable";
  };
  const description =
    changedInput && changed
      ? `${changed.label} from ${value(changedInput, baseline)} to ${value(changedInput, variant)}`
      : "nothing";
  const fixed = Object.keys(contract.inputs)
    .filter((key) => key !== changedInput)
    .map((key) => `${contract.inputs[key]?.label ?? key} ${value(key, baseline)}`)
    .join(", ");
  const consequences = result.rows
    .map((row) => {
      const label = contract.outputs.find((output) => output.id === row.id)?.label ?? row.id;
      return row.ratio.status === "value"
        ? `${label} (ratio ${comparisonDisplay(row.ratio.value)})`
        : `${label} (ratio not applicable: ${row.ratio.reason})`;
    })
    .join("; ");
  return [
    `Physically changed: ${command === "setup-change" ? description : "nothing"}.`,
    `Held fixed: ${fixed}.`,
    `Re-described: ${command === "observer-change" ? description : "nothing"}.`,
    ...(command === "measurement-change"
      ? [`Measurement changed: ${description}; the recorded run is retained.`]
      : []),
    ...(command === "estimator-change"
      ? [`Estimator changed: ${description}; the selected data are retained.`]
      : []),
    `Changed as a consequence (variant / baseline readouts): ${consequences}.`,
  ].join(" ");
}
