import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyBrownianEquilibrium } from "../../equations/derivations/brownianEquilibriumProof.ts";
import {
  brownianEquilibriumDerivation,
  brownianKernelDerivation,
} from "../../equations/derivations/brownianSource.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";

const ROOT = process.cwd();
const directory = join(ROOT, "content/equations/brownian-motion");
const equations = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) =>
    parseEquationRecord(JSON.parse(readFileSync(join(directory, name), "utf8")), name),
  );
const records = loadResultCards(ROOT, "brownian-motion");

function card(id: string): ResultCardRecord {
  const found = records?.cards.find((candidate) => candidate.id === id);
  if (!found) throw new Error("Missing Brownian result " + id);
  return found;
}

function project(record: ResultCardRecord, source: readonly EquationRecord[] = equations) {
  const passages = new Map(
    record.arguments.map((id) => {
      const passage = JSON.parse(
        readFileSync(join(ROOT, "content/arguments/brownian-motion", id + ".json"), "utf8"),
      ) as { limitations: string[] };
      return [id, passage] as const;
    }),
  );
  return toCard(ROOT, record, passages, undefined, undefined, source);
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  throw new Error("Expected Brownian result support to be refused.");
}

function conclusion(): EquationRecord {
  const found = equations.find((record) => record.id === "eq-model-bm-diffusivity-molar");
  if (!found) throw new Error("Missing canonical diffusivity.");
  return found;
}

function replaceConclusion(changed: EquationRecord): readonly EquationRecord[] {
  return equations.map((record) => (record.id === changed.id ? changed : record));
}

describe("Brownian diffusivity support reaches the checked conditional equilibrium chain", () => {
  test("the actual result projection retains every admitted model and domain premise", () => {
    expect(records?.problems).toEqual([]);
    const report = verifyBrownianEquilibrium(brownianEquilibriumDerivation);
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports).toHaveLength(7);
    expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);

    const result = project(card("bm-diffusion-coefficient"));
    const support = result.support;
    expect(support?.kind).toBe("checked-proof");
    if (support?.kind !== "checked-proof") throw new Error("No checked support.");
    expect(support.proofId).toBe("bm-equilibrium-diffusivity");
    expect(support.href).toBe("/papers/brownian-motion/s3/#bm-equilibrium-derivation");
    expect(support.conclusion.equationId).toBe("eq-model-bm-diffusivity-molar");
    expect(support.scope).toContain("physical premises");
    expect(support.scope).toContain("remain assumptions");
    const ids = support.assumptions.map((premise) => premise.id);
    for (const premise of brownianEquilibriumDerivation.entryAssumptions)
      expect(ids).toContain(premise.ref);
    expect(ids).toContain("bm-drift-particle-flux");
    const comparison = support.assumptions.find(
      (premise) => premise.id === "bm-nonzero-gradient-comparison",
    );
    expect(comparison?.explanation).toContain("0 = 0");
    expect(comparison?.explanation).toContain("does not determine D");
  });

  test("the support owner requires every equilibrium stage", () => {
    for (const removed of brownianEquilibriumDerivation.steps) {
      const changed = {
        ...brownianEquilibriumDerivation,
        steps: brownianEquilibriumDerivation.steps.filter((step) => step.id !== removed.id),
      };
      expect(verifyBrownianEquilibrium(changed).passed).toBe(false);
    }
  });

  test("coefficient support leaves the jump-law calculus and displacement law unverified", () => {
    expect(verifyChain(brownianKernelDerivation, { isPublicationGate: true }).passed).toBe(false);
    for (const id of ["bm-diffusion-equation", "bm-displacement-law"]) {
      expect(card(id).support.kind).toBe("no-checked-proof");
      expect(project(card(id)).support).toBeUndefined();
    }
  });

  test("a changed canonical coefficient is rejected by the real result projection", () => {
    const source = conclusion();
    const before = JSON.stringify(source);
    const after = before.replace('"value":"6"', '"value":"12"');
    expect(after).not.toBe(before);
    const wrong = parseEquationRecord(JSON.parse(after), "wrong Brownian drag coefficient");
    expect(refusal(() => project(card("bm-diffusion-coefficient"), replaceConclusion(wrong)))).toBe(
      "result-support-derivation-record-mismatch",
    );
  });

  test("changing or removing the supplied physical premises cannot retain checked support", () => {
    const source = conclusion();
    const altered = [[], ["The drag law is assumed valid for arbitrary particle shapes."]];
    for (const assumptions of altered) {
      const changed = { ...source, assumptions };
      expect(
        refusal(() =>
          checkedSupportFor(card("bm-diffusion-coefficient"), replaceConclusion(changed)),
        ),
      ).toBe("result-support-derivation-record-mismatch");
    }
  });

  test("a missing, duplicated or unrelated conclusion is not evidence for this card", () => {
    const control = card("bm-diffusion-coefficient");
    expect(project(control).support).toBeDefined();
    expect(refusal(() => checkedSupportFor(control, []))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(refusal(() => checkedSupportFor(control, [...equations, conclusion()]))).toBe(
      "result-support-derivation-record-mismatch",
    );
    if (control.support.kind !== "checked-proof") throw new Error("Missing control proof.");
    const changed = {
      ...control,
      support: { ...control.support, conclusion: "eq-model-bm-diffusivity" },
    };
    expect(refusal(() => checkedSupportFor(changed, equations))).toBe(
      "result-support-derivation-conclusion-missing",
    );
  });
});
