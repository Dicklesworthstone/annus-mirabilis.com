import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";
import type { ResultSupportDeclaration } from "./supportDeclarations.ts";

const ROOT = process.cwd();
const directory = join(ROOT, "content/equations/mass-energy");
const equations = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) =>
    parseEquationRecord(JSON.parse(readFileSync(join(directory, name), "utf8")), name),
  );
const records = loadResultCards(ROOT, "mass-energy");

function card(id: string): ResultCardRecord {
  const record = records?.cards.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing result card ${id}`);
  return record;
}

function project(record: ResultCardRecord, source: readonly EquationRecord[] = equations) {
  const passages = new Map(
    record.arguments.map((id) => {
      const passage = JSON.parse(
        readFileSync(join(ROOT, "content/arguments/mass-energy", `${id}.json`), "utf8"),
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

describe("result support reaches the actual proof owners through toCard", () => {
  test("the real results name verified conclusions and retain their physical assumptions", () => {
    expect(records?.problems).toEqual([]);
    const kinetic = project(card("me-kinetic-energy-drop")).support;
    const quadratic = project(card("me-low-speed-approximation")).support;
    const mass = project(card("me-mass-decrease")).support;
    for (const support of [kinetic, quadratic, mass]) {
      expect(support?.kind).toBe("checked-proof");
      if (support?.kind !== "checked-proof") throw new Error("No checked support.");
      expect(support.assumptions.length).toBeGreaterThan(0);
      expect(support.assumptions.map((premise) => premise.id)).toContain("offset");
      expect(support.scope.length).toBeGreaterThan(0);
    }
    if (quadratic?.kind !== "checked-proof" || mass?.kind !== "checked-proof")
      throw new Error("No low-speed support.");
    expect(quadratic.assumptions.map((premise) => premise.id)).not.toContain("inertia");
    expect(mass.assumptions.map((premise) => premise.id)).toContain("inertia");
    expect(mass.conclusion.equationId).toBe("eq-model-me-mass-decrease");
    expect(project(card("me-closing-remarks")).support).toBeUndefined();
  });

  test("result-support-conclusion-mismatch refuses a different argument or paper (checkedSupport.ts:321)", () => {
    const control = card("me-kinetic-energy-drop");
    expect(project(control).support).toBeDefined();
    const changed = withProof(control, { conclusion: "eq-model-me-quadratic-drop" });
    expect(rule(() => checkedSupportFor(changed, equations))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(rule(() => project(changed))).toBe("result-support-conclusion-mismatch");
    expect(rule(() => project({ ...control, paper: "brownian-motion" }))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(rule(() => project(control, []))).toBe("result-support-conclusion-mismatch");
  });

  test("result-support-conclusion-mismatch refuses a mass-energy owner for an SR result (checkedSupport.ts:335)", () => {
    const control = loadResultCards(ROOT, "special-relativity")?.cards.find(
      (record) => record.id === "sr-light-complex-energy",
    );
    if (!control) throw new Error("Missing special-relativity result control.");
    const srDirectory = join(ROOT, "content/equations/special-relativity");
    const source = readdirSync(srDirectory)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) =>
        parseEquationRecord(JSON.parse(readFileSync(join(srDirectory, name), "utf8")), name),
      );
    expect(checkedSupportFor(control, source)?.proofId).toBe("sr-light-complex-energy");
    const changed = withProof(control, { proofId: "me-ledger-elimination" });
    // Its conclusion still belongs to the card's paper and argument, so the earlier guard accepts
    // these inputs. Only the selected owner's paper restriction refuses this declaration.
    const conclusion = source.find((equation) => equation.id === "eq-model-sr-light-energy");
    expect(conclusion?.paper).toBe(control.paper);
    expect(control.arguments).toContain(conclusion?.argument);
    expect(rule(() => checkedSupportFor(changed, source))).toBe(
      "result-support-conclusion-mismatch",
    );
    expect(rule(() => toCard(ROOT, changed, new Map(), undefined, undefined, source))).toBe(
      "result-support-conclusion-mismatch",
    );
  });

  test("result-support-elimination-conclusion-missing refuses a premise cited as a conclusion", () => {
    const changed = withProof(card("me-kinetic-energy-drop"), {
      conclusion: "eq-model-me-offset-before",
    });
    expect(rule(() => project(changed))).toBe("result-support-elimination-conclusion-missing");
  });

  test("result-support-limit-conclusion-missing refuses the exact drop as a limit conclusion", () => {
    const changed = withProof(card("me-kinetic-energy-drop"), {
      proofId: "me-low-speed-coefficient",
    });
    expect(rule(() => project(changed))).toBe("result-support-limit-conclusion-missing");
  });

  test("result-support-owner-missing refuses an unregistered owner even at the projection boundary", () => {
    const changed = withProof(card("me-kinetic-energy-drop"), { proofId: "invented-owner" });
    expect(rule(() => project(changed))).toBe("result-support-owner-missing");
  });

  test("a schema-valid wrong kinetic drop fails the real exact-algebra check", () => {
    const source = equations.find((equation) => equation.id === "eq-model-me-exact-drop");
    if (!source) throw new Error("Missing exact-drop equation.");
    const serialized = JSON.stringify(source);
    const changed = serialized.replace('"value":"1"', '"value":"2"');
    expect(changed).not.toBe(serialized); // A moved anchor must never make the plant vacuous.
    const corrupted = parseEquationRecord(JSON.parse(changed), "wrong kinetic drop");
    const inputs = equations.map((equation) => (equation.id === source.id ? corrupted : equation));
    expect(() => project(card("me-kinetic-energy-drop"), inputs)).toThrow(
      "The combination does not establish eq-model-me-exact-drop.",
    );
  });

  test("a schema-valid wrong quadratic coefficient fails the real low-speed check", () => {
    const source = equations.find((equation) => equation.id === "eq-model-me-quadratic-drop");
    if (!source) throw new Error("Missing quadratic-drop equation.");
    const serialized = JSON.stringify(source);
    const changed = serialized.replace('"value":"0.5"', '"value":"0.25"');
    expect(changed).not.toBe(serialized);
    const corrupted = parseEquationRecord(JSON.parse(changed), "wrong quadratic coefficient");
    const inputs = equations.map((equation) => (equation.id === source.id ? corrupted : equation));
    expect(() => project(card("me-low-speed-approximation"), inputs)).toThrow(
      "The approximation record must retain exactly the quadratic term and its approximation sign.",
    );
  });
});
