/**
 * Build-time bridge from the §6 result card to its exact field-identity owner.
 * The source-order physical identification and normalization remain premises.
 */
import bxRecord from "../../../content/equations/special-relativity/eq-model-sr-field-bx.json";
import byRecord from "../../../content/equations/special-relativity/eq-model-sr-field-by.json";
import bzRecord from "../../../content/equations/special-relativity/eq-model-sr-field-bz.json";
import exRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ex.json";
import eyRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ey.json";
import ezRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ez.json";
import {
  verifySRFieldCovariance,
  verifySRFieldSIComponents,
} from "../../equations/derivations/srFieldCovariance.ts";
import type { SRFieldComponent } from "../../equations/derivations/srFieldTransforms.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

const components: readonly SRFieldComponent[] = ["X", "Y", "Z", "L", "M", "N"];
const records = [exRecord, eyRecord, ezRecord, bxRecord, byRecord, bzRecord];

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-field-not-checked", `${cardId}: ${reason}`);
}

export function checkedFieldCovarianceSupport(
  cardId: string,
  declaration: Readonly<{ conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  if (
    conclusion.paper !== "special-relativity" ||
    declaration.conclusion !== eyRecord.id ||
    conclusion.id !== eyRecord.id
  )
    unsupported(cardId, "The covariance support must name the §6 candidate field component.");

  const actualRecords = records.map((expected) => {
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
      unsupported(
        cardId,
        `${expected.id} is missing, repeated, or differs from its identity or premises.`,
      );
    return actual;
  });
  // Identity and premise matching is only integrity. Check the supplied trees
  // themselves: even a corrupted canonical SI formula must fail the exact bridge.
  const si = verifySRFieldSIComponents(
    actualRecords.map((record, index) => ({ component: components[index]!, tree: record.tree })),
  );
  const covariance = verifySRFieldCovariance();
  if (!si.passed || !covariance.passed)
    unsupported(
      cardId,
      si.reason ??
        covariance.reason ??
        "The candidate components do not have checked field identities.",
    );

  return {
    kind: "checked-proof",
    proofId: "sr-field-covariance",
    title: "Check the six vacuum field identities",
    href: "/papers/special-relativity/s6/#sr-field-covariance-check",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: [
      {
        id: "sr-field-coordinate-map",
        label: "The coordinate map of §3",
        explanation:
          "The constant Lorentz boost is admitted, with c > 0 and |v| < c. The calculation uses the chain rule and gamma²(1 − v²/c²) = 1; it does not derive the coordinate map from the fields.",
      },
      {
        id: "sr-field-original-curls",
        label: "The original six Maxwell–Hertz curl equations",
        explanation:
          "The checked residual identities imply transformed equations only when the original curl equations hold. The algebra allows the local fields and their first derivatives to vary independently.",
      },
      {
        id: "sr-field-vacuum-divergences",
        label: "Both vacuum divergence conditions",
        explanation:
          "Zero electric divergence is needed for the component along the boost in the electric equation, and zero magnetic divergence for its magnetic counterpart. The other four residual identities need no additional divergence premise.",
      },
      {
        id: "sr-field-identification-and-normalization",
        label: "Physical identification and normalization are separate",
        explanation:
          "The candidate functions are checked with common factor ψ = 1. Identifying them with measured moving fields and selecting that factor require the additional physical, symmetry and continuity premises explained in the source-order derivation.",
      },
      {
        id: "sr-field-si-conversion",
        label: "SI notation is an explicit unit conversion",
        explanation:
          "With one common electric-field scale, a Gaussian magnetic component is c times its SI counterpart. All six displayed SI formulas are checked through this conversion; changing a symbol's name alone would not suffice.",
      },
    ],
  };
}
