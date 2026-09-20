import assert from "node:assert/strict";
import test from "node:test";
import { exactSeriesAtZero, monomialQuotientLimit } from "../equations/derivations/exactSeries.ts";
import { MASS_ENERGY_QUANTITIES as registry } from "../equations/massEnergyQuantities.ts";

const equationId = "eq-model-series-test";
const num = value => ({ kind: "number", value: String(value) });
const sym = quantityId => ({ kind: "symbol", quantityId });
const sum = (...args) => ({ kind: "sum", args });
const mul = (...args) => ({ kind: "product", args });
const neg = argument => ({ kind: "negate", argument });
const div = (numerator, denominator) => ({ kind: "quotient", numerator, denominator });
const pow = (base, num, den = 1) => ({ kind: "power", base, exponent: { num, den } });
const root = (radicand, degree = 2) => ({ kind: "root", radicand, degree });
const x = () => div(sym("frameSpeed"), sym("speedOfLight"));
const gamma = () => div(num(1), root(sum(num(1), neg(pow(x(), 2)))));
function stamp(raw) {
  let next = 0;
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") {
      const clone = Object.fromEntries(Object.entries(value).map(([k,v]) => [k,visit(v)]));
      if (clone.kind === "symbol") clone.termId = `${equationId}.t.n${next++}`;
      else if (clone.kind && !["number", "constant"].includes(clone.kind)) clone.opId = `${equationId}.op.n${next++}`;
      return clone;
    }
    return value;
  }
  return visit(raw);
}
const request = (expression, order = 8) => ({ expression: stamp(expression), equationId, registry,
  variable: { numerator: "frameSpeed", denominator: "speedOfLight" }, order });
const jet = (expression, order = 8) => exactSeriesAtZero(request(expression, order)).coefficients;

