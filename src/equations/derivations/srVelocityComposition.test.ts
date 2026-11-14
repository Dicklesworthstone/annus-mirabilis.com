import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import longitudinalRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-x.json";
import transverseRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-y.json";
import { auditReadings } from "../../content/audits/readings.ts";
import { SR06_DEFAULTS } from "../../experiments/sr06/definition.ts";
import { decodeSr06Settings } from "../../experiments/sr06/permalink.ts";
import { evaluateSr06 } from "../../experiments/sr06/session.ts";
import { type Expression, walk } from "../ast.ts";
import { parseEquationRecord } from "../record.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  createSRVelocityDerivations,
  createSRVelocitySetup,
  presentSRVelocityChain,
  presentSRVelocityExpression,
  SR_VELOCITY_RECORDS,
  SRVelocityError,
  srVelocityChains,
  srVelocityDerivations,
  srVelocityHistoricalReading,
  srVelocitySourceLinks,
} from "./srVelocityComposition.ts";
import { verifySRVelocityComposition } from "./srVelocityProof.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const clone = (chain: DerivationChain) => structuredClone(chain);
const longitudinal = srVelocityDerivations.longitudinal;
const transverse = srVelocityDerivations.transverse;

test("both source-direction components parse against the actual equation and dimension schema", () => {
  for (const record of [longitudinalRecord, transverseRecord]) {
    const parsed = parseEquationRecord(record, record.id);
    expect(parsed.argument).toBe("arg-sr-velocity-composition");
    expect(parsed.live).toBe(false);
    expect(parsed.tree.kind).toBe("relation");
    expect(parsed.assumptions.some((text) => text.includes("|v| < c"))).toBe(true);
    expect(parsed.assumptions.some((text) => text.includes("nonzero"))).toBe(true);
  }
});

test("every published transformation is executable and the two chains reach their canonical components", () => {
  for (const chain of srVelocityChains) {
    const report = verifySRVelocityComposition(chain);
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports.length).toBeGreaterThan(0);
    expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
    for (let index = 1; index < chain.steps.length; index++)
      expect(structurallyEqual(chain.steps[index - 1]!.to, chain.steps[index]!.from)).toBe(true);
  }
  expect(structurallyEqual(longitudinal.steps.at(-1)!.to, srVelocityDerivations.setup.longitudinal)).toBe(true);
  expect(structurallyEqual(transverse.steps.at(-1)!.to, srVelocityDerivations.setup.transverse)).toBe(true);
});

test("a locally valid but disconnected final replacement receives no proof credit", () => {
  for (const chain of srVelocityChains) {
    const last = chain.steps.at(-1)!;
    const disconnected = {
      ...chain,
      steps: [...chain.steps.slice(0, -1), { ...last, from: last.to }],
    };
    expect(verifyChain(disconnected, { isPublicationGate: true }).passed).toBe(true);
    expect(verifySRVelocityComposition(disconnected).passed).toBe(false);
  }
});

test("truncation, reordered steps, altered targets and missing physical premises refuse", () => {
  for (const chain of srVelocityChains) {
    expect(verifySRVelocityComposition({ ...chain, steps: chain.steps.slice(0, -1) }).passed).toBe(false);
    const reordered = clone(chain);
    const swapped = [...reordered.steps];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(verifySRVelocityComposition({ ...reordered, steps: swapped }).passed).toBe(false);
    expect(verifySRVelocityComposition({ ...chain, target: "eq-model-sr-velocity-x" }).passed).toBe(false);
    expect(verifySRVelocityComposition({ ...chain, entryAssumptions: [] }).passed).toBe(false);
    const first = chain.steps[0]!;
    expect(verifySRVelocityComposition({
      ...chain,
      steps: [{ ...first, premiseRefs: [] }, ...chain.steps.slice(1)],
    }).passed).toBe(false);
  }
});

test("checked algebra cannot be relabeled as the historical source route", () => {
  for (const chain of srVelocityChains) {
    expect(verifySRVelocityComposition({ ...chain, routeKind: "source-order" }).passed).toBe(false);
    expect(verifySRVelocityComposition({
      ...chain,
      proofRouteId: "sr-velocity-source-order",
    }).passed).toBe(false);
  }
});

