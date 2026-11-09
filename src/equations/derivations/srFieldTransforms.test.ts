import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auditReadings } from "../../content/audits/readings.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  C_SI,
  EPS0,
  mapGaussianHistoricalToSI,
  mapSIToGaussianHistorical,
  maxwellResidualsPlaneWave,
  transformGaussianHistorical,
  transformSI,
  type Vec3,
} from "../../physics/reference/fields.ts";
import { type Expression, walk } from "../ast.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import {
  createSRFieldSubstitution,
  projectSRFieldSIExpression,
  SRFieldTransformError,
  srFieldAnsatzEquations,
  srFieldCandidateComponents,
  srFieldComponentRows,
  srFieldCoordinateMap,
  srFieldGaussianEquations,
  srFieldNormalizationDerivation,
  srFieldOperatorEquations,
  srFieldSIEquations,
  srFieldSourceDisplayExpression,
  srFieldTransformDerivations,
  srFieldTransformMetadata,
  srFieldTransformReadingSet,
  srFieldVacuumConstraints,
} from "./srFieldTransforms.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

type Jet = readonly [number, number, number, number, number]; // value, dt, dx, dy, dz
type Fields = Readonly<{ E: Vec3; B: Vec3 }>;
interface EventFixture {
  readonly c: number;
  readonly v: number;
  readonly fields: Readonly<Record<string, Jet>>;
  readonly movingFields?: Readonly<Record<string, Jet>>;
  readonly psi?: (speed: number) => number;
  readonly probe?: Jet;
}
const axes = ["x", "y", "z"] as const;
const componentKeys = ["Ex", "Ey", "Ez", "Bx", "By", "Bz"] as const;
function present<T>(value: T | undefined): T {
  assert.ok(value !== undefined, "The named test fixture must exist.");
  return value;
}
const constant = (value: number): Jet => [value, 0, 0, 0, 0];
const jet = (value: number, gradient: (index: 1 | 2 | 3 | 4) => number): Jet => [
  value,
  gradient(1),
  gradient(2),
  gradient(3),
  gradient(4),
];
const add = (left: Jet, right: Jet): Jet =>
  jet(left[0] + right[0], (index) => left[index] + right[index]);
const scale = (input: Jet, factor: number): Jet =>
  jet(input[0] * factor, (index) => input[index] * factor);
const multiply = (left: Jet, right: Jet): Jet =>
  jet(left[0] * right[0], (index) => left[index] * right[0] + left[0] * right[index]);
const g = (fixture: EventFixture) => 1 / Math.sqrt(1 - (fixture.v / fixture.c) ** 2);
function near(actual: number, expected: number, scaleValue = 1) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  assert.ok(
    Math.abs(actual - expected) <=
      3e-11 * Math.max(1e-14, Math.abs(expected), Math.abs(scaleValue)),
    `${actual} != ${expected}`,
  );
}

/** Analytic first derivatives in K; moving derivatives use the inverse coordinate map. */
function derivative(jet: Jet, variable: Expression, fixture: EventFixture): number {
  assert.equal(variable.kind, "symbol");
  const coordinate = variable as Extract<Expression, { kind: "symbol" }>;
  if (coordinate.quantityId === "coordinateTimeStationary") return jet[1];
  if (coordinate.quantityId === "coordinateTimeMoving")
    return g(fixture) * (jet[1] + fixture.v * jet[2]);
  const axis = coordinate.index;
  if (axis === "y") return jet[3];
  if (axis === "z") return jet[4];
  assert.equal(axis, "x");
  return coordinate.quantityId === "coordinatePositionMoving"
    ? g(fixture) * (jet[2] + (fixture.v * jet[1]) / fixture.c ** 2)
    : jet[2];
}

