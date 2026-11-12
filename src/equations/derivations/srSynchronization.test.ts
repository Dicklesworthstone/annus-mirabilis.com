import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import equalLegsRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-equal-legs.json";
import midpointRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-midpoint.json";
import { auditReadings } from "../../content/audits/readings.ts";
import { loadLiveReadingsInput } from "../../content/audits/readingsLive.ts";
import { requireClockExample } from "../../experiments/sr01/entranceScenario.ts";
import { checkClockSynchronization } from "../../physics/reference/events.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { type Expression, walk } from "../ast.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srSynchronizationChain as chain,
  createSRSynchronizationSetup,
  presentSRSynchronizationExpression,
  SRSynchronizationError,
  srSynchronizationBookkeeping,
  srSynchronizationCriterion,
  srSynchronizationMetadata,
  srSynchronizationMidpoint,
  srSynchronizationReadingSet,
  srSynchronizationSourceLinks,
} from "./srSynchronization.ts";
import { structurallyEqual } from "./treeUtils.ts";
import { DerivationSchemaError, type DerivationStep } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

function sides(tree: Expression, departure: number, reception: number, assigned: number) {
  if (tree.kind !== "relation") throw new Error("Expected a synchronization equality.");
  const bindings = { t_A: departure, t_return: reception, t_B: assigned };
  return [
    evaluateExpression(tree.left, bindings),
    evaluateExpression(tree.right, bindings),
  ] as const;
}
function agrees(tree: Expression, departure: number, reception: number, assigned: number) {
  const [left, right] = sides(tree, departure, reception, assigned);
  return withinTolerance(left, right, { absolute: 1e-11, relative: 1e-12 }).ok;
}
function replaceStep(index: number, patch: Partial<DerivationStep>) {
  return {
    ...chain,
    steps: chain.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, ...patch } : step,
    ),
  };
}

function refusalOf(operation: () => unknown): SRSynchronizationError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(SRSynchronizationError);
    expect(error).toBeInstanceOf(DerivationSchemaError);
    if (error instanceof SRSynchronizationError) return error;
    throw error;
  }
  throw new Error("Expected a coded synchronization authoring refusal.");
}

test("known clock quantities project; an unknown quantity refuses with its glyph code", () => {
  expect(presentSRSynchronizationExpression(equalLegsRecord.tree as Expression)).toEqual(
    srSynchronizationCriterion,
  );
  const error = refusalOf(() =>
    presentSRSynchronizationExpression({
      kind: "symbol",
      termId: "unknown",
      quantityId: "unknownClock",
    }),
  );
  expect(error.code).toBe("sr-synchronization-missing-glyph");
  expect(error.path).toBe("sr-synchronization.presentation");
  expect(error.message).toContain("unknownClock");
});

test("canonical equalities build the setup; a scalar or approximate relation is refused", () => {
  const accepted = createSRSynchronizationSetup(equalLegsRecord, midpointRecord);
  expect(accepted.criterion).toEqual(srSynchronizationCriterion);
  expect(accepted.midpoint).toEqual(srSynchronizationMidpoint);
  expect(accepted.bookkeeping).toEqual(srSynchronizationBookkeeping);
  const scalar = refusalOf(() =>
    createSRSynchronizationSetup(
      { ...equalLegsRecord, tree: { kind: "number", value: "0" } },
      midpointRecord,
    ),
  );
  expect(scalar.code).toBe("sr-synchronization-relation-required");
  expect(scalar.path).toBe(`${equalLegsRecord.id}.tree`);
  const approximate = refusalOf(() =>
    createSRSynchronizationSetup(equalLegsRecord, {
      ...midpointRecord,
      tree: { ...srSynchronizationMidpoint, operator: "approx" },
    }),
  );
  expect(approximate.code).toBe("sr-synchronization-relation-required");
  expect(approximate.path).toBe(`${midpointRecord.id}.tree`);
});

test("both clock differences are required before their readings can be extracted", () => {
  const accepted = createSRSynchronizationSetup(equalLegsRecord, midpointRecord);
  expect(accepted.departure).toEqual({
    kind: "symbol",
    quantityId: "signalDepartureTimeA",
    termId: "t_A",
  });
  const outward = srSynchronizationCriterion.left;
  if (outward.kind !== "sum") throw new Error("The accepted criterion must contain a sum.");
  const invalid: Expression[] = [
    { ...srSynchronizationCriterion, left: { kind: "number", value: "0" } },
    {
      ...srSynchronizationCriterion,
      left: { ...outward, args: [outward.args[0]!, accepted.departure] },
    },
    { ...srSynchronizationCriterion, right: { kind: "number", value: "0" } },
    { ...srSynchronizationCriterion, right: { kind: "sum", args: [] } },
  ];
  for (const tree of invalid) {
    const error = refusalOf(() =>
      createSRSynchronizationSetup({ ...equalLegsRecord, tree }, midpointRecord),
    );
    expect(error.code).toBe("sr-synchronization-criterion-shape");
    expect(error.path).toBe(`${equalLegsRecord.id}.tree`);
  }
});