test("division needs the actual stated condition and never accepts a zero divisor", () => {
  for (const chain of srVelocityChains) {
    for (const current of chain.steps.filter((step) => step.rule.params.operation === "divide")) {
      for (const patch of [
        { nonzeroCondition: "" },
        { nonzeroCondition: "zero is nonzero" },
        { quantity: { kind: "number", value: "0" } },
        { simplify: false },
      ]) {
        const bad = {
          ...chain,
          steps: chain.steps.map((step) => step.id === current.id
            ? { ...step, rule: { ...step.rule, params: { ...step.rule.params, ...patch } } }
            : step),
        };
        expect(verifySRVelocityComposition(bad).passed).toBe(false);
      }
    }
  }
});

test("a sign or coefficient change in a canonical coordinate input cannot keep checked support", () => {
  const changed = structuredClone(SR_VELOCITY_RECORDS);
  const position = changed.position.tree as Expression;
  expect(position.kind).toBe("relation");
  if (position.kind !== "relation") return;
  const negate = walk(position).find((node) => node.kind === "negate");
  expect(negate?.kind).toBe("negate");
  if (negate?.kind !== "negate") return;
  Object.assign(negate, { argument: { kind: "number", value: "0" } });
  const wrong = createSRVelocityDerivations(changed);
  expect(verifySRVelocityComposition(wrong.longitudinal).passed).toBe(false);

  const wrongTime = structuredClone(SR_VELOCITY_RECORDS);
  const root = wrongTime.inverseTime.tree as Expression;
  const denominator = walk(root).find((node) => node.kind === "power");
  expect(denominator?.kind).toBe("power");
  if (denominator?.kind !== "power") return;
  Object.assign(denominator, { exponent: { num: 3, den: 1 } });
  expect(verifySRVelocityComposition(createSRVelocityDerivations(wrongTime).transverse).passed).toBe(false);
});

test("the canonical result cannot silently change its sign or transverse coefficient", () => {
  for (const axis of ["longitudinal", "transverse"] as const) {
    const records = structuredClone(SR_VELOCITY_RECORDS);
    const result = records[axis].tree as Expression;
    expect(result.kind).toBe("relation");
    if (result.kind !== "relation") continue;
    const ratio = result.right;
    expect(ratio.kind).toBe("quotient");
    if (ratio.kind !== "quotient") continue;
    Object.assign(ratio, { numerator: { kind: "product", args: [{ kind: "number", value: "2" }, ratio.numerator] } });
    expect(verifySRVelocityComposition(createSRVelocityDerivations(records)[axis]).passed).toBe(false);
  }
});

test("missing definitions and fabricated equality citations refuse", () => {
  for (const chain of srVelocityChains) {
    const first = chain.steps[0]!;
    expect(verifySRVelocityComposition({
      ...chain,
      steps: [{
        ...first,
        rule: { ...first.rule, params: { ...first.rule.params, citedEquality: "An unrelated equality." } },
      }, ...chain.steps.slice(1)],
    }).passed).toBe(false);
  }
});

test("canonical setup and presentation refuse named authoring failures", () => {
  const refused = (operation: () => unknown, code: string) => {
    let caught: unknown;
    try {
      operation();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SRVelocityError);
    expect((caught as SRVelocityError).code).toBe(code);
  };
  refused(() => createSRVelocitySetup({
    ...SR_VELOCITY_RECORDS,
    position: { id: "bad", tree: { kind: "number", value: "1" } },
  }), "sr-velocity-relation-required");
  const missing = structuredClone(SR_VELOCITY_RECORDS);
  Object.assign(missing.position, { tree: {
    kind: "relation", operator: "=", left: { kind: "number", value: "0" },
    right: { kind: "number", value: "0" },
  } });
  // The stationary position still occurs in the time map; the forward position is not the only
  // source of its identity. Removing all three maps tests the real missing-quantity boundary.
  Object.assign(missing.time, { tree: missing.position.tree });
  Object.assign(missing.inverseTime, { tree: missing.position.tree });
  refused(() => createSRVelocitySetup(missing), "sr-velocity-missing-quantity");
  refused(() => createSRVelocitySetup({
    ...SR_VELOCITY_RECORDS,
    longitudinal: {
      id: "bad-result",
      tree: { kind: "relation", operator: "=", left: { kind: "number", value: "1" }, right: { kind: "number", value: "1" } },
    },
  }), "sr-velocity-result-shape");
  refused(() => presentSRVelocityExpression({
    kind: "symbol", termId: "unknown", quantityId: "unknownVelocity",
  }), "sr-velocity-missing-glyph");
});

