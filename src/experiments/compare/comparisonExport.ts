import type { Baseline } from "./Baseline.ts";
import { ComparisonContractError } from "./ComparisonContractError.ts";
import { COMPARISON_UNCERTAINTY_NOTE } from "./comparisonPresentation.ts";
import { comparisonStatement } from "./comparisonStatement.ts";
import { compareBaselines } from "./compatibility.ts";
import type { ComparisonContract } from "./singleVariationLock.ts";

/** A bounded, no-JavaScript download of accepted data, not a stochastic replay tape. */
const MAX_DOWNLOAD_CHARACTERS = 256_000;
export type ComparisonDownload = Readonly<
  | { kind: "ready"; href: string; filename: string }
  | { kind: "unavailable"; message: string }
>;

export function serializeComparison(
  baseline: Baseline,
  variant: Baseline,
  contract: ComparisonContract,
): string {
  // Recheck compatibility rather than trusting a result from a different pair of snapshots.
  const comparison = compareBaselines(baseline, variant, contract);
  if (comparison.kind !== "accepted")
    throw new ComparisonContractError("comparison-incompatible", comparison.message);
  return `${JSON.stringify(
    {
      format: "annus-mirabilis-comparison",
      version: 1,
      experimentId: contract.experimentId,
      statement: comparisonStatement(baseline, variant, contract, comparison),
      interpretation: {
        ratio: "variant / baseline",
        difference: "variant - baseline",
        uncertainty: COMPARISON_UNCERTAINTY_NOTE,
        replay: "This is a comparison record, not a replay tape.",
        units:
          "Values and evidence retain their stored units; display conversions are in the contract.",
      },
      contract,
      baseline,
      variant,
      comparison,
    },
    null,
    2,
  )}\n`;
}

export function comparisonDownload(
  baseline: Baseline,
  variant: Baseline,
  contract: ComparisonContract,
): ComparisonDownload {
  try {
    const json = serializeComparison(baseline, variant, contract);
    if (json.length > MAX_DOWNLOAD_CHARACTERS)
      return {
        kind: "unavailable",
        message:
          "This record exceeds the browser download budget. Its evidence remains available for inspection below.",
      };
    const href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    if (href.length > MAX_DOWNLOAD_CHARACTERS)
      return {
        kind: "unavailable",
        message:
          "This record exceeds the browser download budget. Its evidence remains available for inspection below.",
      };
    const name = contract.experimentId.replace(/[^a-z0-9_-]/gi, "_").slice(0, 100);
    return Object.freeze({ kind: "ready", href, filename: `${name}-comparison.json` });
  } catch {
    return {
      kind: "unavailable",
      message: "Only a compatible pair of completed results can be exported.",
    };
  }
}