function evaluate(tree: Expression, fixture: EventFixture): Jet {
  switch (tree.kind) {
    case "number":
      return constant(Number(tree.value));
    case "constant":
      assert.equal(tree.name, "pi");
      return constant(Math.PI);
    case "symbol": {
      if (tree.quantityId === "speedOfLight") return constant(fixture.c);
      if (tree.quantityId === "frameSpeed") return constant(fixture.v);
      if (tree.quantityId === "lorentzFactor") return constant(g(fixture));
      if (tree.quantityId === "fieldScaleFactorUnknown")
        return constant(
          (fixture.psi ?? (() => 1))(tree.at ? evaluate(tree.at, fixture)[0] : fixture.v),
        );
      if (tree.quantityId === "coordinateTimeStationary") return [0, 1, 0, 0, 0];
      if (tree.quantityId === "coordinateTimeMoving")
        return [0, g(fixture), (-g(fixture) * fixture.v) / fixture.c ** 2, 0, 0];
      if (tree.quantityId.startsWith("coordinatePosition")) {
        if (tree.index === "y") return [0, 0, 0, 1, 0];
        if (tree.index === "z") return [0, 0, 0, 0, 1];
        return tree.quantityId === "coordinatePositionMoving"
          ? [0, -g(fixture) * fixture.v, g(fixture), 0, 0]
          : [0, 0, 1, 0, 0];
      }
      const key = `${tree.quantityId.startsWith("electric") ? "E" : "B"}${tree.index}`;
      const fields = tree.quantityId.endsWith("Moving") ? fixture.movingFields : fixture.fields;
      assert.ok(fields?.[key], `${tree.quantityId}/${tree.index}`);
      return present(fields[key]);
    }
    case "sum":
      return tree.args.map((node) => evaluate(node, fixture)).reduce(add, constant(0));
    case "product":
      return tree.args.map((node) => evaluate(node, fixture)).reduce(multiply, constant(1));
    case "negate":
      return scale(evaluate(tree.argument, fixture), -1);
    case "group":
      return evaluate(tree.argument, fixture);
    case "quotient": {
      const numerator = evaluate(tree.numerator, fixture);
      const denominator = evaluate(tree.denominator, fixture);
      const reciprocal = jet(
        1 / denominator[0],
        (index) => -denominator[index] / denominator[0] ** 2,
      );
      return multiply(numerator, reciprocal);
    }
    case "power": {
      const base = evaluate(tree.base, fixture);
      const exponent = tree.exponent.num / tree.exponent.den;
      return jet(
        base[0] ** exponent,
        (index) => exponent * base[0] ** (exponent - 1) * base[index],
      );
    }
    case "root": {
      const base = evaluate(tree.radicand, fixture);
      return jet(base[0] ** (1 / tree.degree), (index) =>
        base[index] === 0 ? 0 : (base[index] / tree.degree) * base[0] ** (1 / tree.degree - 1),
      );
    }
    case "derivative":
      return constant(derivative(evaluate(tree.expression, fixture), tree.variable, fixture));
    case "partialOperator":
      return constant(derivative(fixture.probe ?? [0, 3, -5, 7, 11], tree.variable, fixture));
    default:
      assert.fail(`Unsupported test expression ${tree.kind}`);
  }
}
function sides(tree: Expression, fixture: EventFixture) {
  assert.equal(tree.kind, "relation");
  const equation = tree as Extract<Expression, { kind: "relation" }>;
  return [evaluate(equation.left, fixture)[0], evaluate(equation.right, fixture)[0]] as const;
}
function checkEquation(tree: Expression, fixture: EventFixture, scaleValue = 1) {
  const [left, right] = sides(tree, fixture);
  near(left, right, Math.max(scaleValue, Math.abs(left), Math.abs(right)));
}
function jetsFor(fields: Fields): Record<string, Jet> {
  return Object.fromEntries(
    axes.flatMap((axis) => [
      [`E${axis}`, constant(fields.E[axis])],
      [`B${axis}`, constant(fields.B[axis])],
    ]),
  );
}
function replaceMath(tree: Expression, target: Expression, replacement: Expression): Expression {
  const visit = (value: unknown): unknown => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "kind" in value &&
      structurallyEqual(value as Expression, target)
    )
      return replacement;
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
    return value;
  };
  return visit(tree) as Expression;
}

