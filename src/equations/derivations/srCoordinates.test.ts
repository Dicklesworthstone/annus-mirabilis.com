import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import positionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import timeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import { auditReadings } from "../../content/audits/readings.ts";
import { loadLiveReadingsInput } from "../../content/audits/readingsLive.ts";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  type ConstraintId,
  checkCandidateMap,
  solveCandidateFamily,
} from "../../physics/reference/kinematics/constraints.ts";
import type { Event, KinematicResult } from "../../physics/reference/kinematics/types.ts";
import {
  alignedBoost,
  gamma,
  inverseBoost,
  transformEvent,
} from "../../physics/reference/kinematics.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { type Expression, walk } from "../ast.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  presentSRCoordinateExpression,
  SRCoordinateError,
  srCoordinateChains,
  srCoordinateCrossRouteLinks,
  srCoordinateHistoricalReading,
  srCoordinateIntroductions,
  srCoordinateMetadata,
  srCoordinateModernStages,
  srCoordinateResults,
  srCoordinateSourceLinks,
  srCoordinateSourceStages,
  srCoordinateSubstitution,
} from "./srCoordinates.ts";
import { containsSubtree, structurallyEqual } from "./treeUtils.ts";
import { DerivationSchemaError, type DerivationStep } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const steps = srCoordinateChains.flatMap((chain) => chain.steps);
const findStep = (id: string): DerivationStep => {
  const found = steps.find((step) => step.id === id);
  assert.ok(found, id);
  return found;
};
const relation = (tree: Expression) => {
  assert.equal(tree.kind, "relation");
  return tree as Extract<Expression, { kind: "relation" }>;
};
function value<T>(result: KinematicResult<T>): T {
  assert.equal(result.status, "value");
  assert.ok(result.status === "value");
  return result.value;
}
const c = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
const constraints: readonly ConstraintId[] = [
  "right-moving-light",
  "left-moving-light",
  "reciprocity",
  "isotropy",
  "identity-branch",
  "transverse-light",
];
function near(actual: number, expected: number, absolute = 1e-12, relative = 1e-12) {
  const verdict = withinTolerance(actual, expected, { absolute, relative });
  assert.equal(verdict.ok, true, `${actual} != ${expected}: ${JSON.stringify(verdict)}`);
}
interface Point {
  readonly speed: number;
  readonly event: Event;
  readonly phi?: number;
  readonly coefficient?: number;
  readonly transverse?: number;
}
/** Evaluate the authored trees, using the numerical owner for transformed event values.
 * Function-valued τ nodes are bound separately at their actual arguments, never aliased
 * merely because they share coordinateTimeMoving as a quantity. */
function evaluate(tree: Expression, point: Point): number {
  const boost = value(alignedBoost(point.speed / c));
  const transformed = value(transformEvent(point.event, boost));
  const solved = solveCandidateFamily({ v: point.speed, enabledConstraints: constraints });
  assert.equal(solved.status, "value");
  assert.ok(solved.status === "value");
  const phi = point.phi ?? 1;
  const coefficient = point.coefficient ?? solved.value.a;
  const bindings: Record<string, number> = {};
  for (const node of walk(tree)) {
    if (node.kind !== "symbol") continue;
    let bound: number | undefined;
    switch (node.quantityId) {
      case "speedOfLight":
        bound = c;
        break;
      case "frameSpeed":
        bound = point.speed;
        break;
      case "lorentzFactor":
        bound = boost.gamma;
        break;
      case "coordinatePositionStationary":
        bound = point.event[node.index === "y" ? "y" : node.index === "z" ? "z" : "x"];
        break;
      case "coordinatePositionMoving":
        bound = phi * transformed[node.index === "y" ? "y" : node.index === "z" ? "z" : "x"];
        break;
      case "coordinateTimeStationary":
        bound = point.event.t;
        break;
      case "coordinateTimeMoving": {
        if (node.args) {
          const [auxiliary, y, z, time] = node.args.map((argument) => evaluate(argument, point));
          assert.ok(
            auxiliary !== undefined && y !== undefined && z !== undefined && time !== undefined,
          );
          bound =
            phi *
            value(transformEvent({ x: auxiliary + point.speed * time, y, z, t: time }, boost)).t;
        } else bound = phi * transformed.t;
        break;
      }
      case "auxiliaryGalileanCoordinate":
        bound = point.event.x - point.speed * point.event.t;
        break;
      case "transformationCoefficientA":
        bound = phi / boost.gamma;
        break;
      case "scaleFactorUnknown":
        bound = phi;
        break;
      case "ansatzSpatialScale":
        bound = coefficient;
        break;
      case "ansatzTimeScale":
        bound = coefficient;
        break;
      case "ansatzTimeSpaceCoefficient":
        bound = (solved.value.d * coefficient) / solved.value.a;
        break;
      case "ansatzTransverseScale":
        bound = point.transverse ?? solved.value.transverseScale;
        break;
      case "lengthProper":
        bound = 1;
        break;
    }
    assert.notEqual(bound, undefined, node.quantityId);
    bindings[node.termId] = bound as number;
  }
  return evaluateExpression(tree, bindings);
}

