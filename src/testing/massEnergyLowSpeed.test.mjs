import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { nodeId, walk } from "../equations/ast.ts";
import {
  assessLowSpeed,
  decodeLowSpeedSetup,
  lowSpeedHref,
} from "../equations/derivations/lowSpeedState.ts";
import { buildMassEnergyElimination } from "../equations/derivations/massEnergyElimination.ts";
import { buildMassEnergyLowSpeed } from "../equations/derivations/massEnergyLowSpeed.ts";
import { parseEquationRecord } from "../equations/record.ts";
import { evaluateMe02 } from "../physics/reference/massEnergy.ts";

const directory = new URL("../../content/equations/mass-energy/", import.meta.url);
const records = await Promise.all(
  (await readdir(directory))
    .filter((p) => p.endsWith(".json"))
    .map(async (p) => JSON.parse(await readFile(new URL(p, directory), "utf8"))),
);
const proof = buildMassEnergyLowSpeed(records);
const ids = proof.premises.map((p) => p.id);
const find = (source, name) => source.find((e) => e.id === `eq-model-me-${name}`);

/** Keep deliberately mutated fixtures schema-valid so the intended algebra check,
 * rather than a missing note or duplicated occurrence id, must catch the mutation.
 */
function annotated(record) {
  let count = 0;
  for (const node of walk(record.tree)) {
    if (node.kind === "symbol") node.termId = `${record.id}.t.test${count++}`;
    else if (nodeId(node)) node.opId = `${record.id}.op.test${count++}`;
  }
  record.notes = walk(record.tree).flatMap((node) =>
    nodeId(node)
      ? [
          {
            nodeId: nodeId(node),
            title: "Test mutation",
            explanation: "A deliberately mutated equation, not published content.",
            foundation: "work-energy",
          },
        ]
      : [],
  );
  record.sentence = [{ text: "This fixture tests rejection, not scientific evidence." }];
  record.bindings = [];
  return record;
}
function mutation(name, change) {
  const copy = structuredClone(records),
    eq = find(copy, name);
  change(eq);
  annotated(eq);
  // Fail here if a planted fault does not even reach the intended numerical/identity checker.
  parseEquationRecord(eq, "well-formed planted mutation");
  return copy;
}
const number = (value) => ({ kind: "number", value });
const ratio = () => ({
  kind: "quotient",
  opId: "temporary",
  numerator: { kind: "symbol", termId: "temporary", quantityId: "frameSpeed" },
  denominator: { kind: "symbol", termId: "temporary", quantityId: "speedOfLight" },
});
const power = (base, num) => ({
  kind: "power",
  opId: "temporary",
  base,
  exponent: { num, den: 1 },
});
const product = (...args) => ({ kind: "product", opId: "temporary", args });
const sum = (...args) => ({ kind: "sum", opId: "temporary", args });
const energy = () => ({
  kind: "symbol",
  termId: "temporary",
  quantityId: "emittedEnergyRestFrame",
});

test("the complete real catalogue gives a conditional coefficient and an exact two-sided limit", () => {
  assert.equal(records.length, 15);
  assert.deepEqual(proof.coefficients, ["0", "0", "1/2", "0", "3/8", "0", "5/16", "0", "35/128"]);
  assert.equal(proof.leadingCoefficient, "1/2");
  assert.equal(proof.limit.status, "analytic-limit");
  assert.equal(proof.limit.limit, "1");
  assert.equal(proof.limit.quotientAtZero, "not-applicable");
  assert.deepEqual(proof.limit.coefficients, ["1", "0", "3/4", "0", "5/8", "0", "35/64"]);
  assert.equal(proof.review, "draft");
  assert.equal(proof.notation, "modern-pedagogical");
  assert.match(proof.domain, /Fix L > 0 and c > 0/);
  assert.match(proof.scope, /not certified/);
  assert.equal(proof.limit.scope, "local-series-not-finite-error-bound");
});

test("the kinetic identification carries all dependencies of the existing exact ledger proof", () => {
  const before = buildMassEnergyElimination(records).certificate;
  assert.deepEqual(proof.prerequisites, before);
  const dependencies = before.requirements.find((r) => r.step === "name-difference").premises;
  for (const step of ["kinetic", "divide"])
    assert.deepEqual(proof.requirements.find((r) => r.step === step).premises, dependencies);
  assert.deepEqual(proof.requirements.find((r) => r.step === "identify").premises, [
    ...dependencies,
    "inertia",
  ]);
  assert.equal(
    proof.premises
      .find((p) => p.id === "inertia")
      .explanation.includes("additional physical premise"),
    true,
  );
});