test("the SR owner contains the exact source-field step readings rendered by the reader", () => {
  const owner = parseYaml(
    readFileSync(
      new URL(
        "../../../content/editorial/readings-owners/am-sre-equations-2g3h.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    ownerBeadId: string;
    targets: { kind: string; id: string; readings: unknown }[];
  };
  assert.equal(owner.ownerBeadId, "am-sre-equations-2g3h");
  const steps = srFieldTransformDerivations.flatMap((chain) => chain.steps);
  const targets = owner.targets.filter((target) => target.id.startsWith("sr-field-"));
  assert.deepEqual(targets.map((target) => target.id).sort(), steps.map((step) => step.id).sort());
  for (const step of steps) {
    const target = present(targets.find((candidate) => candidate.id === step.id));
    assert.equal(target.kind, "derivation-step");
    assert.deepEqual(target.readings, srFieldTransformReadingSet(step));
  }
});

test("every field reading has literal authored copy and R2 supplies the required additional explanation", () => {
  const steps = srFieldTransformDerivations.flatMap((chain) => chain.steps);
  const source = readFileSync(new URL("./srFieldTransforms.ts", import.meta.url), "utf8");
  for (const step of steps) {
    const readings = srFieldTransformReadingSet(step);
    for (const level of ["r0", "r1", "r2", "r3"] as const) {
      assert.ok(
        source.includes(readings[level]),
        `${step.id}:${level} lacks its literal rendered copy`,
      );
    }
  }
  const report = auditReadings({
    targets: steps.map((step) => ({
      targetId: step.id,
      targetKind: "derivation-step",
      paper: "special-relativity",
      readings: srFieldTransformReadingSet(step),
    })),
    owners: [
      {
        ownerBeadId: "am-sre-equations-2g3h",
        fileName: "am-sre-equations-2g3h.yaml",
        paper: "special-relativity",
        targetKinds: ["derivation-step"],
        targetIds: steps.map((step) => step.id),
      },
    ],
  });
  assert.deepEqual(report.findings, []);
  assert.equal(report.ok, true);
});

test("the field authoring substitution refuses an unaddressable target with its stable code", () => {
  const step = present(present(srFieldTransformDerivations[0]).steps[0]);
  const target = present(
    walk(step.from).find((node) => "opId" in node && node.opId === step.rule.params.targetId),
  );
  const replacement = step.rule.params.replacement as Expression;
  const valid = createSRFieldSubstitution(
    step.from,
    target,
    replacement,
    String(step.rule.params.citedEquality),
  );
  assert.deepEqual(valid.to, step.to);
  assert.deepEqual(valid.changedSubexpressionIds, step.changedSubexpressionIds);
  assert.throws(
    () =>
      createSRFieldSubstitution(
        step.from,
        { kind: "number", value: "1" },
        replacement,
        "The target must be named.",
        "field-test-target",
      ),
    (error: unknown) =>
      error instanceof SRFieldTransformError &&
      error.refusalCode === "sr-field-unaddressable-substitution" &&
      error.path === "field-test-target",
  );
});

test("SI notation projection preserves component semantics and refuses an unknown quantity glyph", () => {
  const tree: Expression = {
    kind: "symbol",
    termId: "fixture.electric",
    quantityId: "electricFieldStationary",
    index: "y",
  };
  assert.deepEqual(projectSRFieldSIExpression({ id: "field-test-known", tree }), {
    ...tree,
    termId: "E",
  });
  assert.equal(tree.termId, "fixture.electric");
  assert.throws(
    () =>
      projectSRFieldSIExpression({
        id: "field-test-unknown",
        tree: { ...tree, quantityId: "unregisteredFieldQuantity" },
      }),
    (error: unknown) =>
      error instanceof SRFieldTransformError &&
      error.refusalCode === "sr-field-unknown-si-symbol" &&
      error.path === "field-test-unknown",
  );
});

test("the source-order field chains remain draft, with real premises, readings and foundation returns", () => {
  const foundations = readFileSync(
    new URL("../../../content/foundations/registry.yaml", import.meta.url),
    "utf8",
  );
  assert.equal(srFieldTransformMetadata.section, "s6");
  for (const chain of srFieldTransformDerivations) {
    const report = verifyChain(chain);
    assert.equal(report.passed, true, JSON.stringify(report));
    assert.equal(chain.routeKind, "source-order");
    assert.equal(chain.steps.at(-1)?.id, chain.targetStepId);
    for (const [index, step] of chain.steps.entries()) {
      assert.equal(step.verification.status, "authored-unverified");
      assert.ok(step.premiseRefs.length > 0);
      assert.ok(step.tool && foundations.includes(`id: "${step.tool}"`));
      assert.ok(step.sourceAnchor);
      assert.ok(
        !step.premiseRefs.some((premise) => premise.edgeType === "modern-verification-oracle"),
      );
      if (index > 0)
        assert.ok(structurallyEqual(present(chain.steps[index - 1]).to, step.from), step.id);
      const readings = srFieldTransformReadingSet(step);
      for (const level of ["r0", "r1", "r2", "r3"] as const) assert.ok(readings[level].length > 30);
      assert.ok(readings.r3Citations.some((citation) => citation.includes("§6")));
    }
  }
  assert.equal(srFieldNormalizationDerivation.steps.filter((step) => step.isMove).length, 1);
  assert.equal(
    verifyChain(srFieldNormalizationDerivation, { isPublicationGate: true }).passed,
    false,
  );
});

test("removing a result or reversing the opening dependency fails every field chain", () => {
  for (const chain of srFieldTransformDerivations) {
    assert.equal(
      verifyChain({ ...chain, steps: chain.steps.slice(0, -1) }).passed,
      false,
      chain.id,
    );
    const [first, second, ...rest] = chain.steps;
    assert.ok(first && second);
    const reordered: DerivationChain = { ...chain, steps: [second, first, ...rest] };
    assert.equal(verifyChain(reordered).passed, false, chain.id);
  }
});

test("the derivative operators implement the chain rule on arbitrary scalar gradients for both boost signs", () => {
  for (const c of [1, 2.7])
    for (const speedRatio of [-0.8, -0.2, 0, 0.6, 0.93]) {
      const fixture: EventFixture = { c, v: speedRatio * c, fields: {}, probe: [9, 3, -5, 7, 11] };
      for (const chain of srFieldTransformDerivations.slice(0, 2))
        for (const step of chain.steps) {
          checkEquation(step.from, fixture);
          checkEquation(step.to, fixture);
        }
      for (const equation of srFieldOperatorEquations) checkEquation(equation, fixture);
    }
});

test("all six full regrouped residual identities hold for unconstrained analytic first derivatives", () => {
  // Arbitrary jets deliberately do NOT obey Maxwell's equations; equality of two zero
  // residuals would miss a wrong identity or an omitted divergence term.
  for (const speedRatio of [-0.8, 0, 0.37, 0.91])
    for (let sample = 1; sample <= 8; sample++) {
      const fields = Object.fromEntries(
        componentKeys.map((key, index) => [
          key,
          [
            sample + index,
            Math.sin(sample + index),
            2 * Math.cos(3 * sample + index),
            -Math.sin(2 * sample - index),
            Math.cos(sample - 2 * index),
          ] as Jet,
        ]),
      );
      const fixture = { c: 2.7, v: speedRatio * 2.7, fields };
      for (const row of srFieldComponentRows) {
        checkEquation(row.residualIdentity, fixture, 20);
        const [left, right] = sides(row.source, fixture);
        const [changedLeft, changedRight] = sides(row.changed, fixture);
        near(changedLeft, left, 20);
        near(changedRight, right, 20);
      }
    }
});

function waveFixture(normal: Vec3, electric: Vec3, speedRatio: number): EventFixture {
  const c = 2.7;
  const omega = 1.9;
  const phase = 0.43;
  const magnetic = {
    x: normal.y * electric.z - normal.z * electric.y,
    y: normal.z * electric.x - normal.x * electric.z,
    z: normal.x * electric.y - normal.y * electric.x,
  };
  const unitJet: Jet = [
    Math.sin(phase),
    omega * Math.cos(phase),
    ((-omega * normal.x) / c) * Math.cos(phase),
    ((-omega * normal.y) / c) * Math.cos(phase),
    ((-omega * normal.z) / c) * Math.cos(phase),
  ];
  return {
    c,
    v: speedRatio * c,
    fields: Object.fromEntries(
      axes.flatMap((axis) => [
        [`E${axis}`, scale(unitJet, electric[axis])],
        [`B${axis}`, scale(unitJet, magnetic[axis])],
      ]),
    ),
  };
}
const s = Math.SQRT1_2;
const waveFamilies: readonly { normal: Vec3; polarizations: readonly Vec3[] }[] = [
  {
    normal: { x: 1, y: 0, z: 0 },
    polarizations: [
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 0, z: 2 },
    ],
  },
  {
    normal: { x: -1, y: 0, z: 0 },
    polarizations: [
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 0, z: 2 },
    ],
  },
  {
    normal: { x: 0, y: 1, z: 0 },
    polarizations: [
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 2 },
    ],
  },
  {
    normal: { x: s, y: s, z: 0 },
    polarizations: [
      { x: -2 * s, y: 2 * s, z: 0 },
      { x: 0, y: 0, z: 2 },
    ],
  },
];

