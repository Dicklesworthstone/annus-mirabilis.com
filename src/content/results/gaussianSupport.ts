/**
 * Join the displacement result to the Gaussian calculation actually shown in §4.
 * Verifying a positive-time density is separate from deriving the microscopic diffusion model.
 */
import {
  brownianGaussianAssumptions,
  brownianGaussianCheckRows,
  brownianGaussianInput,
  brownianGaussianRecords,
} from "../../equations/derivations/brownianGaussian.ts";
import { verifyBrownianGaussian } from "../../equations/derivations/brownianGaussianProof.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-gaussian-not-checked", `${cardId}: ${reason}`);
}

export function checkedGaussianSupport(
  cardId: string,
  declaration: Readonly<{ conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  if (
    conclusion.paper !== "brownian-motion" ||
    declaration.conclusion !== "eq-model-bm-rms-from-mean-square" ||
    conclusion.id !== declaration.conclusion
  )
    unsupported(cardId, "The Gaussian proof must conclude the one-coordinate RMS displacement.");

  const records = brownianGaussianRecords.map((expected) => {
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
  });
  // Pass the supplied conclusion trees into the owner. Reusing its default imports
  // would silently credit a changed or corrupted equation with a different calculation.
  const report = verifyBrownianGaussian({
    ...brownianGaussianInput,
    moment: records[0]!.tree,
    growth: records[1]!.tree,
    rms: records[2]!.tree,
  });
  const checked = new Set(report.rows.filter((row) => row.passed).map((row) => row.id));
  if (!report.passed || brownianGaussianCheckRows.some((row) => !checked.has(row.id)))
    unsupported(
      cardId,
      report.reason ??
        "The supplied Gaussian, mean-square and RMS equations do not pass the exact check.",
    );

  return {
    kind: "checked-proof",
    proofId: "bm-gaussian-displacement",
    title: "Follow the Gaussian to mean square and RMS displacement",
    href: "/papers/brownian-motion/s4/#bm-gaussian-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: brownianGaussianAssumptions,
  };
}
