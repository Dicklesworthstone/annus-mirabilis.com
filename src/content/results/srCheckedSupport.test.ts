import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { srLightComplexDerivation } from "../../equations/derivations/srLightComplex.ts";
import type { DerivationStep } from "../../equations/derivations/types.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";
import type { ResultSupportDeclaration } from "./supportDeclarations.ts";

const ROOT = process.cwd();
const directory = join(ROOT, "content/equations/special-relativity");
const equations = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) =>
    parseEquationRecord(JSON.parse(readFileSync(join(directory, name), "utf8")), name),
  );
const records = loadResultCards(ROOT, "special-relativity");
const cases = [
  {
    card: "sr-light-complex-energy",
    proof: "sr-light-complex-energy",
    conclusion: "eq-model-sr-light-energy",
    section: "s8",
    anchor: "sr-light-complex-derivation",
  },
  {
    card: "sr-electron-masses",
    proof: "sr-electron-force-conventions",
    conclusion: "eq-model-sr-transverse-mass-printed",
    section: "s10",
    anchor: "sr-electron-conventions-derivation",
  },
  {
    card: "sr-electron-kinetic-energy",
    proof: "sr-electron-work",
    conclusion: "eq-model-sr-electron-work-result",
    section: "s10",
    anchor: "sr-electron-work-derivation",
  },
] as const;

