import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import criterionRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-equal-legs.json";
import midpointRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-midpoint.json";
import { srSynchronizationChain } from "../../equations/derivations/srSynchronization.ts";
import type { DerivationStep } from "../../equations/derivations/types.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { FaceFallback } from "../../reader/FaceFallback.tsx";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";

const ROOT = process.cwd();
const equations = [
  parseEquationRecord(criterionRecord, "synchronization criterion"),
  parseEquationRecord(midpointRecord, "midpoint consequence"),
];
const records = loadResultCards(ROOT, "special-relativity");

function card(id = "sr-synchronous-clocks"): ResultCardRecord {
  const found = records?.cards.find((record) => record.id === id);
  if (!found) throw new Error("Missing synchronization result " + id);
  return found;
}

function project(record = card(), source: readonly EquationRecord[] = equations) {
  const passages = new Map(
    record.arguments.map((id) => {
      const passage = JSON.parse(
        readFileSync(join(ROOT, "content/arguments/special-relativity", id + ".json"), "utf8"),
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
  throw new Error("Expected synchronization support to be refused.");
}

describe("synchronization results expose the consequence of the chosen definition", () => {
  test("the actual chain checks every transformation at the publication boundary", () => {
    const report = verifyChain(srSynchronizationChain, { isPublicationGate: true });
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports.length).toBeGreaterThan(0);
    expect(report.stepReports).toHaveLength(srSynchronizationChain.steps.length);
    expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
  });

  test("support retains all entry assumptions and distinguishes a convention from a measurement", () => {
    expect(records?.problems).toEqual([]);
    const support = project().support;
    if (support?.kind !== "checked-proof") throw new Error("Missing midpoint support.");
    expect(support).toEqual(checkedSupportFor(card(), equations));
    expect(support.proofId).toBe("sr-synchronization-midpoint");
    expect(support.conclusion.equationId).toBe(midpointRecord.id);
    expect(support.scope).toContain("after adopting");
    expect(support.scope).toContain("does not measure either one-way light speed");
    expect(support.scope).toContain("entire clock network");
    const premises = new Map(support.assumptions.map((premise) => [premise.id, premise]));
    for (const premise of srSynchronizationChain.entryAssumptions)
      expect(premises.has(premise.ref)).toBe(true);
    expect(premises.get("arg-sr-synchronization")?.explanation).toContain(
      "do not measure either one-way duration independently",
    );
    expect(
      premises.get("sr-synchronization-return-after-departure")?.explanation,
    ).toContain("departure reading is not zero");
  });

  test("the static results route links to the actual section's complete derivation", async () => {
    const results = await exportMarkup(
      await FaceFallback({ paperId: "special-relativity", face: "results" }),
    );
    const start = results.indexOf('id="result-sr-synchronous-clocks"');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = results.indexOf('<article class="result-card"', start + 1);
    const result = results.slice(start, end < 0 ? undefined : end);
    expect(result).toContain('data-proof-id="sr-synchronization-midpoint"');
    expect(result).toContain('data-conclusion-equation="eq-model-sr-sync-midpoint"');
    expect(result).toContain("Why should I believe this step?");
    expect(result).toContain("What this route uses");
    expect(result).toContain(
      'href="/papers/special-relativity/s1/#sr-synchronization-derivation"',
    );
    const section = await exportMarkup(
      await PaperPage({ paperId: "special-relativity", section: "s1" }),
    );
    expect(section).toContain('id="sr-synchronization-derivation"');
    for (const step of srSynchronizationChain.steps)
      expect(section).toContain('data-step-id="' + step.id + '"');
  });

  test("the admitted definition cannot be relabelled as the proved conclusion", () => {
    const control = card();
    if (control.support.kind !== "checked-proof") throw new Error("Missing control proof.");
    const changed = {
      ...control,
      support: { ...control.support, conclusion: criterionRecord.id },
    };
    expect(refusal(() => project(changed))).toBe(
      "result-support-derivation-conclusion-missing",
    );
    expect(checkedSupportFor(card("sr-two-postulates"), equations)).toBeUndefined();
  });

  test("a wrong midpoint divisor or altered definition refuses support before rendering", () => {
    const midpoint = equations.find((equation) => equation.id === midpointRecord.id);
    const criterion = equations.find((equation) => equation.id === criterionRecord.id);
    if (!midpoint || !criterion) throw new Error("Missing canonical controls.");
    const original = JSON.stringify(midpoint);
    const wrong = original.replace('"value":"2"', '"value":"3"');
    expect(wrong).not.toBe(original);
    const changedMidpoint = parseEquationRecord(JSON.parse(wrong), "wrong midpoint divisor");
    const changedCriterion = {
      ...criterion,
      assumptions: ["The two one-way durations have been independently measured."],
    };
    for (const changed of [changedMidpoint, changedCriterion]) {
      const source = equations.map((equation) =>
        equation.id === changed.id ? changed : equation,
      );
      expect(refusal(() => project(card(), source))).toBe(
        "result-support-derivation-record-mismatch",
      );
    }
  });

  test("a missing or repeated definition cannot retain a checked consequence", () => {
    const criterion = equations.find((equation) => equation.id === criterionRecord.id);
    if (!criterion) throw new Error("Missing definition control.");
    for (const source of [
      equations.filter((equation) => equation.id !== criterion.id),
      [...equations, criterion],
    ]) {
      expect(refusal(() => project(card(), source))).toBe(
        "result-support-derivation-record-mismatch",
      );
    }
  });

  test("the result projection runs the real chain checker on every use", () => {
    const steps = srSynchronizationChain.steps as DerivationStep[];
    const index = steps.findIndex((step) => step.id === "sr-synchronization-midpoint-reading");
    const original = steps[index];
    if (!original) throw new Error("Missing midpoint step control.");
    expect(project().support).toBeDefined();
    try {
      steps[index] = { ...original, to: { kind: "number", value: "0" } };
      expect(refusal(() => project())).toBe("result-support-derivation-not-checked");
    } finally {
      steps[index] = original;
    }
    expect(project().support).toBeDefined();
  });
});
