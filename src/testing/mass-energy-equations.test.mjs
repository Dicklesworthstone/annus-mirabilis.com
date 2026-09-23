import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { nodeId, walk } from "../equations/ast.ts";
import { checkDimensions } from "../equations/dimensions.ts";
import { expressionLatex } from "../equations/latex.ts";
import { MASS_ENERGY_QUANTITIES } from "../equations/massEnergyQuantities.ts";
import { navigationTree } from "../equations/navigation.ts";
import { parseEquationRecord } from "../equations/record.ts";
import { teachingProfile } from "../equations/teachingProfiles.ts";
import { evaluateMe02 } from "../physics/reference/massEnergy.ts";

const directory = new URL("../../content/equations/mass-energy/", import.meta.url);
const records = await Promise.all(
  (await readdir(directory))
    .filter((p) => p.endsWith(".json"))
    .map(async (p) => JSON.parse(await readFile(new URL(p, directory), "utf8"))),
);
const byName = (name) => records.find((e) => e.id === `eq-model-me-${name}`);

// Test-only algebra, independent of the production physics owners and TeX renderer.
function evaluate(node, values) {
  switch (node.kind) {
    case "number":
      return Number(node.value);
    case "symbol": {
      assert.ok(Object.hasOwn(values, node.quantityId), `Missing fixture value ${node.quantityId}`);
      return (values[node.quantityId] * (node.scale?.num ?? 1)) / (node.scale?.den ?? 1);
    }
    case "negate":
      return -evaluate(node.argument, values);
    case "sum":
      return node.args.reduce((a, b) => a + evaluate(b, values), 0);
    case "product":
      return node.args.reduce((a, b) => a * evaluate(b, values), 1);
    case "quotient":
      return evaluate(node.numerator, values) / evaluate(node.denominator, values);
    case "root":
      return evaluate(node.radicand, values) ** (1 / node.degree);
    case "power":
      return evaluate(node.base, values) ** (node.exponent.num / node.exponent.den);
    case "group":
      return evaluate(node.argument, values);
    case "function": {
      const f = { cos: Math.cos, sin: Math.sin, exp: Math.exp, ln: Math.log }[node.name];
      assert.ok(f, `Unexpected test function: ${node.name}`);
      return f(evaluate(node.argument, values));
    }
    default:
      throw new Error(`Unexpected test expression: ${node.kind}`);
  }
}
const fixture = Object.freeze({
  emittedEnergyRestFrame: 2,
  bodyEnergyRestBefore: 7,
  bodyEnergyRestAfter: 5,
  bodyEnergyMovingBefore: 13,
  bodyEnergyMovingAfter: 10.5,
  kineticEnergyBefore: 4,
  kineticEnergyAfter: 3.5,
  additiveEnergyConstant: 2,
  frameSpeed: 3,
  speedOfLight: 5,
  lorentzFactor: 1.25,
  kineticEnergyDifference: 0.5,
  quadraticKineticDifference: 0.36,
  finiteSpeedMassProxy: 1 / 9,
  inertialMassDecrease: 0.08,
  massChangeSigned: -0.08,
  // Worked by hand from the values above, not by evaluating a record: beta = 3/5; the body's
  // mass falls by L/c^2 = 2/25 from 1; one pulse of energy 1 (half of L) sent at 60 degrees,
  // where cos = 1/2, carries 1 x 1.25 x (1 - 0.6 x 0.5) = 0.875 in the moving frame.
  speedRatio: 0.6,
  bodyMassBefore: 1,
  bodyMassAfter: 0.92,
  emissionAngle: Math.PI / 3,
  lightComplexEnergyStationary: 1,
  lightComplexEnergyMoving: 0.875,
});
/** The members of a chained relation, a = b = c, in order. */
const chain = (node) =>
  node.kind === "relation" && node.operator === "="
    ? [...chain(node.left), ...chain(node.right)]
    : [node];
function close(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) <= 2e-14 * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  );
}
/**
 * A limit is approached, not evaluated at its point: at v = 0 the low-speed quotient divides by
 * zero, and at the fixture's v = 3 it is the finite-speed proxy (1/9), not L/c^2 (0.08). So the
 * body is evaluated as the speed closes in on zero, at beta = 1e-2 and then 1e-4, with the Lorentz
 * factor worked by hand from the speed each time (gamma = 1/sqrt(1 - beta^2)), not taken from a
 * record. The value must close in on the other side: nearer at 1e-4 than at 1e-2, and within 1e-6
 * relative at 1e-4 (the series says 3 beta^2 / 4, about 7.5e-9 there). Only speed limits occur.
 */