function card(id: string): ResultCardRecord {
  const record = records?.cards.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing result card ${id}`);
  return record;
}

function project(record: ResultCardRecord, source: readonly EquationRecord[] = equations) {
  const passages = new Map(
    record.arguments.map((id) => {
      const passage = JSON.parse(
        readFileSync(join(ROOT, "content/arguments/special-relativity", `${id}.json`), "utf8"),
      ) as { limitations: string[] };
      return [id, passage] as const;
    }),
  );
  return toCard(ROOT, record, passages, undefined, undefined, source);
}

function withProof(record: ResultCardRecord, override: Record<string, unknown>): ResultCardRecord {
  if (record.support.kind !== "checked-proof") throw new Error("The control has no proof.");
  return {
    ...record,
    support: { ...record.support, ...override } as ResultSupportDeclaration,
  };
}

function rule(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  throw new Error("Expected the result support to be refused.");
}

describe("special-relativity results reach their executable teaching derivations", () => {
  test("the three real results name their conclusions and retain the admitted assumptions", () => {
    expect(records?.problems).toEqual([]);
    for (const entry of cases) {
      const support = project(card(entry.card)).support;
      expect(support?.kind).toBe("checked-proof");
      if (support?.kind !== "checked-proof") throw new Error("No checked support.");
      expect(support.proofId).toBe(entry.proof);
      expect(support.conclusion.equationId).toBe(entry.conclusion);
      expect(support.href).toBe(`/papers/special-relativity/${entry.section}/#${entry.anchor}`);
      expect(support.assumptions.length).toBeGreaterThan(0);
      expect(support.assumptions.map((premise) => premise.explanation).join(" ")).toContain(
        "|v| < c",
      );
      expect(support.scope.length).toBeGreaterThan(0);
    }
    expect(project(card("sr-two-postulates")).support).toBeUndefined();
  });

  test("the displayed support links land on actual section derivations", async () => {
    const sections = new Map<string, string>();
    for (const entry of cases) {
      const projected = project(card(entry.card));
      const html = await exportMarkup(createElement(ResultCard, { card: projected }));
      expect(html).toContain("Why should I believe this step?");
      expect(html).toContain(`data-proof-id="${entry.proof}"`);
      expect(html).toContain(`data-conclusion-equation="${entry.conclusion}"`);
      expect(html).toContain(`href="/papers/special-relativity/${entry.section}/#${entry.anchor}"`);
      expect(html).toContain("What this route uses");
      if (!sections.has(entry.section))
        sections.set(
          entry.section,
          await exportMarkup(
            await PaperPage({ paperId: "special-relativity", section: entry.section }),
          ),
        );
      expect(sections.get(entry.section)).toContain(`id="${entry.anchor}"`);
    }
  });

  test("wrong-paper and wrong-argument declarations cannot inherit a checked result", () => {
    const control = card("sr-light-complex-energy");
    expect(project(control).support).toBeDefined();
    expect(rule(() => project({ ...control, paper: "mass-energy" }))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(rule(() => project({ ...control, arguments: ["arg-sr-electron-work"] }))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(rule(() => project(withProof(control, { proofId: "me-ledger-elimination" })))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(rule(() => project(control, []))).toBe("result-support-conclusion-mismatch");
  });

  test("a different SR owner or an admitted premise cannot stand in for the conclusion", () => {
    const control = card("sr-light-complex-energy");
    for (const changed of [
      withProof(control, { proofId: "sr-electron-work" }),
      withProof(control, { conclusion: "eq-model-sr-light-density" }),
    ])
      expect(rule(() => project(changed))).toBe("result-support-derivation-conclusion-missing");
  });

  test("missing and repeated input equations refuse support before rendering", () => {
    const control = card("sr-light-complex-energy");
    const density = equations.find((equation) => equation.id === "eq-model-sr-light-density");
    if (!density) throw new Error("Missing density control.");
    for (const source of [
      equations.filter((equation) => equation.id !== density.id),
      [...equations, density],
    ])
      expect(rule(() => project(control, source))).toBe(
        "result-support-derivation-record-mismatch",
      );
  });

  test.each([
    ["sr-light-complex-energy", "eq-model-sr-light-density", '"num":2', '"num":3'],
    ["sr-light-complex-energy", "eq-model-sr-light-volume", '"value":"1"', '"value":"2"'],
    ["sr-electron-masses", "eq-model-sr-transverse-mass-printed", '"num":2', '"num":1'],
    [
      "sr-electron-kinetic-energy",
      "eq-model-sr-electron-work-result",
      '"value":"-1"',
      '"value":"-2"',
    ],
  ])("%s refuses a schema-valid corrupted %s", (cardId, equationId, original, replacement) => {
    const source = equations.find((equation) => equation.id === equationId);
    if (!source) throw new Error(`Missing equation ${equationId}`);
    const serialized = JSON.stringify(source);
    const changed = serialized.replace(original, replacement);
    expect(changed).not.toBe(serialized);
    const corrupted = parseEquationRecord(JSON.parse(changed), "corrupted SR equation");
    const inputs = equations.map((equation) => (equation.id === source.id ? corrupted : equation));
    expect(rule(() => project(card(cardId), inputs))).toBe(
      "result-support-derivation-record-mismatch",
    );
  });

  test("projection runs the actual chain checker instead of trusting a registered owner name", () => {
    const control = card("sr-light-complex-energy");
    const steps = srLightComplexDerivation.steps as DerivationStep[];
    const index = steps.findIndex((step) => step.id === "sr-light-complex-combine-factors");
    const original = steps[index];
    if (!original) throw new Error("Missing checked algebra control.");
    expect(project(control).support).toBeDefined();
    try {
      steps[index] = { ...original, to: { kind: "number", value: "2" } };
      expect(rule(() => project(control))).toBe("result-support-derivation-not-checked");
    } finally {
      steps[index] = original;
    }
    expect(project(control).support).toBeDefined();
  });

  test("a publication-ready but unchecked transformation still cannot support a checked result", () => {
    const control = card("sr-light-complex-energy");
    const steps = srLightComplexDerivation.steps as DerivationStep[];
    const index = steps.findIndex((step) => step.id === "sr-light-complex-combine-factors");
    const original = steps[index];
    if (!original) throw new Error("Missing checked algebra control.");
    try {
      steps[index] = {
        ...original,
        rule: { kind: "integrate", params: { variable: "q", boundaryCondition: "q > 0" } },
        verification: { status: "authored-unverified", reviewRecordId: "test-review" },
      };
      const report = verifyChain(srLightComplexDerivation, { isPublicationGate: true });
      expect(report.passed).toBe(true);
      expect(report.isPublicationReady).toBe(true);
      expect(report.stepReports[index]?.verificationStatus).toBe("authored-unverified");
      expect(rule(() => project(control))).toBe("result-support-derivation-not-checked");
    } finally {
      steps[index] = original;
    }
    expect(project(control).support).toBeDefined();
  });
});