test("both leg operations and the final average must retain their addressable identities", () => {
  const accepted = createSRSynchronizationSetup(equalLegsRecord, midpointRecord);
  expect(accepted.returnLegId).toBeTruthy();
  expect(accepted.outwardLegId).toBeTruthy();
  expect(accepted.midpointAverageId).toBeTruthy();
  const withoutOperation = (tree: Expression): Expression =>
    Object.fromEntries(Object.entries(tree).filter(([key]) => key !== "opId")) as Expression;
  const invalid = [
    [
      {
        ...equalLegsRecord,
        tree: {
          ...srSynchronizationCriterion,
          left: withoutOperation(srSynchronizationCriterion.left),
        },
      },
      midpointRecord,
    ],
    [
      {
        ...equalLegsRecord,
        tree: {
          ...srSynchronizationCriterion,
          right: withoutOperation(srSynchronizationCriterion.right),
        },
      },
      midpointRecord,
    ],
    [
      equalLegsRecord,
      {
        ...midpointRecord,
        tree: {
          ...srSynchronizationMidpoint,
          right: withoutOperation(srSynchronizationMidpoint.right),
        },
      },
    ],
  ] as const;
  for (const [criterion, midpoint] of invalid) {
    const error = refusalOf(() => createSRSynchronizationSetup(criterion, midpoint));
    expect(error.code).toBe("sr-synchronization-unaddressable-operation");
    expect(error.path).toBe("sr-synchronization.canonical-operations");
  }
});

test("the marked §1 definition has three exact conditional consequences and a canonical endpoint", () => {
  const report = verifyChain(chain);
  expect(report.passed).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.stepReports).toHaveLength(4);
  expect(report.stepReports.every((step) => step.ruleOutcome === "pass")).toBe(true);
  expect(chain.routeKind).toBe("pedagogical-reconstruction");
  expect(chain.steps.map((step) => step.reasonKind)).toEqual([
    "definition",
    "algebra",
    "algebra",
    "algebra",
  ]);
  expect(chain.steps.filter((step) => step.isMove).map((step) => step.id)).toEqual([
    "sr-synchronization-define-equal-legs",
  ]);
  expect(chain.target).toBe(midpointRecord.id);
  expect(chain.targetStepId).toBe(chain.steps.at(-1)?.id);
  expect(
    structurallyEqual(
      chain.steps.at(-1)!.to,
      presentSRSynchronizationExpression(midpointRecord.tree as Expression),
    ),
  ).toBe(true);
  expect(chain.steps.every((step) => step.verification.status === "authored-unverified")).toBe(
    true,
  );
  expect(srSynchronizationMetadata.review).toBe("draft");
  expect(chain.entryAssumptions.some((premise) => premise.ref === chain.target)).toBe(false);
  const quantities = new Set(
    chain.steps
      .flatMap((step) => [step.from, step.to])
      .flatMap((tree) =>
        walk(tree)
          .filter((node) => node.kind === "symbol")
          .map((node) => node.quantityId),
      ),
  );
  expect([...quantities].sort()).toEqual([
    "signalDepartureTimeA",
    "signalReflectionTimeB",
    "signalReturnTimeA",
  ]);
});

test("the first step adopts a convention: its result is false for an arbitrary B offset", () => {
  const example = requireClockExample({ departure: 20, reception: 30 });
  for (const offset of [-4, -0.3, 0.3, 4]) {
    const proposed = example.assigned + offset;
    // The split identity is true for any B reading and therefore cannot determine B by itself.
    expect(agrees(srSynchronizationBookkeeping, 20, 30, proposed)).toBe(true);
    expect(agrees(chain.steps[0]!.to, 20, 30, proposed)).toBe(false);
    expect(agrees(srSynchronizationCriterion, 20, 30, proposed)).toBe(false);
    const result = checkClockSynchronization(20, proposed, 30);
    expect(result.status).toBe("value");
    if (result.status === "value") expect(result.value.synchronized).toBe(false);
  }
  expect(agrees(chain.steps[0]!.to, 20, 30, example.assigned)).toBe(true);
  expect(chain.steps[0]!.reasons.r0).toContain("does not make that choice");
  expect(chain.steps[0]!.reasons.r2).toContain("not an algebraic identity");
});