test("both SR §3 routes have valid staged chains, declared completion, and honest draft premises", () => {
  assert.deepEqual(
    srCoordinateSourceStages.map(({ chain }) => chain.routeKind),
    srCoordinateSourceStages.map(() => "source-order"),
  );
  assert.deepEqual(
    srCoordinateModernStages.map(({ chain }) => chain.routeKind),
    srCoordinateModernStages.map(() => "pedagogical-reconstruction"),
  );
  assert.equal(new Set(steps.map((step) => step.id)).size, steps.length);
  for (const chain of srCoordinateChains) {
    const report = verifyChain(chain);
    assert.equal(report.passed, true, JSON.stringify(report));
    assert.equal(chain.targetStepId, chain.steps.at(-1)?.id);
    assert.ok(chain.steps.every((step) => step.verification.status === "authored-unverified"));
    assert.ok(chain.steps.every((step) => step.tool && step.sourceAnchor && step.reasons.r2));
    assert.ok(chain.steps.filter((step) => step.isMove).length <= 1);
    for (const premise of [
      ...chain.entryAssumptions,
      ...chain.steps.flatMap((step) => step.premiseRefs),
    ]) {
      assert.notEqual(premise.edgeType, "oracle");
      assert.ok(!/minkowski|spacetime-interval|interval-invariance/i.test(premise.ref));
    }
  }
  const historicalMoves = srCoordinateSourceStages.flatMap(({ chain }) =>
    chain.steps.filter((step) => step.isMove).map((step) => step.id),
  );
  assert.deepEqual(historicalMoves, [
    "sr-coordinate-source-functional-equation",
    "sr-coordinate-source-rod-isotropy",
  ]);
  const unreviewedCalculus = verifyChain(srCoordinateSourceStages[0]!.chain, {
    isPublicationGate: true,
  });
  assert.equal(unreviewedCalculus.passed, false);
  assert.ok(unreviewedCalculus.stepReports.some((step) => step.error?.includes("reviewRecordId")));
});

test("every stage rejects a removed completion and a completion moved before its prerequisites", () => {
  for (const chain of srCoordinateChains) {
    assert.equal(
      verifyChain({ ...chain, steps: chain.steps.slice(0, -1) }).passed,
      false,
      chain.id,
    );
    const last = chain.steps.at(-1)!;
    const moved = [last, ...chain.steps.slice(0, -1)];
    assert.equal(verifyChain({ ...chain, steps: moved }).passed, false, chain.id);
  }
});

test("actual producer/consumer reorder plants fail, independently of the final-step guard", () => {
  const exercised = new Set<string>();
  for (const chain of srCoordinateChains) {
    for (let i = 0; i < chain.steps.length - 2; i++) {
      const producer = chain.steps[i]!;
      const consumer = chain.steps[i + 1]!;
      if (
        producer.to.kind === "symbol" ||
        producer.to.kind === "number" ||
        !containsSubtree(consumer.from, producer.to)
      )
        continue;
      const reordered = [...chain.steps];
      [reordered[i], reordered[i + 1]] = [consumer, producer];
      const report = verifyChain({ ...chain, steps: reordered });
      assert.equal(report.passed, false, chain.id);
      assert.ok(
        report.errors.some((error) => error.includes("out of order")),
        JSON.stringify(report),
      );
      assert.equal(reordered.at(-1)?.id, chain.targetStepId);
      exercised.add(chain.id);
      break;
    }
  }
  for (const id of [
    "source-synchronization",
    "source-clocks",
    "source-rays",
    "source-common-scale",
    "source-spherical-wave",
    "source-inverse",
    "source-isotropy",
    "modern-light",
    "modern-normalization",
    "modern-transverse",
  ]) {
    assert.ok(exercised.has(`chain-sr-coordinate-${id}`), id);
  }
});