function approachLimit(node, expected, values) {
  assert.equal(node.variable.quantityId, "frameSpeed", "Only a limit in the speed is fixtured.");
  assert.equal(evaluate(node.approaches, values), 0, "Only a limit toward zero is fixtured.");
  const gap = (beta) => {
    const moved = {
      ...values,
      frameSpeed: beta * values.speedOfLight,
      lorentzFactor: 1 / Math.sqrt(1 - beta ** 2),
    };
    return Math.abs(evaluate(node.expression, moved) - expected) / Math.abs(expected);
  };
  const far = gap(1e-2);
  const near = gap(1e-4);
  assert.ok(near < far, `Not closing in: ${near} at beta 1e-4, ${far} at 1e-2`);
  assert.ok(near < 1e-6, `Relative gap ${near} at beta 1e-4`);
}

for (const source of records) {
  test(`${source.id}: exact dimensions, closed identity, all term and operation explanations`, () => {
    const record = parseEquationRecord(source, source.id);
    assert.equal(record.paper, "mass-energy");
    assert.equal(record.notation, "modern-pedagogical");
    assert.equal(record.review, "draft");
    assert.equal(checkDimensions(record.tree, MASS_ENERGY_QUANTITIES).status, "consistent");
    const nodes = walk(record.tree).flatMap((n) => (nodeId(n) ? [nodeId(n)] : []));
    assert.equal(nodes.length, new Set(nodes).size);
    assert.deepEqual(new Set(record.notes.map((n) => n.nodeId)), new Set(nodes));
    assert.equal(navigationTree(record.tree).length, nodes.length);
    const marked = expressionLatex(record.tree, MASS_ENERGY_QUANTITIES, true);
    for (const id of nodes) assert.ok(marked.includes(id), `Missing rendered target ${id}`);
    assert.ok(Object.isFrozen(record.tree));
  });
  if (source.tree.operator !== "approx") {
    test(`${source.id}: independent ledger fixture satisfies the actual expression`, () => {
      // A chain a = b = c is checked link by link, so every member has to hold.
      const members =
        source.tree.operator === "=" ? chain(source.tree) : [source.tree.left, source.tree.right];
      assert.ok(members.length >= 2);
      for (let i = 1; i < members.length; i++) {
        const [a, b] = [members[i - 1], members[i]];
        if (a.kind === "limit") approachLimit(a, evaluate(b, fixture), fixture);
        else if (b.kind === "limit") approachLimit(b, evaluate(a, fixture), fixture);
        else close(evaluate(a, fixture), evaluate(b, fixture));
      }
    });
  }
}

test("every mass-energy record joins the real compiler, and none leaks into the Brownian slice", async () => {
  const result = compileReadingContent(await loadReadingFiles());
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const me = result.papers.find((p) => p.paper.id === "mass-energy");
  // Populations from the record directories, not frozen counts (15 and 3 until two batches of
  // records landed on 2026-09-22).
  assert.equal(me.equations.length, records.length);
  const brownianOnDisk = (
    await readdir(new URL("../../content/equations/brownian-motion/", import.meta.url))
  ).filter((p) => p.endsWith(".json")).length;
  const brownian = result.papers.find((p) => p.paper.id === "brownian-motion");
  assert.equal(brownian.equations.length, brownianOnDisk);
  assert.ok(brownian.equations.every((e) => e.paper === "brownian-motion"));
  assert.ok(me.equations.every((e) => e.paper === "mass-energy"));
  for (const eq of me.equations) {
    assert.ok(me.arguments.some((a) => a.id === eq.argument));
    for (const note of eq.notes)
      assert.ok(result.foundations.some((f) => f.id === note.foundation));
    assert.ok(
      result.diagnostics.some((d) => d.path === eq.id && d.code === "equation-review-pending"),
    );
  }
});

test("quadratic truncation is visibly approximate and unequal to the finite-speed exact drop", () => {
  const eq = byName("quadratic-drop");
  assert.equal(eq.tree.operator, "approx");
  assert.ok(expressionLatex(eq.tree, MASS_ENERGY_QUANTITIES).includes("\\approx"));
  close(evaluate(eq.tree.right, fixture), 0.36);
  assert.notEqual(evaluate(eq.tree.left, fixture), evaluate(eq.tree.right, fixture));
  const exact = byName("exact-drop");
  assert.equal(exact.tree.operator, "=");
  assert.match(exact.assumptions.join(" "), /same unknown additive C/);
});