test("the actual Lorentz radical yields exact coefficients through eighth order", () => {
  assert.deepEqual(jet(gamma()), ["1","0","1/2","0","3/8","0","5/16","0","35/128"]);
});
test("equivalent rational exponent and reciprocal-root constructions agree", () => {
  assert.deepEqual(jet(pow(sum(num(1), neg(pow(x(),2))), -1, 2)), jet(gamma()));
});
test("integer powers and geometric inversion work at nonunit constants", () => {
  assert.deepEqual(jet(pow(sum(num(2), x()), 3), 4), ["8","12","6","1","0"]);
  assert.deepEqual(jet(div(num(1), sum(num(2), neg(x()))), 4), ["1/2","1/4","1/8","1/16","1/32"]);
});
test("positive square-root branch and a cubic root have exact rational jets", () => {
  assert.deepEqual(jet(root(sum(num(1), x())),4), ["1","1/2","-1/8","1/16","-5/128"]);
  assert.deepEqual(jet(root(sum(num(1), x()),3),3), ["1","1/3","-1/9","5/81"]);
});
test("products use convolution rather than multiplying corresponding coefficients", () => {
  assert.deepEqual(jet(mul(sum(num(1), x()), sum(num(1), neg(x()))), 4), ["1","0","-1","0","0"]);
  assert.deepEqual(jet(mul(pow(gamma(),2), sum(num(1),neg(pow(x(),2)))), 8), ["1",...Array(8).fill("0")]);
});
test("a local expansion does not claim global equality or finite-speed error coverage", () => {
  const result = exactSeriesAtZero(request(gamma(),2));
  assert.equal(result.scope,"local-series-not-finite-error-bound");
  assert.equal(result.regularity,"real-analytic-near-zero");
  assert.deepEqual(result.coefficients,["1","0","1/2"]);
  assert.ok(!Object.hasOwn(result,"equalFunctions") && !Object.hasOwn(result,"remainderBound"));
});
test("the removable kinetic quotient has limit one but no value at zero", () => {
  const result = monomialQuotientLimit(request(mul(num(2),sum(gamma(),num(-1)))),2);
  assert.equal(result.limit,"1");
  assert.equal(result.quotientAtZero,"not-applicable");
  assert.equal(result.order,6);
  assert.deepEqual(result.coefficients,["1","0","3/4","0","5/8","0","35/64"]);
});
test("a higher vanishing order can give a zero limit without claiming the numerator identically zero", () => {
  const result = monomialQuotientLimit(request(pow(x(),4),4),2);
  assert.equal(result.limit,"0");
  assert.deepEqual(result.coefficients,["0","0","1"]);
});
test("arbitrarily small nonzero lower-order residues defeat a removable limit", () => {
  assert.throws(() => monomialQuotientLimit(request(sum(gamma(),num(-1),num("1e-100"))),2), /lower-order/);
  assert.throws(() => monomialQuotientLimit(request(sum(gamma(),num(-1),mul(num("1e-100"),x()))),2), /lower-order/);
});
test("a fractional-power branch with zero radicand is not incorrectly declared analytic", () => {
  assert.throws(() => jet(root(pow(x(),2))), /base\(0\)/);
});
test("declared variable matches canonical ratio identities, not display glyph or node id", () => {
  const source = request(gamma());
  const aliasRegistry = { ...registry, impostor: {...registry.frameSpeed,id:"impostor",glyph:"v"} };
  const alias = request(div(sym("impostor"),sym("speedOfLight")));
  assert.throws(() => exactSeriesAtZero({...alias,registry:aliasRegistry}),/unbound quantity/);
  assert.deepEqual(exactSeriesAtZero(source).coefficients,jet(gamma()));
});
test("the output and input expressions cannot be changed by consumers", () => {
  const source=request(gamma()); const copy=structuredClone(source.expression);
  const result=exactSeriesAtZero(source);
  assert.deepEqual(source.expression,copy);
  for (const obj of [result,result.variable,result.coefficients]) assert.ok(Object.isFrozen(obj));
  assert.throws(() => {result.coefficients[2]="0";});
});
for(const order of [-1,13,NaN,Infinity,2.5]) test(`invalid requested order ${order} is rejected`,()=>{
  assert.throws(()=>jet(gamma(),order));
});
for(const power of [0,-1,9,NaN,1.5]) test(`unsupported removable division power ${power} is rejected`,()=>{
  assert.throws(()=>monomialQuotientLimit(request(sum(gamma(),num(-1))),power));
});
for(const [label,expression] of [
  ["unremoved pole",div(num(1),x())],
  ["zero denominator",div(num(1),num(0))],
  ["higher-order zero denominator",div(pow(x(),2),pow(x(),2))],
  ["square root at the wrong origin",root(num(2))],
  ["negative square-root origin",root(num(-1))],
  ["exponent exceeds budget",pow(sum(num(1),x()),17)],
  ["unknown analytic operation",{kind:"function",name:"exp",argument:x()}],
  ["zero cannot hide unsupported operation",mul(num(0),div(num(1),x()))],
  ["zeroth power cannot hide unsupported operation",pow(div(num(1),x()),0)],
  ["unbound factor",sym("lorentzFactor")],
  ["dimensional expression",sym("frameSpeed")],
]) test(`refuse ${label}`,()=>{assert.throws(()=>jet(expression));});

test("malformed source getters are refused without evaluation",()=>{
  const source=request(gamma()); let accessed=false;
  Object.defineProperty(source.expression,"kind",{enumerable:true,get(){accessed=true;return "quotient";}});
  assert.throws(()=>exactSeriesAtZero(source));assert.equal(accessed,false);
});
test("cycles and oversized trees do not reach arithmetic",()=>{
  const cycle={kind:"negate",opId:`${equationId}.op.cycle`};cycle.argument=cycle;
  assert.throws(()=>exactSeriesAtZero({...request(gamma()),expression:cycle}));
  let deep=num(1);for(let i=0;i<30;i++)deep={kind:"group",argument:deep};
  assert.throws(()=>jet(deep));
});
test("coefficient budgets reject explosive exact arithmetic rather than rounding",()=>{
  assert.throws(()=>jet(pow(num("1e128"),16)),/budget/);
});
test("order zero still validates all operands and returns the origin value",()=>{
  assert.deepEqual(jet(gamma(),0),["1"]);
  assert.throws(()=>jet(mul(num(0),sym("lorentzFactor")),0));
});

test("the expansion variable itself must be dimensionless, even if the expression is a constant",()=>{
  assert.throws(()=>exactSeriesAtZero({...request(num(1)),variable:{numerator:"frameSpeed",denominator:"emittedEnergyRestFrame"}}),/dimensionless/);
});
test("variable accessors are refused without execution",()=>{
  let accessed=false;const variable={denominator:"speedOfLight"};
  Object.defineProperty(variable,"numerator",{enumerable:true,get(){accessed=true;return "frameSpeed";}});
  assert.throws(()=>exactSeriesAtZero({...request(gamma()),variable}));assert.equal(accessed,false);
});
