import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lqCoefficientCorrespondence,
  lqWienEntropyDerivation,
} from "../../equations/derivations/lightQuantaEntropy.ts";
import { verifyLqCoefficientCorrespondence } from "../../equations/derivations/lightQuantaCoefficientProof.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import { type Expression, walk } from "../../equations/ast.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";

const ROOT = process.cwd();
const directory = join(ROOT, "content/equations/light-quanta");
const equations = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) =>
    parseEquationRecord(JSON.parse(readFileSync(join(directory, name), "utf8")), name),
  );
const records = loadResultCards(ROOT, "light-quanta");

function card(id: string): ResultCardRecord {
  const found = records?.cards.find((candidate) => candidate.id === id);
  if (!found) throw new Error("Missing light-quanta result " + id);
  return found;
}

function project(record: ResultCardRecord, source: readonly EquationRecord[] = equations) {
  const passages = new Map(
    record.arguments.map((id) => {
      const passage = JSON.parse(
        readFileSync(join(ROOT, "content/arguments/light-quanta", id + ".json"), "utf8"),
      ) as { limitations: string[] };
      return [id, passage] as const;
    }),
  );
  return toCard(ROOT, record, passages, undefined, undefined, source);
}

function equation(id: string): EquationRecord {
  const found = equations.find((record) => record.id === id);
  if (!found) throw new Error("Missing canonical equation " + id);
  return found;
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  throw new Error("Expected light-quanta result support to be refused.");
}

function inputsWith(changed: EquationRecord): readonly EquationRecord[] {
  return equations.map((record) => (record.id === changed.id ? changed : record));
}

describe("the light-quanta card supports the conditional molar energy scale", () => {
  test("the result projection retains heuristic, domain and upstream-law premises", () => {
    expect(records?.problems).toEqual([]);
    const report = verifyLqCoefficientCorrespondence(lqCoefficientCorrespondence);
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports).toHaveLength(4);
    expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);

    const support = project(card("lq-energy-quanta")).support;
    if (support?.kind !== "checked-proof") throw new Error("Missing coefficient support.");
    expect(support.proofId).toBe("lq-entropy-energy-scale");
    expect(support.href).toBe("/papers/light-quanta/s6/#lq-entropy-correspondence-derivation");
    expect(support.conclusion.equationId).toBe("eq-model-lq-energy-per-point-molar");
    expect(support.scope).toContain("heuristic");
    expect(support.scope).toContain("remain premises");
    const ids = support.assumptions.map((premise) => premise.id);
    for (const premise of lqCoefficientCorrespondence.entryAssumptions)
      expect(ids).toContain(premise.ref);
    const comparison = support.assumptions.find(
      (premise) => premise.id === "lq-nontrivial-volume-ratio",
    );
    expect(comparison?.explanation).toContain("cannot identify an effective count");

    const quantities = walk(equation(support.conclusion.equationId).tree)
      .filter((node) => node.kind === "symbol")
      .map((node) => node.quantityId);
    expect(quantities).toContain("molarGasConstant");
    expect(quantities).toContain("avogadroConstant");
    expect(quantities.includes("planckConstant")).toBe(false);
    expect(quantities.includes("boltzmannConstant")).toBe(false);
  });

  test("the support owner refuses a missing comparison, count, substitution or conclusion", () => {
    for (const removed of lqCoefficientCorrespondence.steps) {
      const changed = {
        ...lqCoefficientCorrespondence,
        steps: lqCoefficientCorrespondence.steps.filter((step) => step.id !== removed.id),
      };
      expect(verifyLqCoefficientCorrespondence(changed).passed).toBe(false);
    }
  });

  test("the upstream entropy calculus remains unverified", () => {
    expect(verifyChain(lqWienEntropyDerivation, { isPublicationGate: true }).passed).toBe(false);
    for (const id of ["lq-entropy-temperature", "lq-radiation-entropy-volume"]) {
      expect(card(id).support.kind).toBe("no-checked-proof");
      expect(project(card(id)).support).toBeUndefined();
    }
  });

  test("wrong coefficients in the conclusion or an admitted entropy law are rejected", () => {
    for (const id of ["eq-model-lq-energy-per-point-molar", "eq-model-lq-volume-entropy"]) {
      const original = equation(id);
      if (original.tree.kind !== "relation") throw new Error("Expected an equation.");
      const tree: Expression = {
        ...original.tree,
        right: {
          kind: "product",
          args: [{ kind: "number", value: "2" }, original.tree.right],
        },
      };
      const changed = parseEquationRecord({ ...original, tree }, "wrong coefficient in " + id);
      expect(JSON.stringify(changed.tree)).not.toBe(JSON.stringify(original.tree));
      expect(refusal(() => project(card("lq-energy-quanta"), inputsWith(changed)))).toBe(
        "result-support-derivation-record-mismatch",
      );
    }
  });

  test("removing the independence assumption or an admitted law cannot retain support", () => {
    const gas = equation("eq-model-lq-gas-entropy-change");
    const changed = { ...gas, assumptions: ["The points may have arbitrary correlations."] };
    expect(refusal(() => checkedSupportFor(card("lq-energy-quanta"), inputsWith(changed)))).toBe(
      "result-support-derivation-record-mismatch",
    );
    const missing = equations.filter((record) => record.id !== gas.id);
    expect(refusal(() => checkedSupportFor(card("lq-energy-quanta"), missing))).toBe(
      "result-support-derivation-record-mismatch",
    );
  });

  test("the modern hν equation is not a conclusion of the molar-constant check", () => {
    const control = card("lq-energy-quanta");
    expect(project(control).support).toBeDefined();
    if (control.support.kind !== "checked-proof") throw new Error("Missing control proof.");
    const changed = {
      ...control,
      support: { ...control.support, conclusion: "eq-model-lq-energy-per-point" },
    };
    expect(refusal(() => checkedSupportFor(changed, equations))).toBe(
      "result-support-derivation-conclusion-missing",
    );
  });
});
