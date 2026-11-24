/** Join §§1 and 5 to their exact conditional calculations, using the supplied content corpus. */
import {
  classicalCutoffAssumptions,
  classicalCutoffCheckRows,
  classicalCutoffInput,
  classicalCutoffRecords,
  independentEntropyAssumptions,
  independentEntropyCheckRows,
  independentEntropyInput,
  independentEntropyRecords,
} from "../../equations/derivations/lightQuantaFoundations.ts";
import {
  verifyClassicalCutoff,
  verifyIndependentEntropy,
} from "../../equations/derivations/lightQuantaFoundationsProof.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport, ResultSupportDeclaration } from "./supportDeclarations.ts";

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-lq-foundations-not-checked", `${cardId}: ${reason}`);
}

export function checkedLqFoundationsSupport(
  cardId: string,
  declaration: Extract<ResultSupportDeclaration, { kind: "checked-proof" }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  const classical = declaration.proofId === "lq-classical-cutoff";
  if (!classical && declaration.proofId !== "lq-independent-entropy")
    unsupported(
      cardId,
      "This calculation owns the classical cutoff or independent-point entropy result.",
    );
  const conclusionId = classical ? "eq-model-lq-cutoff-total" : "eq-model-lq-configuration-entropy";
  if (
    conclusion.paper !== "light-quanta" ||
    declaration.conclusion !== conclusionId ||
    conclusion.id !== conclusionId
  )
    unsupported(
      cardId,
      "The supplied conclusion must be the result established by this calculation.",
    );

  const expectedRecords = classical ? classicalCutoffRecords : independentEntropyRecords;
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
      unsupported(cardId, `${expected.id} is missing, repeated, or changes the admitted premises.`);
    return actual;
  });
  const [first, second, third] = records;
  if (!first || !second)
    unsupported(cardId, "The calculation requires its supplied premise equations.");
  const checked = classical
    ? verifyClassicalCutoff({
        ...classicalCutoffInput,
        density: first.tree,
        integral: second.tree,
        total:
          third?.tree ?? unsupported(cardId, "The supplied finite-cutoff conclusion is absent."),
      })
    : verifyIndependentEntropy({
        ...independentEntropyInput,
        probability: first.tree,
        principle: second.tree.kind === "relation" ? second.tree.left : second.tree,
        entropy: second.tree,
      });
  const required = classical ? classicalCutoffCheckRows : independentEntropyCheckRows;
  const passed = new Set<string>(checked.rows.filter((row) => row.passed).map((row) => row.id));
  if (!checked.passed || required.some((id) => !passed.has(id)))
    unsupported(
      cardId,
      checked.reason ?? "The supplied equations do not pass the exact calculation.",
    );

  return {
    kind: "checked-proof",
    proofId: classical ? "lq-classical-cutoff" : "lq-independent-entropy",
    title: classical
      ? "Follow the classical spectrum to a finite cutoff and its unbounded growth"
      : "Follow independent-point probability to its entropy-volume law",
    href: classical
      ? "/papers/light-quanta/s1/#lq-classical-cutoff-derivation"
      : "/papers/light-quanta/s5/#lq-independent-entropy-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: classical ? classicalCutoffAssumptions : independentEntropyAssumptions,
  };
}