test("proof construction is deterministic and does not rewrite canonical source equations", () => {
  const before = structuredClone(records);
  assert.deepEqual(buildMassEnergyLowSpeed(records), proof);
  assert.deepEqual(records, before);
  assert.equal(new Set(proof.equationIds).size, 5);
  for (const id of proof.equationIds) assert.ok(records.some((e) => e.id === id));
  assert.equal(find(records, "quadratic-drop").tree.operator, "approx");
});

for (const [label, name, change, error] of [
  [
    "wrong radical branch",
    "lorentz-factor",
    (e) => {
      e.tree.right.denominator.degree = 4;
    },
    /positive reciprocal radical/,
  ],
  [
    "changed numerator",
    "lorentz-factor",
    (e) => {
      e.tree.right.numerator.value = "2";
    },
    /positive reciprocal radical/,
  ],
  [
    "tenth-order perturbation beyond the jet",
    "lorentz-factor",
    (e) => {
      const r = e.tree.right.denominator.radicand;
      r.args.push(product(number("1e-100"), power(ratio(), 10)));
    },
    /positive reciprocal radical/,
  ],
  [
    "quadratic assertion promoted to equality",
    "quadratic-drop",
    (e) => {
      e.tree.operator = "=";
    },
    /approximation sign/,
  ],
  [
    "wrong quadratic coefficient",
    "quadratic-drop",
    (e) => {
      const value = walk(e.tree).find((n) => n.kind === "number" && n.value === "0.5");
      value.value = "0.4";
    },
    /exactly the quadratic/,
  ],
  [
    "hidden tenth-order term in stated quadratic",
    "quadratic-drop",
    (e) => {
      e.tree.right = sum(e.tree.right, product(energy(), power(ratio(), 10)));
    },
    /exactly the quadratic/,
  ],
  [
    "proxy multiplier changed",
    "finite-speed-proxy",
    (e) => {
      e.tree.right.numerator.args[0].value = "3";
    },
    /coefficient role/,
  ],
  [
    "proxy definition promoted to approximation",
    "finite-speed-proxy",
    (e) => {
      e.tree.operator = "approx";
    },
    /coefficient role/,
  ],
  [
    "mass coefficient doubled",
    "mass-decrease",
    (e) => {
      e.tree.right.numerator = product(number("2"), e.tree.right.numerator);
    },
    /coefficient role/,
  ],
  [
    "speed denominator rescaled",
    "mass-decrease",
    (e) => {
      e.tree.right.denominator.base.scale = { num: 2, den: 1 };
    },
    /coefficient role/,
  ],
  [
    "exact kinetic source changed",
    "exact-drop",
    (e) => {
      e.tree.right = product(number("2"), e.tree.right);
    },
    /./,
  ],
  [
    "offset premise changed",
    "offset-after",
    (e) => {
      e.tree.right.args[1].scale = { num: 2, den: 1 };
    },
    /./,
  ],
])
  test(`a schema-valid ${label} invalidates the proof`, () => {
    const copy = mutation(name, change);
    assert.throws(() => buildMassEnergyLowSpeed(copy), error);
  });

test("missing proof equations or a duplicated canonical identity cannot yield a certificate", () => {
  for (const name of [
    "lorentz-factor",
    "offset-before",
    "raw-subtraction",
    "quadratic-drop",
    "finite-speed-proxy",
    "mass-decrease",
  ])
    assert.throws(() =>
      buildMassEnergyLowSpeed(records.filter((e) => e.id !== `eq-model-me-${name}`)),
    );
  assert.throws(() =>
    buildMassEnergyLowSpeed([...records, structuredClone(find(records, "mass-decrease"))]),
  );
});

test("equivalent complete polynomial regrouping remains accepted without assuming a string match", () => {
  const copy = mutation("quadratic-drop", (e) => {
    e.tree.right = product(number("0.25"), number("2"), energy(), power(ratio(), 2));
  });
  assert.deepEqual(buildMassEnergyLowSpeed(copy).coefficients, proof.coefficients);
});

