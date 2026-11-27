import type { Expression } from "../ast.ts";
import { type EquationRecord, parseEquationRecord } from "../record.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";

const symbol = (quantityId: string): Expression => ({
  kind: "symbol",
  quantityId,
  termId: quantityId,
});
const number = (value: string): Expression => ({ kind: "number", value });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const minus = (argument: Expression): Expression => ({ kind: "negate", argument });

function requireIdentity(expected: Expression, actual: Expression, step: string) {
  if (checkRationalSimplification(expected, actual).outcome !== "equal")
    throw new Error(`The pulse-energy calculation does not establish ${step}.`);
}

/** A single pulse transforms according to the law imported from relativity §8.
 * Check each authored summand before checking the sum: two wrong terms could
 * cancel and still give the right total. The angle stays symbolic throughout.
 */
export function checkMassEnergyPulses(
  equations: readonly EquationRecord[],
  conclusion: "pulse-sum" | "balances",
) {
  function relation(name: string, argument: string) {
    const id = `eq-model-me-${name}`;
    const matches = equations.filter((record) => record.id === id);
    if (matches.length !== 1) throw new Error(`Expected one pulse-energy equation ${id}.`);
    const record = parseEquationRecord(matches[0], id);
    const tree = projectDerivationSymbols(record.tree, (term) => term.quantityId);
    if (
      record.paper !== "mass-energy" ||
      record.argument !== argument ||
      record.notation !== "modern-pedagogical" ||
      record.unitSystem !== "si" ||
      tree.kind !== "relation" ||
      tree.operator !== "="
    )
      throw new Error(`Expected the exact mass-energy teaching equation ${id}.`);
    return tree;
  }

  const energy = symbol("emittedEnergyRestFrame");
  const gamma = symbol("lorentzFactor");
  const cosine: Expression = { kind: "function", name: "cos", argument: symbol("emissionAngle") };
  const direction = product(symbol("speedRatio"), cosine);
  const transformed = (restEnergy: Expression, projection: Expression) =>
    product(restEnergy, gamma, sum(number("1"), minus(projection)));

  const single = relation("light-energy-transform", "arg-me-import");
  requireIdentity(symbol("lightComplexEnergyMoving"), single.left, "the moving pulse energy");
  requireIdentity(
    transformed(symbol("lightComplexEnergyStationary"), direction),
    single.right,
    "the imported one-pulse law",
  );

  const pair = relation("symmetric-sum", "arg-me-symmetric-emission");
  if (pair.left.kind !== "sum" || pair.left.args.length !== 2)
    throw new Error("Expected separate energies for the two emitted pulses.");
  const half: Expression = { kind: "quotient", numerator: energy, denominator: number("2") };
  requireIdentity(transformed(half, direction), pair.left.args[0]!, "the forward pulse");
  requireIdentity(transformed(half, minus(direction)), pair.left.args[1]!, "the opposite pulse");
  requireIdentity(product(gamma, energy), pair.right, "the angle-independent total");
  requireIdentity(pair.left, pair.right, "cancellation of the direction terms");

  if (conclusion === "pulse-sum") return;

  // Conservation in each frame identifies the body's loss with the two pulses' sum.
  const rest = relation("rest-ledger", "arg-me-two-ledgers");
  const moving = relation("moving-ledger", "arg-me-two-ledgers");
  requireIdentity(
    sum(symbol("bodyEnergyRestBefore"), minus(symbol("bodyEnergyRestAfter"))),
    rest.left,
    "the rest-frame loss",
  );
  requireIdentity(sum(half, half), rest.right, "the rest-frame light energy");
  requireIdentity(
    sum(symbol("bodyEnergyMovingBefore"), minus(symbol("bodyEnergyMovingAfter"))),
    moving.left,
    "the moving-frame loss",
  );
  requireIdentity(pair.right, moving.right, "the moving-frame light energy");
}
