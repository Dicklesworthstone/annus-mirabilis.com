import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { nodeId, walk } from "../equations/ast.ts";
import { exactPolynomial, equalPolynomials, equalityResidual, PolynomialRefusal } from "../equations/derivations/exactPolynomial.ts";
import { checkLinearCertificate, assessLinearCertificate } from "../equations/derivations/linearCertificate.ts";

const num = value => ({ kind: "number", value: String(value) });
const symbol = (quantityId, termId = quantityId) => ({ kind: "symbol", quantityId, termId });
const sum = (...args) => ({ kind: "sum", args });
const product = (...args) => ({ kind: "product", args });
const negative = argument => ({ kind: "negate", argument });
const quotient = (numerator, denominator) => ({ kind: "quotient", numerator, denominator });
const power = (base, num) => ({ kind: "power", base, exponent: { num, den: 1 } });
const same = (a, b) => equalPolynomials(exactPolynomial(a), exactPolynomial(b));
const a = symbol("emittedEnergyRestFrame", "firstOccurrence");
const b = symbol("lorentzFactor");
const dir = new URL("../../content/equations/mass-energy/", import.meta.url);
const catalog = await Promise.all((await readdir(dir)).filter(path => path.endsWith(".json")).map(async path => JSON.parse(await readFile(new URL(path, dir), "utf8"))));
const equationId = name => `eq-model-me-${name}`;
const ref = (name, num = 1, den = 1) => ({ equation: equationId(name), coefficient: { num, den } });
const definitionId = "eq-model-me-test-difference";
const tree = { kind: "relation", operator: "define", opId: `${definitionId}.op.definition`,
  left: symbol("kineticEnergyDifference", `${definitionId}.t.delta`),
  right: sum(symbol("kineticEnergyBefore", `${definitionId}.t.before`), negative(symbol("kineticEnergyAfter", `${definitionId}.t.after`))) };
const definition = { ...catalog[0], id: definitionId, argument: "arg-me-constant-premise", tree, bindings: [],
  notes: walk(tree).filter(n => nodeId(n)).map(n => ({ nodeId: nodeId(n), title: "Fixture term", explanation: "A definition, not an extra physical premise.", foundation: "work-energy" })),
  sentence: [{ text: "Delta K means before minus after." }] };
const equations = [...catalog, definition];
function proof() {
  return { id: "proof-me-elimination", paper: "mass-energy", premises: [
    { id: "rest", kind: "assumption", equations: [equationId("rest-ledger")] },
    { id: "moving", kind: "assumption", equations: [equationId("moving-ledger")] },
    { id: "offset", kind: "assumption", equations: [equationId("offset-before"), equationId("offset-after")] },
    { id: "notation", kind: "definition", equations: [definitionId] },
  ], steps: [
    { id: "subtract", equation: equationId("ledger-subtraction"), combination: [ref("moving-ledger"), ref("rest-ledger", -1)] },
    { id: "cancel", equation: equationId("exact-drop"), combination: [ref("ledger-subtraction"), ref("offset-before", -1), ref("offset-after"), { equation: definitionId, coefficient: { num: 1, den: 1 } }] },
  ] };
}

test("decimal arithmetic is exact; a tiny nonzero residual is never a tolerance success", () => {
  assert.ok(same(sum(num("0.1"), num("0.2")), num("0.3")));
  assert.ok(!same(sum(a, num("1e-100")), a));
  assert.ok(same(quotient(num(1), num(3)), quotient(num(2), num(6))));
});
test("expand, factor, collect and reorder preserve canonical quantities rather than occurrence ids", () => {
  assert.ok(same(product(a, sum(b, num(-1))), sum(product(b, symbol("emittedEnergyRestFrame", "elsewhere")), negative(a))));
  assert.ok(same(power(sum(a, b), 2), sum(power(a, 2), product(num(2), a, b), power(b, 2))));
  assert.ok(!same(symbol("bodyEnergyRestBefore", "sameGlyph"), symbol("bodyEnergyRestAfter", "sameGlyph")));
  assert.ok(same({ ...a, scale: { num: 1, den: 2 } }, quotient(a, num(2))));
});
for (const [name, expression] of [
  ["symbolic division", quotient(a, a)],
  ["zero denominator", quotient(num(0), num(0))],
  ["negative power", power(a, -1)],
  ["fractional power", { ...power(a, 1), exponent: { num: 1, den: 2 } }],
  ["root", { kind: "root", radicand: a, degree: 2 }],
  ["logarithm", { kind: "function", name: "ln", argument: a }],
  ["expectation", { kind: "average", argument: a }],
  ["overflow exponent", num("1e1000000")],
  ["nonfinite literal", num("Infinity")],
  ["unsupported branch multiplied by zero", product(num(0), quotient(a, a))],
  ["unsupported base raised to zero", power(quotient(a, a), 0)],
  ["expansion explosion", power(sum(...Array.from({ length: 16 }, (_, i) => symbol(`q${i}`))), 16)],
]) test(`exact algebra refuses ${name} rather than fabricating proof`, () => {
  assert.throws(() => exactPolynomial(expression), PolynomialRefusal);
});

