/** Server-side joins and historical arithmetic for the §2 reader; no checker enters its lazy chunk. */
import {
  type LqPlanckDerivationPayload,
  lqPlanckAssumptions,
  lqPlanckCheckRows,
  lqPlanckInput,
  lqPlanckRecords,
} from "../../equations/derivations/lightQuantaPlanck.ts";
import { verifyLqPlanckConstants } from "../../equations/derivations/lightQuantaPlanckProof.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { avogadroFromPlanckConstants } from "../../physics/reference/radiation/avogadro.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport, ResultSupportDeclaration } from "./supportDeclarations.ts";

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-lq-planck-not-checked", `${cardId}: ${reason}`);
}
export function checkedLqPlanckSupport(
  cardId: string,
  declaration: Extract<ResultSupportDeclaration, { kind: "checked-proof" }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  if (
    declaration.proofId !== "lq-planck-molecular-number" ||
    declaration.conclusion !== "eq-model-lq-avogadro-from-spectrum" ||
    conclusion.id !== declaration.conclusion ||
    conclusion.paper !== "light-quanta"
  )
    unsupported(
      cardId,
      "This owner establishes the molecular-number inference from the low-frequency spectral comparison.",
    );
  const records = lqPlanckRecords.map((expected) => {
    const matches = equations.filter((record) => record.id === expected.id);
    const actual = matches[0];
    if (
      matches.length !== 1 ||
      !actual ||
      actual.paper !== expected.paper ||
      actual.argument !== expected.argument ||
      actual.notation !== expected.notation ||
      actual.unitSystem !== expected.unitSystem ||
      JSON.stringify(actual.assumptions) !== JSON.stringify(expected.assumptions)
    )
      unsupported(
        cardId,
        `${expected.id} is missing, repeated, or changes the admitted premises and units.`,
      );
    return actual;
  });
  const [spectrum, classical, coefficient, inference] = records;
  if (!spectrum || !classical || !coefficient || !inference)
    unsupported(cardId, "All four actual equation records are required.");
  const checked = verifyLqPlanckConstants({
    ...lqPlanckInput,
    lowFrequency: spectrum.tree,
    classical: classical.tree,
    coefficient: coefficient.tree,
    conclusion: inference.tree,
  });
  const passed = new Set<string>(checked.rows.filter((row) => row.passed).map((row) => row.id));
  if (!checked.passed || lqPlanckCheckRows.some((id) => !passed.has(id)))
    unsupported(
      cardId,
      checked.reason ??
        "The supplied expressions do not establish the analytic limit and coefficient inference.",
    );
  return {
    kind: "checked-proof",
    proofId: "lq-planck-molecular-number",
    title: "Follow the low-frequency limit and the molecular-number inference",
    href: "/papers/light-quanta/s2/#lq-planck-constants-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: lqPlanckAssumptions,
  };
}

/** Reuses the historical reference owner and transmits only the small display payload. */
export function buildLqPlanckDerivationPayload(): LqPlanckDerivationPayload {
  const cardId = "lq-planck-constants";
  const checked = verifyLqPlanckConstants();
  if (!checked.passed || !checked.limit)
    unsupported(cardId, checked.reason ?? "The analytic limit is absent.");
  const set = getConstantSet("einstein-1905-light-quanta-printed");
  const entry = (quantityId: string) => {
    const found = set.entries.find((candidate) => candidate.quantityId === quantityId);
    if (!found || !Number.isFinite(found.value) || found.value <= 0)
      unsupported(cardId, `The historical calculation needs its positive ${quantityId} input.`);
    return found;
  };
  const alpha = entry("wienConstantAlpha");
  const printed = alpha.printedReading;
  const match =
    typeof printed === "string" ? /^(\d+(?:,\d+)?)\s*·\s*10\^(-?\d+)$/.exec(printed) : null;
  const printedAlpha = match
    ? Number(match[1]?.replace(",", ".")) * 10 ** Number(match[2])
    : Number.NaN;
  if (!printed || !Number.isFinite(printedAlpha) || printedAlpha <= 0)
    unsupported(
      cardId,
      "The printed alpha must remain a separately identified historical reading.",
    );
  const calculated = avogadroFromPlanckConstants(set);
  const withPrintedExponent = avogadroFromPlanckConstants({
    ...set,
    entries: set.entries.map((value) =>
      value.quantityId === alpha.quantityId
        ? { ...value, value: printedAlpha, exactDecimal: printedAlpha.toExponential() }
        : value,
    ),
  });
  const inputLabels = [
    {
      quantityId: "wienConstantAlpha",
      label: "A (the paper's α)",
      role: "Spectral fit, with the edition's exponent choice",
      provenance:
        "The edition uses −57 for this numerical reconstruction. The printed display has −56 and remains unchanged.",
    },
    {
      quantityId: "wienConstantBeta",
      label: "B (the paper's β)",
      role: "Spectral fit",
      provenance: "Printed in §2 on p. 136.",
    },
    {
      quantityId: "molarGasConstant",
      label: "R",
      role: "Separate gas input",
      provenance: "An editorial historical numerical input: §2 does not print a number for R.",
    },
    {
      quantityId: "speedOfLight",
      label: "c (the paper's L)",
      role: "Separate light-speed input",
      provenance: "An editorial historical numerical input: §2 does not print a number for L.",
    },
  ] as const;
  return {
    limit: {
      value: checked.limit.limit,
      quotientAtZero: checked.limit.quotientAtZero,
      coefficients: checked.limit.coefficients,
    },
    worked: {
      inputs: inputLabels.map((input) => {
        const value = entry(input.quantityId);
        return { ...input, value: value.exactDecimal ?? String(value.value), unit: value.unit };
      }),
      alphaAsPrinted: printed,
      calculatedN: calculated.avogadroConstant.toExponential(6),
      printedN: calculated.printedAvogadroConstant.toExponential(2),
      printedExponentN: withPrintedExponent.avogadroConstant.toExponential(6),
      modernN: calculated.modernComparisons.modernAvogadro.toExponential(8),
    },
  };
}