for (let mask = 0; mask < 32; mask++)
  test(`premise subset ${mask}: mathematics and physical identification remain separate`, () => {
    const selected = ids.filter((_, i) => mask & (1 << i));
    for (const order of [2, 4, 6]) {
      const selection = { selected, order },
        assessment = assessLowSpeed(proof, selection);
      for (const result of assessment) {
        const required = proof.requirements.find((r) => r.step === result.id).premises;
        assert.deepEqual(
          result.missing,
          required.filter((id) => !selected.includes(id)),
        );
        assert.equal(result.status, result.missing.length ? "blocked" : "supported");
      }
      assert.equal(assessment.find((s) => s.id === "expand").status, "supported");
      assert.equal(assessment.find((s) => s.id === "limit").status, "supported");
      assert.equal(
        assessment.find((s) => s.id === "identify").status,
        selected.length === 5 ? "supported" : "blocked",
      );
      const url = new URL(lowSpeedHref(proof, selection), "https://annus-mirabilis.com");
      assert.equal(url.hash, "#me-low-speed-derivation");
      assert.equal(url.pathname, "/papers/mass-energy/");
      assert.deepEqual(decodeLowSpeedSetup(proof, url.search), { kind: "setup", selection });
    }
  });

test("retained order changes presentation but not the conditional mass coefficient", () => {
  const selections = [2, 4, 6].map((order) => ({ selected: ids, order }));
  for (const s of selections)
    assert.deepEqual(assessLowSpeed(proof, s), assessLowSpeed(proof, selections[0]));
  assert.equal(proof.limit.limit, "1");
});
for (const search of [
  "?mel=2",
  "?mel=1&mel=1",
  "?mel-order=2",
  "?mel=1&mel-order=2&mel-order=4",
  "?mel=1&mel-order=02",
  "?mel=1&mel-order=2junk",
  "?mel=1&mel-order=8",
  "?mel=1&mel-off=",
  "?mel=1&mel-off=unknown",
  "?mel=1&mel-off=inertia,inertia",
  "?mel=1&mel-off=offset&mel-off=inertia",
  "?mel=1&mel-off=__proto__",
  "?mel=1&mel-off=%3Cscript%3E",
  "?mel=1&mel-off=rest,",
  "?mel=1&mel-order=NaN",
  `?mel=1&note=${"x".repeat(8192)}`,
])
  test(`ambiguous or unsupported link is not restored: ${search.slice(0, 80)}`, () => {
    assert.equal(decodeLowSpeedSetup(proof, search).kind, "invalid");
  });

test("other reader namespaces and unknown query text never become proof evidence", () => {
  assert.equal(decodeLowSpeedSetup(proof, "?mep=1&mep-off=offset&note=private").kind, "absent");
  const restored = decodeLowSpeedSetup(proof, "?mel=1&proof=proven&note=private&mel-off=inertia");
  assert.equal(restored.kind, "setup");
  assert.equal(
    assessLowSpeed(proof, restored.selection).find((s) => s.id === "identify").status,
    "blocked",
  );
  const url = lowSpeedHref(proof, restored.selection);
  assert.ok(!url.includes("private") && !url.includes("proven"));
  assert.deepEqual(Object.keys(restored.selection).sort(), ["order", "selected"]);
});
for (const selection of [
  { selected: ["offset", "offset"], order: 2 },
  { selected: ["fake"], order: 2 },
  { selected: ids, order: 8 },
])
  test(`unregistered selection ${JSON.stringify(selection)} cannot be assessed or shared`, () => {
    assert.throws(() => assessLowSpeed(proof, selection));
    assert.throws(() => lowSpeedHref(proof, selection));
  });

test("the independent numerical owner separates finite-speed proxy from the derived analytic limit", () => {
  for (const beta of [-0.6, 0, 0.6]) {
    const result = evaluateMe02({ beta, emittedEnergy: 2, speedOfLight: 5 });
    assert.equal(result.limitingCoefficient.status, "analytic-limit");
    assert.equal(result.limitingCoefficient.representation.value, 0.08);
    if (beta === 0) assert.equal(result.finiteSpeedProxy.status, "not-applicable");
    else {
      assert.equal(result.finiteSpeedProxy.status, "value");
      assert.notEqual(
        result.finiteSpeedProxy.value,
        result.limitingCoefficient.representation.value,
      );
      assert.ok(result.exactDifference.value > result.quadraticApproximation.value);
    }
  }
});
