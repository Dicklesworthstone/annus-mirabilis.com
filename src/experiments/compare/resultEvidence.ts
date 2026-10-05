import { decodeResult } from "../results/codec.ts";
import { explainResult, statusMessage } from "../results/explanations.ts";
import type { ScientificResult } from "../results/types.ts";

/** Freeze the detached scalar result, including its uncertainty and nonnumeric evidence. */
function freezeEvidence(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) freezeEvidence(child);
  Object.freeze(value);
}

/**
 * Older scalar projections have no owner. A full result must pass the existing result codec;
 * malformed scientific evidence is never silently reduced to an ownerless projection.
 */
export function comparisonEvidence(output: Readonly<{ status: string }>): ScientificResult | null {
  if (!Object.hasOwn(output, "ownerId")) return null;
  const result = decodeResult(output);
  if (result.status === "value" && typeof result.value !== "number")
    throw new TypeError("A comparison requires a scalar result, not an array.");
  freezeEvidence(result);
  return result;
}

export function comparisonReason(
  output: Readonly<{ status: string; reason?: unknown }>,
  evidence: ScientificResult | null,
): string {
  if (output.status === "value") return "";
  if (evidence) {
    const explanation = explainResult(evidence);
    return `${explanation.message} ${explanation.nextAction}`;
  }
  return typeof output.reason === "string" && output.reason.trim()
    ? output.reason
    : statusMessage(output.status);
}