test("the modern derivation does not import gamma before the positive scale is derived", () => {
  const beforeNaming = srCoordinateModernStages
    .slice(0, 2)
    .flatMap(({ chain }) => chain.steps)
    .filter((step) => step.id !== "sr-coordinate-modern-name-gamma");
  for (const step of beforeNaming) {
    assert.ok(
      ![...walk(step.from), ...walk(step.to)].some(
        (node) => node.kind === "symbol" && node.quantityId === "lorentzFactor",
      ),
      step.id,
    );
  }
  const sourceA = walk(findStep("sr-coordinate-source-linear-time").to)
    .filter((node) => node.kind === "symbol")
    .map((node) => node.quantityId);
  const modernA = walk(srCoordinateIntroductions.positionAnsatz)
    .filter((node) => node.kind === "symbol")
    .map((node) => node.quantityId);
  assert.ok(sourceA.includes("transformationCoefficientA"));
  assert.ok(!sourceA.includes("ansatzSpatialScale"));
  assert.ok(modernA.includes("ansatzSpatialScale"));
  assert.ok(!modernA.includes("transformationCoefficientA"));
});

test("the existing constraint owner distinguishes light-only freedom, wrong transverse scale, and the negative branch", () => {
  const speed = 0.6 * c;
  const lightOnly = solveCandidateFamily({
    v: speed,
    enabledConstraints: ["right-moving-light", "left-moving-light"],
  });
  assert.equal(lightOnly.status, "underdetermined");
  const solved = solveCandidateFamily({ v: speed, enabledConstraints: constraints });
  assert.ok(solved.status === "value");
  const wrongSide = checkCandidateMap({ ...solved.value, transverseScale: 2 }, speed);
  assert.equal(wrongSide.residuals["transverse-light"], 3);
  near(wrongSide.residuals["right-moving-light"]!, 0, 1e-6);
  near(wrongSide.residuals["left-moving-light"]!, 0, 1e-6);
  const negative = checkCandidateMap(
    { ...solved.value, a: -solved.value.a, b: -solved.value.b, d: -solved.value.d },
    speed,
  );
  assert.ok(negative.residuals["identity-branch"]! < 0);
  assert.equal(negative.identifiesLongitudinalScale, false);
  near(negative.residuals.reciprocity!, 0);
});

test("authored coordinate trees match the kinematics owner over 53 signed, near-zero and high-speed cases", () => {
  const speeds = [
    -1e-10,
    0,
    1e-10,
    ...Array.from({ length: 50 }, (_, i) => -0.95 + (1.9 * i) / 49),
  ];
  const sourceTime = relation(findStep("sr-coordinate-source-linear-time").to);
  const sourcePosition = relation(findStep("sr-coordinate-source-longitudinal-coefficient").to);
  const sourceCommon = relation(findStep("sr-coordinate-source-name-common-scale").to);
  for (const [index, beta] of speeds.entries()) {
    const speed = beta * c;
    const event = {
      t: 1 + index / 31,
      x: c * (index / 17 - 1.3),
      y: c * (0.2 - index / 71),
      z: c * (index / 83 - 0.4),
    };
    const point = { speed, event };
    const boost = value(alignedBoost(beta));
    const transformed = value(transformEvent(event, boost));
    near(evaluate(srCoordinateResults.time.right, point), transformed.t);
    near(evaluate(srCoordinateResults.position.right, point), transformed.x, 1e-5);
    near(evaluate(sourceTime.right, point), transformed.t);
    near(evaluate(sourcePosition.right, point), transformed.x, 1e-5);
    // Keeping phi arbitrary tests the intermediate family, not merely its final phi=1 slice.
    const scaledPoint = { ...point, phi: 1.7 };
    near(evaluate(sourceTime.right, scaledPoint), 1.7 * transformed.t);
    near(evaluate(sourceCommon.right, scaledPoint), 1.7 * transformed.t);
    near(evaluate(sourcePosition.right, scaledPoint), 1.7 * transformed.x, 1e-5);
    const inverse = value(inverseBoost(boost));
    const returned = value(transformEvent(transformed, inverse));
    near(returned.t, event.t);
    near(returned.x, event.x, 1e-5);
    const inversePoint = { speed, event };
    near(evaluate(srCoordinateResults.inverseTime.right, inversePoint), event.t);
    near(evaluate(srCoordinateResults.inversePosition.right, inversePoint), event.x, 1e-5);
    assert.equal(boost.gamma, value(gamma(beta)));
  }
});

