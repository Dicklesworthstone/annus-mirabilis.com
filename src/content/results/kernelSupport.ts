/**
 * Connect the source-order jump calculation to its conditional continuum conclusion.
 * The exact owner checks coefficients and remainders; convergence is an explicit premise.
 */
import {
  brownianKernelAssumptions,
  brownianKernelCheckRows,
  brownianKernelInput,
  brownianKernelRecords,
} from "../../equations/derivations/brownianKernel.ts";
import { verifyBrownianKernel } from "../../equations/derivations/brownianKernelProof.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-kernel-not-checked", `${cardId}: ${reason}`);
}

export function checkedKernelSupport(
  cardId: string,
  declaration: Readonly<{ conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  if (
    conclusion.paper !== "brownian-motion" ||
    declaration.conclusion !== "eq-model-bm-diffusion-equation" ||
    conclusion.id !== declaration.conclusion
  )
    unsupported(
      cardId,
      "The jump-law calculation must conclude the conditional diffusion equation.",
    );

  function supplied(expected: (typeof brownianKernelRecords)[number]): EquationRecord {
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
  const [next, timeTaylor, spaceTaylor, jumpMoment, diffusion] = brownianKernelRecords;
  const report = verifyBrownianKernel({
    ...brownianKernelInput,
    next: supplied(next).tree,
    timeTaylor: supplied(timeTaylor).tree,
    spaceTaylor: supplied(spaceTaylor).tree,
    jumpMoment: supplied(jumpMoment).tree,
    diffusion: supplied(diffusion).tree,
  });
  const checked = new Set(report.rows.filter((row) => row.passed).map((row) => row.id));
  if (!report.passed || brownianKernelCheckRows.some((row) => !checked.has(row.id)))
    unsupported(
      cardId,
      report.reason ?? "The supplied jump-law coefficients and residual do not pass.",
    );

  return {
    kind: "checked-proof",
    proofId: "bm-kernel-diffusion",
    title: "Follow the jump law, its remainder, and the diffusion limit",
    href: "/papers/brownian-motion/s4/#bm-kernel-checked-calculus",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: brownianKernelAssumptions,
  };
}