test("the symbolic components agree with the real SR06 owner for collinear, oblique and light-like inputs", () => {
  for (const parameters of [
    { ...SR06_DEFAULTS, frameBeta: 0, movingSpeed: 0.4, mode: "angled" as const, alphaDeg: 30 },
    { ...SR06_DEFAULTS },
    { ...SR06_DEFAULTS, frameBeta: -0.6, movingSpeed: 0.6 },
    { ...SR06_DEFAULTS, movingSpeed: 0, mode: "angled" as const, alphaDeg: 90 },
    { ...SR06_DEFAULTS, mode: "angled" as const, alphaDeg: 90 },
    { ...SR06_DEFAULTS, movingSpeed: 1, mode: "angled" as const, alphaDeg: 90 },
  ]) {
    const outputs = evaluateSr06(parameters);
    const value = (id: string) => {
      const result = outputs.find((output) => output.quantityId === id);
      expect(result?.status).toBe("value");
      if (result?.status !== "value" || typeof result.value !== "number")
        return Number.NaN;
      return result.value;
    };
    const inputs = {
      speedOfLight: 1,
      frameSpeed: parameters.frameBeta,
      lorentzFactor: 1 / Math.sqrt(1 - parameters.frameBeta ** 2),
      velocityComponentXMoving: value("movingUxOverC"),
      velocityComponentYMoving: value("movingUyOverC"),
    };
    expect(evaluateExpression(srVelocityDerivations.setup.longitudinal.right, inputs)).toBeCloseTo(value("composedUxOverC"), 12);
    expect(evaluateExpression(srVelocityDerivations.setup.transverse.right, inputs)).toBeCloseTo(value("composedUyOverC"), 12);
    expect(value("inverseUxOverC")).toBeCloseTo(inputs.velocityComponentXMoving, 12);
    expect(value("inverseUyOverC")).toBeCloseTo(inputs.velocityComponentYMoving, 12);
  }
});

test("source-direction display preserves quantities and names real source returns", () => {
  for (const chain of srVelocityChains) {
    const display = presentSRVelocityChain(chain);
    expect(display.target).toBe(chain.target);
    for (let index = 0; index < chain.steps.length; index++) {
      const before = walk(chain.steps[index]!.to).filter((node) => node.kind === "symbol");
      const after = walk(display.steps[index]!.to).filter((node) => node.kind === "symbol");
      expect(after.map((node) => node.kind === "symbol" && node.quantityId)).toEqual(
        before.map((node) => node.kind === "symbol" && node.quantityId),
      );
    }
  }
  const anchors = srVelocitySourceLinks.map((source) => source.anchor);
  expect(anchors).toContain("eq-s5-d1");
  expect(anchors).toContain("eq-s5-d2");
  expect(anchors).toContain("eq-s5-d6");
  expect(anchors).toContain("eq-s3-d25");
  for (const chain of srVelocityChains)
    for (const step of chain.steps)
      expect(srVelocitySourceLinks.some((source) => source.id === step.sourceAnchor)).toBe(true);
});

test("every published reason has a matching owned R0–R3 reading", () => {
  const record = yaml.load(readFileSync(new URL(
    "../../../content/editorial/readings-owners/am-srk-equations-30cq.yaml", import.meta.url,
  ), "utf8")) as { ownerBeadId: string; targets: { id: string; kind: string; readings: unknown }[] };
  const targets = srVelocityChains.flatMap((chain) => chain.steps.map((step) => {
    const targetId = chain.id + "/" + step.id;
    const readings = { ...step.reasons, ...srVelocityHistoricalReading };
    expect(record.targets.find((target) => target.id === targetId)?.readings).toEqual(readings);
    return { targetId, targetKind: "derivation-step" as const, paper: "special-relativity", readings };
  }));
  const report = auditReadings({
    targets,
    owners: [{
      ownerBeadId: record.ownerBeadId,
      fileName: record.ownerBeadId + ".yaml",
      paper: "special-relativity",
      targetKinds: ["derivation-step"],
      targetIds: targets.map((target) => target.targetId),
    }],
  });
  expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
});

test("reader examples decode to the same k-to-K compositions", () => {
  for (const search of [
    "?v=0.6&w=0.6&alpha=0&mode=collinear",
    "?v=0.6&w=0.6&alpha=90&mode=angled",
    "?v=0.6&w=1&alpha=90&mode=angled",
  ]) {
    const result = decodeSr06Settings(search);
    expect(result.kind).toBe("settings");
    if (result.kind !== "settings") continue;
    expect(result.parameters.frameBeta).toBe(0.6);
    expect(evaluateSr06(result.parameters).find((output) => output.quantityId === "composedUxOverC")?.status).toBe("value");
  }
});