test("the synchronization functional equation and its differential condition hold with the source auxiliary coordinate", () => {
  const functional = relation(findStep("sr-coordinate-source-functional-equation").to);
  const timeAux = relation(findStep("sr-coordinate-source-linear-time").to).right;
  for (const beta of [-0.95, -0.6, 0, 0.6, 0.95]) {
    const speed = beta * c;
    const point = { speed, phi: 1.3, event: { t: 1.2, x: 2.1 * c, y: 0, z: 0 } };
    near(evaluate(functional.left, point), evaluate(functional.right, point));
    // Central differences of the authored affine function; fixed auxiliary q requires x=q+vt.
    const q0 = point.event.x - speed * point.event.t;
    const hTime = 0.01;
    const hPosition = c * 0.01;
    const at = (time: number, auxiliary: number) =>
      evaluate(timeAux, {
        ...point,
        event: { ...point.event, t: time, x: auxiliary + speed * time },
      });
    const timeSlope = (at(point.event.t + hTime, q0) - at(point.event.t - hTime, q0)) / (2 * hTime);
    const positionSlope =
      (at(point.event.t, q0 + hPosition) - at(point.event.t, q0 - hPosition)) / (2 * hPosition);
    near(positionSlope + (speed / (c * c - speed * speed)) * timeSlope, 0, 1e-18);
    // The same-q condition matters: holding x fixed would differentiate a different function.
    if (beta !== 0) {
      const wrongSlope =
        (evaluate(timeAux, { ...point, event: { ...point.event, t: point.event.t + hTime } }) -
          evaluate(timeAux, { ...point, event: { ...point.event, t: point.event.t - hTime } })) /
        (2 * hTime);
      assert.ok(Math.abs(positionSlope + (speed / (c * c - speed * speed)) * wrongSlope) > 1e-10);
    }
  }
});

test("longitudinal and moving-transverse rays satisfy their own source equations before normalization", () => {
  const longitudinal = relation(findStep("sr-coordinate-source-longitudinal-coefficient").to);
  const sideways = relation(findStep("sr-coordinate-source-transverse-position").to);
  const zEquation = relation(findStep("sr-coordinate-source-transverse-z").to);
  for (const beta of [-0.95, -0.6, 0, 0.6, 0.95]) {
    const speed = beta * c;
    const time = 2;
    const phi = 1.8;
    const along = { speed, phi, event: { t: time, x: c * time, y: 0, z: 0 } };
    near(evaluate(longitudinal.left, along), evaluate(longitudinal.right, along), 1e-5);
    const transverseDistance = (time * c) / value(gamma(beta)); // reuse the owner factor; no duplicate engine
    const across = { speed, phi, event: { t: time, x: speed * time, y: transverseDistance, z: 0 } };
    near(evaluate(sideways.left, across), evaluate(sideways.right, across), 1e-5);
    const third = { ...across, event: { ...across.event, y: 0, z: transverseDistance } };
    near(evaluate(zEquation.left, third), evaluate(zEquation.right, third), 1e-5);
    const transformed = value(transformEvent(across.event, value(alignedBoost(beta))));
    near(transformed.x, 0, 1e-5);
    near(transformed.y, c * transformed.t, 1e-5);
  }
});

test("the source spherical-wave check uses the constructed map and still permits an arbitrary common scale", () => {
  const cancellation = findStep("sr-coordinate-source-spherical-cancellation");
  for (const beta of [-0.95, -0.4, 0, 0.6, 0.95]) {
    const point = {
      speed: beta * c,
      phi: 1.6,
      event: { t: 2, x: 0.6 * c * 2, y: 0.8 * c * 2, z: 0 },
    };
    const transformed = value(transformEvent(point.event, value(alignedBoost(beta))));
    const squaredLength = transformed.x ** 2 + transformed.y ** 2 + transformed.z ** 2;
    near(squaredLength, c * c * transformed.t ** 2, 512);
    // Normalize the arithmetic residual by the physical scale to avoid imposing absolute
    // 1e-12 metre-squared accuracy on subtraction of ~1e18 metre-squared terms.
    near(
      evaluate(cancellation.from, point) / (c * c),
      evaluate(cancellation.to, point) / (c * c),
      1e-12,
    );
  }
});

test("transverse premises and branch conditions are necessary machine-checked obligations", () => {
  const transverse = srCoordinateModernStages.at(-1)!.chain;
  const missing = {
    ...transverse,
    steps: transverse.steps.map((step, i) => (i === 0 ? { ...step, premiseRefs: [] } : step)),
  };
  const report = verifyChain(missing);
  assert.equal(report.passed, false);
  assert.ok(report.errors.some((error) => error.includes("transverse-light-propagation")));
  for (const stage of [
    srCoordinateSourceStages[6]!,
    srCoordinateModernStages[1]!,
    srCoordinateModernStages[3]!,
  ]) {
    const stepIndex = stage.chain.steps.findIndex(
      (step) => step.rule.kind === "monotonic-function",
    );
    assert.ok(stepIndex >= 0);
    const plant = {
      ...stage.chain,
      steps: stage.chain.steps.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              rule: { ...step.rule, params: { ...step.rule.params, branchCondition: "" } },
            }
          : step,
      ),
    };
    assert.equal(verifyChain(plant).passed, false);
  }
});