test("source, changed-variable and grouped equations hold for both polarizations of four wave directions", () => {
  for (const family of waveFamilies)
    for (const electric of family.polarizations)
      for (const speedRatio of [-0.6, 0, 0.6, 0.9]) {
        const fixture = waveFixture(family.normal, electric, speedRatio);
        for (const constraint of srFieldVacuumConstraints) checkEquation(constraint, fixture, 10);
        for (const row of srFieldComponentRows) {
          checkEquation(row.source, fixture, 20);
          checkEquation(row.changed, fixture, 20);
          checkEquation(row.grouped, fixture, 20);
        }
      }
  for (const wave of ["plus-x", "minus-x", "plus-y", "oblique"] as const)
    for (const polarization of ["primary", "secondary"] as const) {
      for (const beta of [-0.6, 0, 0.6, 0.9])
        assert.equal(maxwellResidualsPlaneWave({ beta, wave, polarization }).passed, true);
    }
});

test("a mixed-field sign error and a missing vacuum divergence produce nonzero residuals", () => {
  const fixture = waveFixture({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, 0.6);
  const candidate = srFieldCandidateComponents.Z;
  assert.equal(candidate.kind, "product");
  const gammaProduct = candidate as Extract<Expression, { kind: "product" | "sum" }>;
  const combination = gammaProduct.args[1];
  assert.equal(combination?.kind, "sum");
  const terms = combination as Extract<Expression, { kind: "product" | "sum" }>;
  const wrong: Expression = {
    ...gammaProduct,
    args: [
      present(gammaProduct.args[0]),
      {
        ...terms,
        args: [present(terms.args[0]), { kind: "negate", argument: present(terms.args[1]) }],
      },
    ],
  };
  const wrongRow = replaceMath(
    present(srFieldComponentRows.find((row) => row.component === "M")).grouped,
    candidate,
    wrong,
  );
  const [left, right] = sides(wrongRow, fixture);
  assert.ok(Math.abs(left - right) > 0.1);
  assert.equal(
    maxwellResidualsPlaneWave({
      beta: 0.6,
      wave: "plus-x",
      polarization: "secondary",
      convention: "flipped-z-prime",
    }).passed,
    false,
  );

  // E_x = x has zero curl and no time dependence, but nonzero electric divergence.
  const longitudinal: EventFixture = {
    c: 2.7,
    v: 1.62,
    fields: {
      ...jetsFor({ E: { x: 0, y: 0, z: 0 }, B: { x: 0, y: 0, z: 0 } }),
      Ex: [0, 0, 1, 0, 0],
    },
  };
  const xRow = present(srFieldComponentRows.find((row) => row.component === "X"));
  checkEquation(xRow.source, longitudinal);
  const [groupedLeft, groupedRight] = sides(xRow.grouped, longitudinal);
  near(groupedLeft - groupedRight, (g(longitudinal) * longitudinal.v) / longitudinal.c);
  assert.ok(Math.abs(groupedLeft - groupedRight) > 0.1);
});

test("all six Gaussian component expressions agree with the reference owner and undo under the inverse boost", () => {
  const fields: Fields = { E: { x: 1.3, y: -2.1, z: 0.7 }, B: { x: -0.4, y: 1.2, z: 2.4 } };
  for (const c of [1, 2.7])
    for (const speedRatio of [-0.87, -0.3, 0, 0.6, 0.91]) {
      const transformed = transformGaussianHistorical({ ...fields, boost: speedRatio * c, c });
      const fixture = {
        c,
        v: speedRatio * c,
        fields: jetsFor(fields),
        movingFields: jetsFor(transformed),
      };
      for (const equation of srFieldGaussianEquations) checkEquation(equation, fixture);
      const recovered = transformGaussianHistorical({
        E: transformed.E,
        B: transformed.B,
        boost: -speedRatio * c,
        c,
      });
      for (const axis of axes) {
        near(recovered.E[axis], fields.E[axis]);
        near(recovered.B[axis], fields.B[axis]);
      }
    }
});

test("canonical SI equations and Gaussian transforms commute with the explicit electric and magnetic unit conversion", () => {
  const fields: Fields = {
    E: { x: 2.4, y: -7.1, z: 9.2 },
    B: { x: -0.7e-8, y: 1.2e-8, z: 2.3e-8 },
  };
  const original = mapSIToGaussianHistorical(fields.E, fields.B);
  const gaussian = {
    E: { x: original.X, y: original.Y, z: original.Z },
    B: { x: original.L, y: original.M, z: original.N },
  };
  for (const speedRatio of [-0.8, 0, 0.6]) {
    const boost = speedRatio * C_SI;
    const si = transformSI({ ...fields, boost });
    const gaussianResult = transformGaussianHistorical({ ...gaussian, boost });
    const convertedBack = mapGaussianHistoricalToSI({
      X: gaussianResult.E.x,
      Y: gaussianResult.E.y,
      Z: gaussianResult.E.z,
      L: gaussianResult.B.x,
      M: gaussianResult.B.y,
      N: gaussianResult.B.z,
    });
    for (const axis of axes) {
      near(convertedBack.E[axis], si.E[axis], 10);
      near(convertedBack.B[axis], si.B[axis], 1e-7);
    }
    const fixture = { c: C_SI, v: boost, fields: jetsFor(fields), movingFields: jetsFor(si) };
    for (const { tree } of srFieldSIEquations) checkEquation(tree, fixture, 1e-7);
    for (const tree of srFieldGaussianEquations)
      checkEquation(
        tree,
        { ...fixture, fields: jetsFor(gaussian), movingFields: jetsFor(gaussianResult) },
        1e-4,
      );
  }
  const a = Math.sqrt(4 * Math.PI * EPS0);
  near(original.Y, a * fields.E.y, 1e-4);
  near(original.N, C_SI * a * fields.B.z, 1e-4);
  // Merely renaming B leaves out c and disagrees with the physical conversion.
  assert.ok(Math.abs(original.N - a * fields.B.z) > 1e-5);
  for (const { id, tree } of srFieldSIEquations) {
    const source = JSON.parse(
      readFileSync(
        new URL(`../../../content/equations/special-relativity/${id}.json`, import.meta.url),
        "utf8",
      ),
    ) as { tree: Expression };
    const glyphs = Object.fromEntries(
      walk(tree)
        .filter((node) => node.kind === "symbol")
        .map((node) => [node.quantityId, node.termId]),
    );
    assert.ok(
      structurallyEqual(
        projectDerivationSymbols(source.tree, (binding) => present(glyphs[binding.quantityId])),
        tree,
      ),
    );
  }
});

test("inverse consistency, evenness and positive identity normalization supply distinct restrictions", () => {
  const fields = { E: { x: 2, y: 0, z: 0 }, B: { x: 0, y: 0, z: 0 } };
  const fixture: EventFixture = {
    c: 2.7,
    v: 1.62,
    fields: jetsFor(fields),
    movingFields: jetsFor(fields),
  };
  for (const step of srFieldNormalizationDerivation.steps) {
    checkEquation(step.from, fixture);
    checkEquation(step.to, fixture);
  }
  for (const equation of srFieldAnsatzEquations) checkEquation(equation, fixture);
  const byId = (id: string) =>
    present(srFieldNormalizationDerivation.steps.find((step) => step.id === id));
  const exponential = { ...fixture, psi: (speed: number) => Math.exp(speed / fixture.c) };
  checkEquation(byId("sr-field-inverse-reciprocity").to, exponential);
  const [evenLeft, evenRight] = sides(byId("sr-field-even-scale").to, exponential);
  assert.ok(Math.abs(evenLeft - evenRight) > 0.1);
  const negative = { ...fixture, psi: () => -1 };
  checkEquation(byId("sr-field-square-scale").to, negative);
  const [rootLeft, rootRight] = sides(byId("sr-field-select-connected-sign").to, negative);
  assert.equal(rootLeft, 1);
  assert.equal(rootRight, -1);
  const withoutNonzero = {
    ...srFieldNormalizationDerivation,
    steps: srFieldNormalizationDerivation.steps.map((step) =>
      step.id === "sr-field-inverse-reciprocity"
        ? { ...step, rule: { ...step.rule, params: { ...step.rule.params, nonzeroCondition: "" } } }
        : step,
    ),
  };
  const withoutBranch = {
    ...srFieldNormalizationDerivation,
    steps: srFieldNormalizationDerivation.steps.map((step) =>
      step.id === "sr-field-positive-branch"
        ? { ...step, rule: { ...step.rule, params: { ...step.rule.params, branchCondition: "" } } }
        : step,
    ),
  };
  assert.equal(verifyChain(withoutNonzero).passed, false);
  assert.equal(verifyChain(withoutBranch).passed, false);
});

test("source display retains scientific component bindings and does not mutate canonical SI notation", () => {
  const original = structuredClone(srFieldGaussianEquations);
  const displayed = srFieldGaussianEquations.map(srFieldSourceDisplayExpression);
  assert.deepEqual(srFieldGaussianEquations, original);
  const raw = walk(present(srFieldGaussianEquations[0]));
  assert.ok(
    raw.some(
      (node) =>
        node.kind === "symbol" && node.quantityId === "electricFieldMoving" && node.index === "x",
    ),
  );
  assert.equal(expressionToDerivationLatex(present(displayed[0])), "X' = X");
  assert.ok(expressionToDerivationLatex(srFieldCoordinateMap[1]).includes("ξ"));
  const si = expressionToDerivationLatex(present(srFieldSIEquations[0]).tree);
  assert.ok(si.includes("E'_{\\mathrm{x}}"));
  assert.ok(si.includes("E_{\\mathrm{x}}"));
});