test("cycles and accessors cannot execute unbounded or reader-provided code", () => {
  const cycle = { kind: "group" }; cycle.argument = cycle;
  assert.throws(() => exactPolynomial(cycle), /budget/);
  let invoked = false;
  const node = { kind: "symbol", termId: "x" };
  Object.defineProperty(node, "quantityId", { enumerable: true, get() { invoked = true; return "x"; } });
  assert.throws(() => exactPolynomial(node)); assert.equal(invoked, false);
});

test("both real mass-energy elimination steps have exact certificates and transitive dependencies", () => {
  const checked = checkLinearCertificate(proof(), equations);
  assert.equal(checked.check, "exact-polynomial-elimination");
  assert.deepEqual(checked.requirements, [{ step: "subtract", premises: ["rest", "moving"] }, { step: "cancel", premises: ["rest", "moving", "offset", "notation"] }]);
  assert.deepEqual(assessLinearCertificate(checked, ["rest", "moving", "offset", "notation"]).map(s => s.status), ["supported", "supported"]);
  assert.ok(Object.isFrozen(checked.steps[0].combination[0].coefficient));
});
test("without the same-offset premise, conservation still supports the weaker result only", () => {
  const checked = checkLinearCertificate(proof(), equations);
  assert.deepEqual(assessLinearCertificate(checked, ["rest", "moving", "notation"]), [
    { id: "subtract", status: "supported", missing: [] },
    { id: "cancel", status: "blocked", missing: ["offset"] },
  ]);
  for (const name of ["rest", "moving", "notation"]) {
    const status = assessLinearCertificate(checked, ["rest", "moving", "offset", "notation"].filter(id => id !== name));
    assert.equal(status[1].status, "blocked"); assert.ok(status[1].missing.includes(name));
  }
  assert.equal(assessLinearCertificate(checked, []).every(s => s.status === "blocked"), true);
});
test("checking does not mutate the authored objects and reports are serializable", () => {
  const input = proof(), before = structuredClone(input);
  const checked = checkLinearCertificate(input, equations);
  assert.deepEqual(input, before);
  input.steps[0].combination[0].coefficient.num = 999;
  assert.equal(checked.steps[0].combination[0].coefficient.num, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(checked)), checked);
});
for (const [name, change] of [
  ["wrong subtraction sign", p => p.steps[0].combination[1].coefficient.num = 1],
  ["dropping an offset without the before premise", p => p.steps[1].combination.splice(1, 1)],
  ["self justification", p => p.steps[0].combination[0].equation = p.steps[0].equation],
  ["future justification", p => p.steps.reverse()],
  ["assuming the conclusion", p => p.premises[0].equations.push(equationId("exact-drop"))],
  ["approximation as equality", p => p.steps[1].equation = equationId("quadratic-drop")],
  ["approximation as premise", p => p.premises[0].equations = [equationId("quadratic-drop")]],
  ["definition misrepresented as a premise", p => p.premises[3].kind = "assumption"],
  ["zero multiplier", p => p.steps[0].combination[0].coefficient.num = 0],
  ["nonreduced rational", p => p.steps[0].combination[0].coefficient = { num: 2, den: 2 }],
  ["unrecognized record", p => p.steps[0].equation = "eq-model-no-such-record"],
  ["duplicate premise", p => p.premises.push(p.premises[0])],
  ["reused equation", p => p.premises[1].equations = p.premises[0].equations],
  ["duplicate step", p => p.steps[1].id = p.steps[0].id],
  ["duplicate justification", p => p.steps[0].combination.push(p.steps[0].combination[0])],
  ["authored verification label", p => p.check = "verified"],
]) test(`certificate refuses ${name}`, () => {
  const input = proof(); change(input); assert.throws(() => checkLinearCertificate(input, equations));
});
test("catalog identities, dimensions, paper scope and definition meaning stay closed", () => {
  assert.throws(() => checkLinearCertificate(proof(), [...equations, equations[0]]));
  const copy = structuredClone(equations); copy[0].paper = "brownian-motion";
  assert.throws(() => checkLinearCertificate(proof(), copy));
  const input = proof(); input.paper = "constructor";
  assert.throws(() => checkLinearCertificate(input, equations));
  assert.throws(() => equalityResidual({ kind: "relation", operator: "approx", left: num(1), right: num(1) }));
  const checked = checkLinearCertificate(proof(), equations);
  assert.throws(() => assessLinearCertificate(checked, ["unknown"]));
  assert.throws(() => assessLinearCertificate(checked, ["rest", "rest"]));
});