test("canonical map owners and notation collisions survive the presentation projection", () => {
  for (const [actual, record] of [
    [srCoordinateResults.position, positionRecord],
    [srCoordinateResults.time, timeRecord],
  ] as const) {
    const expected = presentSRCoordinateExpression(record.tree as Expression, "modern");
    assert.ok(structurallyEqual(presentSRCoordinateExpression(actual, "modern"), expected));
  }
  const original = structuredClone(srCoordinateIntroductions.auxiliary);
  const source = expressionToDerivationLatex(presentSRCoordinateExpression(original, "source"));
  const modern = expressionToDerivationLatex(presentSRCoordinateExpression(original, "modern"));
  assert.match(source, /x'/);
  assert.match(modern, /x̃/);
  assert.ok(!modern.includes("x'"));
  assert.deepEqual(original, srCoordinateIntroductions.auxiliary);
  assert.ok(
    expressionToDerivationLatex(
      presentSRCoordinateExpression(srCoordinateResults.position, "modern"),
    ).includes("x'"),
  );
  for (const step of steps) {
    for (const tree of [step.from, step.to]) {
      const modernTree = presentSRCoordinateExpression(tree, "modern");
      assert.ok(
        !walk(modernTree).some(
          (node) =>
            node.kind === "symbol" && node.quantityId === "lorentzFactor" && node.termId !== "γ",
        ),
      );
      assert.ok(
        !walk(tree).some(
          (node) => node.kind === "symbol" && node.quantityId === "properTimeElapsed",
        ),
      );
    }
  }
});

test("cross-route links, physical source anchors and owner readings resolve without invented reviews", () => {
  const ids = new Set(steps.map((step) => step.id));
  const sources = new Set(srCoordinateSourceLinks.map((source) => source.id));
  for (const link of srCoordinateCrossRouteLinks) {
    assert.ok(ids.has(link.source), link.source);
    assert.ok(ids.has(link.modern), link.modern);
  }
  for (const step of steps)
    assert.ok(
      sources.has(step.sourceAnchor as (typeof srCoordinateSourceLinks)[number]["id"]),
      step.id,
    );
  for (const source of srCoordinateSourceLinks) {
    const record = yaml.load(
      readFileSync(`content/source-blocks/special-relativity/${source.anchor}.yaml`, "utf8"),
    ) as { id: string; section: string };
    assert.equal(record.id, source.anchor);
    assert.equal(record.section, "s3");
  }
  const live = loadLiveReadingsInput(process.cwd(), {
    ownerBeadIds: [srCoordinateMetadata.ownerBeadId],
  });
  assert.deepEqual(live.unparseable, []);
  assert.deepEqual(
    new Set(live.input.targets.map((target) => target.targetId)),
    new Set(
      srCoordinateChains.flatMap((chain) => chain.steps.map((step) => `${chain.id}/${step.id}`)),
    ),
  );
  assert.deepEqual(auditReadings(live.input).findings, []);
  for (const chain of srCoordinateChains) {
    for (const step of chain.steps) {
      const target = live.input.targets.find(
        (target) => target.targetId === `${chain.id}/${step.id}`,
      );
      assert.ok(target);
      assert.deepEqual(target.readings, { ...step.reasons, ...srCoordinateHistoricalReading });
    }
  }
});

test("presentation and substitution refusals retain stable typed schema errors", () => {
  assert.throws(
    () =>
      presentSRCoordinateExpression(
        { kind: "symbol", termId: "unknown", quantityId: "missingCoordinateQuantity" },
        "source",
      ),
    (error) => {
      assert.ok(error instanceof SRCoordinateError && error instanceof DerivationSchemaError);
      assert.equal(error.code, "sr-coordinate-missing-glyph");
      return true;
    },
  );
  assert.throws(
    () =>
      srCoordinateSubstitution(
        { kind: "number", value: "1" },
        { kind: "number", value: "2" },
        "unsupported",
      ),
    (error) => {
      assert.ok(error instanceof SRCoordinateError && error instanceof DerivationSchemaError);
      assert.equal(error.code, "sr-coordinate-unaddressable-substitution");
      return true;
    },
  );
});