test("all authored steps agree with the real clock owner, including shifted and negative readings", () => {
  for (const readings of [
    { departure: 0, reception: 10 },
    { departure: 20, reception: 30 },
    { departure: -9, reception: 3 },
    { departure: 0.125, reception: 0.875 },
    { departure: 10_000, reception: 10_020 },
  ]) {
    const example = requireClockExample(readings);
    for (const step of chain.steps) {
      expect(
        agrees(step.from, readings.departure, readings.reception, example.assigned),
        step.id,
      ).toBe(true);
      expect(
        agrees(step.to, readings.departure, readings.reception, example.assigned),
        step.id,
      ).toBe(true);
    }
    const check = checkClockSynchronization(
      readings.departure,
      example.assigned,
      readings.reception,
    );
    expect(check.status).toBe("value");
    if (check.status === "value") expect(check.value.synchronized).toBe(true);
  }
});

test("a wrong coefficient, missing divisor condition or half-the-return shortcut is refused", () => {
  const collected = chain.steps[1]!.to;
  if (collected.kind !== "relation" || collected.right.kind !== "product")
    throw new Error("Expected two assigned legs.");
  const wrongCount: Expression = {
    ...collected,
    right: { ...collected.right, args: [{ kind: "number", value: "3" }, collected.right.args[1]!] },
  };
  expect(verifyChain(replaceStep(1, { to: wrongCount })).passed).toBe(false);

  const division = chain.steps[2]!.rule;
  expect(
    verifyChain(
      replaceStep(2, {
        rule: { ...division, params: { ...division.params, nonzeroCondition: "" } },
      }),
    ).passed,
  ).toBe(false);

  if (srSynchronizationMidpoint.right.kind !== "quotient")
    throw new Error("Expected canonical midpoint.");
  const wrongDenominator: Expression = {
    ...srSynchronizationMidpoint,
    right: { ...srSynchronizationMidpoint.right, denominator: { kind: "number", value: "3" } },
  };
  expect(verifyChain(replaceStep(3, { to: wrongDenominator })).passed).toBe(false);
  const shortcut: Expression = {
    ...srSynchronizationMidpoint,
    right: {
      kind: "quotient",
      numerator: { kind: "symbol", termId: "t_return", quantityId: "signalReturnTimeA" },
      denominator: { kind: "number", value: "2" },
    },
  };
  expect(verifyChain(replaceStep(3, { to: shortcut })).passed).toBe(false);
  expect(agrees(shortcut, 20, 30, 25)).toBe(false);
});

test("an uncited or mismatched convention replacement and a truncated result are refused", () => {
  const rule = chain.steps[0]!.rule;
  expect(
    verifyChain(
      replaceStep(0, {
        rule: { ...rule, params: { ...rule.params, citedEquality: "" } },
      }),
    ).passed,
  ).toBe(false);
  expect(
    verifyChain(
      replaceStep(0, {
        rule: { ...rule, params: { ...rule.params, replacement: { kind: "number", value: "0" } } },
      }),
    ).passed,
  ).toBe(false);
  expect(verifyChain({ ...chain, steps: chain.steps.slice(0, -1) }).passed).toBe(false);
  expect(verifyChain({ ...chain, steps: [...chain.steps].reverse() }).passed).toBe(false);
});

test("every new step has the exact registered readings, a real §1 source return and a foundation", () => {
  const live = loadLiveReadingsInput(process.cwd(), {
    ownerBeadIds: [srSynchronizationMetadata.ownerBeadId],
  });
  expect(live.unparseable).toEqual([]);
  expect(auditReadings(live.input).findings).toEqual([]);
  const registered = live.input.targets.filter((target) =>
    target.targetId.startsWith(`${chain.id}/`),
  );
  expect(registered).toHaveLength(chain.steps.length);
  const sources = new Set(srSynchronizationSourceLinks.map((source) => source.id));
  const registry = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const step of chain.steps) {
    expect(
      registered.find((target) => target.targetId === `${chain.id}/${step.id}`)?.readings,
    ).toEqual(srSynchronizationReadingSet(step));
    expect(
      sources.has(step.sourceAnchor as (typeof srSynchronizationSourceLinks)[number]["id"]),
    ).toBe(true);
    expect(registry).toContain(step.tool!);
  }
  for (const source of srSynchronizationSourceLinks) {
    const record = yaml.load(
      readFileSync(`content/source-blocks/special-relativity/${source.anchor}.yaml`, "utf8"),
    ) as { id: string; section: string };
    expect(record.id).toBe(source.anchor);
    expect(record.section).toBe("s1");
  }
});
