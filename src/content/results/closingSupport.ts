/** Join the closing light-quantum results to their exact, conditional energy accounts. */
import {
  fluorescenceClosingAssumptions,
  fluorescenceClosingCheckRows,
  fluorescenceClosingInput,
  fluorescenceClosingRecords,
  ionizationClosingAssumptions,
  ionizationClosingCheckRows,
  ionizationClosingInput,
  ionizationClosingRecords,
  verifyFluorescenceClosing,
  verifyIonizationClosing,
} from "../../equations/derivations/lightQuantaClosingProof.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport, ResultSupportDeclaration } from "./supportDeclarations.ts";

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-closing-quanta-not-checked", `${cardId}: ${reason}`);
}

export function checkedClosingSupport(
  cardId: string,
  declaration: Extract<ResultSupportDeclaration, { kind: "checked-proof" }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  const fluorescence = declaration.proofId === "lq-fluorescence-energy";
  if (!fluorescence && declaration.proofId !== "lq-ionization-energy-count")
    unsupported(cardId, "The declared proof does not own a closing light-quantum argument.");
  const conclusionId = fluorescence
    ? "eq-model-lq-fluorescence-bound"
    : "eq-model-lq-ion-count-bound";
  if (
    conclusion.paper !== "light-quanta" ||
    declaration.conclusion !== conclusionId ||
    conclusion.id !== conclusionId
  )
    unsupported(cardId, "The energy account must establish its own declared bound.");

  const expectedRecords = fluorescence ? fluorescenceClosingRecords : ionizationClosingRecords;
  const records = expectedRecords.map((expected) => {
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
      unsupported(cardId, `${expected.id} is missing, repeated, or differs from its premises.`);
    return actual;
  });

  // Check every supplied tree. The proof owner's imported defaults cannot stand in
  // for a changed threshold or bound in the content being published.
  const [first, second] = records;
  if (!first) unsupported(cardId, "The energy account has no supplied canonical equation.");
  const report = fluorescence
    ? verifyFluorescenceClosing({ ...fluorescenceClosingInput, energyBound: first.tree })
    : verifyIonizationClosing({
        ...ionizationClosingInput,
        threshold: first.tree,
        countBound: second?.tree ?? unsupported(cardId, "The supplied ion-count bound is absent."),
      });
  const requiredRows = fluorescence ? fluorescenceClosingCheckRows : ionizationClosingCheckRows;
  const checked = new Set(report.rows.filter((row) => row.passed).map((row) => row.id));
  if (!report.passed || requiredRows.some((id) => !checked.has(id)))
    unsupported(cardId, report.reason ?? "The supplied energy equations fail their exact check.");

  return {
    kind: "checked-proof",
    proofId: fluorescence ? "lq-fluorescence-energy" : "lq-ionization-energy-count",
    title: fluorescence
      ? "Follow one quantum's energy to Stokes's frequency bound"
      : "Separate the necessary ionization threshold from the conditional ion count",
    href: fluorescence
      ? "/papers/light-quanta/s7/#lq-fluorescence-derivation"
      : "/papers/light-quanta/s9/#lq-ionization-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: fluorescence ? fluorescenceClosingAssumptions : ionizationClosingAssumptions,
  };
}