test("changing the offset cannot make the same-C equations remain true", () => {
  const changed = { ...fixture, kineticEnergyAfter: 2.5 };
  const eq = byName("offset-after");
  assert.notEqual(evaluate(eq.tree.left, changed), evaluate(eq.tree.right, changed));
  // Conservation and the two-frame subtraction still hold; the kinetic identification does not.
  const subtraction = byName("ledger-subtraction");
  close(evaluate(subtraction.tree.left, changed), evaluate(subtraction.tree.right, changed));
  assert.notEqual(
    changed.kineticEnergyBefore - changed.kineticEnergyAfter,
    changed.kineticEnergyDifference,
  );
});

test("body energies and offsets stay symbolic; live bindings target only admitted owned quantities", () => {
  const protectedIds = [
    "bodyEnergyRestBefore",
    "bodyEnergyRestAfter",
    "bodyEnergyMovingBefore",
    "bodyEnergyMovingAfter",
    "kineticEnergyBefore",
    "kineticEnergyAfter",
    "additiveEnergyConstant",
  ];
  for (const eq of records)
    for (const b of eq.bindings) {
      assert.equal(b.experimentId, "me-02");
      assert.ok(!protectedIds.includes(b.quantityId));
      const contract = teachingProfile(eq.paper).outputs[b.experimentId][b.outputId];
      assert.equal(contract.unit, MASS_ENERGY_QUANTITIES[b.quantityId].unit);
      assert.equal(contract.semanticKind, MASS_ENERGY_QUANTITIES[b.quantityId].semanticKind);
    }
});

for (const beta of [-0.6, 0, 0.6]) {
  test(`actual mass-energy owner retains the exact, proxy and limit distinctions at beta=${beta}`, () => {
    const owned = evaluateMe02({ beta, emittedEnergy: 2, speedOfLight: 5 });
    assert.equal(owned.limitingCoefficient.status, "analytic-limit");
    close(owned.limitingCoefficient.representation.value, fixture.inertialMassDecrease);
    close(owned.massChangeSigned.value, fixture.massChangeSigned);
    if (beta === 0) {
      assert.equal(owned.finiteSpeedProxy.status, "not-applicable");
      assert.equal(owned.exactDifference.value, 0);
    } else {
      close(owned.exactDifference.value, fixture.kineticEnergyDifference);
      close(owned.quadraticApproximation.value, fixture.quadraticKineticDifference);
      close(owned.finiteSpeedProxy.value, fixture.finiteSpeedMassProxy);
      assert.notEqual(owned.finiteSpeedProxy.value, owned.limitingCoefficient.representation.value);
    }
  });
}

for (const [name, change] of [
  ["unknown paper", (e) => (e.paper = "special-relativity")],
  ["prototype paper", (e) => (e.paper = "constructor")],
  ["wrong argument scope", (e) => (e.argument = "arg-bm-observable")],
  ["invented review", (e) => (e.review = "reviewed")],
  ["pretended printed notation", (e) => (e.notation = "printed")],
  ["mixed units", (e) => (e.unitSystem = "gaussian-cgs")],
  ["cross-paper quantity", (e) => (e.tree.left.quantityId = "diffusionCoefficient")],
  [
    "same-unit wrong meaning",
    (e) =>
      (e.tree.right = {
        kind: "symbol",
        termId: `${e.id}.t.wrongEnergy`,
        quantityId: "quadraticKineticDifference",
      }),
  ],
  [
    "wrong dimensions",
    (e) =>
      (e.tree.right = {
        kind: "symbol",
        termId: `${e.id}.t.wrongUnit`,
        quantityId: "speedOfLight",
      }),
  ],
  ["cross-laboratory binding", (e) => (e.bindings[0].experimentId = "bm-01")],
  ["wrong output", (e) => (e.bindings[0].outputId = "quadraticKineticDifference")],
  ["missing explanation", (e) => e.notes.pop()],
]) {
  test(`refuse ${name} before rendering or substituting values`, () => {
    const record = structuredClone(byName("exact-drop"));
    change(record);
    assert.throws(() => parseEquationRecord(record, name));
  });
}

test("invalid getters are not evaluated by profile admission", () => {
  const record = structuredClone(byName("exact-drop"));
  let read = false;
  Object.defineProperty(record, "paper", {
    enumerable: true,
    get() {
      read = true;
      return "mass-energy";
    },
  });
  assert.throws(() => parseEquationRecord(record, "getter"));
  assert.equal(read, false);
  for (const paper of [null, {}, "__proto__", "toString"])
    assert.equal(teachingProfile(paper), null);
});
