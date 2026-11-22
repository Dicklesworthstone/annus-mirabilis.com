/**
 * Connect the historical displacement result to the actual diffusivity and RMS records.
 * Exact substitution is separate from the physical premises and the printed rounding.
 */
import {
  brownianPredictionAssumptions,
  brownianPredictionCheckRows,
  brownianPredictionInput,
  brownianPredictionRecords,
} from "../../equations/derivations/brownianPrediction.ts";
import { verifyBrownianPrediction } from "../../equations/derivations/brownianPredictionProof.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-prediction-not-checked", `${cardId}: ${reason}`);
}

export function checkedPredictionSupport(
  cardId: string,
  declaration: Readonly<{ conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  if (
    conclusion.paper !== "brownian-motion" ||
    declaration.conclusion !== "eq-model-bm-predicted-displacement" ||
    conclusion.id !== declaration.conclusion
  )
    unsupported(
      cardId,
      "The prediction calculation must conclude the combined displacement formula.",
    );

  function supplied(expected: (typeof brownianPredictionRecords)[number]): EquationRecord {
    const matches = equations.filter((record) => record.id === expected.id);
    const actual = matches[0];
    if (
      matches.length !== 1 ||
      !actual ||
      actual.paper !== expected.paper ||
      actual.argument !== expected.argument ||
      actual.unitSystem !== expected.unitSystem ||
      JSON.stringify(actual.assumptions) !== JSON.stringify(expected.assumptions)
    )
      unsupported(cardId, `${expected.id} is missing, repeated, or differs from its premises.`);
    return actual;
  }
  const [diffusivity, rms, prediction] = brownianPredictionRecords;
  const report = verifyBrownianPrediction({
    ...brownianPredictionInput,
    diffusivity: supplied(diffusivity).tree,
    rms: supplied(rms).tree,
    prediction: supplied(prediction).tree,
  });
  const checked = new Set(report.rows.filter((row) => row.passed).map((row) => row.id));
  if (!report.passed || brownianPredictionCheckRows.some((row) => !checked.has(row.id)))
    unsupported(
      cardId,
      report.reason ?? "The supplied diffusivity, RMS and combined formula do not pass.",
    );

  return {
    kind: "checked-proof",
    proofId: "bm-historical-displacement",
    title: "Join diffusivity to the predicted displacement",
    href: "/papers/brownian-motion/s5/#bm-prediction-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: brownianPredictionAssumptions,
  };
}
