import {
  add,
  divide,
  multiply,
  type Rational,
  rational,
} from "../../content/dimensions/rational.ts";
import { type Expression, record } from "../ast.ts";

/** A deliberately bounded polynomial ring, not a general symbolic evaluator.
 * Keys are sorted arrays of canonical quantity identities, never display glyphs
 * or occurrence ids. Numeric literals and all coefficients remain exact.
 */
export type Polynomial = ReadonlyMap<string, Rational>;
const ONE = "[]";
const MAX_TERMS = 256;
const MAX_FACTORS = 32;
const MAX_WORK = 32768;
const MAX_BITS = 4096;

export class PolynomialRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolynomialRefusal";
  }
}
function refuse(message: string): never {
  throw new PolynomialRefusal(message);
}
function bounded(value: Rational): Rational {
  if (value.num.toString(2).length > MAX_BITS || value.den.toString(2).length > MAX_BITS)
    refuse("Exact coefficient exceeds the arithmetic budget.");
  return value;
}
function put(result: Map<string, Rational>, key: string, value: Rational): void {
  const next = bounded(add(result.get(key) ?? rational(0n), value));
  if (next.num === 0n) result.delete(key);
  else result.set(key, next);
  if (result.size > MAX_TERMS) refuse("Polynomial exceeds the monomial budget.");
}
function literal(text: unknown): Rational {
  if (typeof text !== "string" || text.length > 128) refuse("Invalid exact decimal literal.");
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!match) refuse("Expected a finite decimal literal, not an expression.");
  const exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 128)
    refuse("Decimal exponent exceeds the arithmetic budget.");
  const numerator = BigInt(`${match[1]}${match[2]}${match[3] ?? ""}`);
  return exponent >= 0
    ? rational(numerator * 10n ** BigInt(exponent))
    : rational(numerator, 10n ** BigInt(-exponent));
}
function scalar(value: Rational): Map<string, Rational> {
  return value.num === 0n ? new Map() : new Map([[ONE, bounded(value)]]);
}
export function sumPolynomials(
  terms: readonly Readonly<{ polynomial: Polynomial; coefficient: Rational }>[],
): Polynomial {
  if (terms.length > 64) refuse("Too many terms in the linear combination.");
  const result = new Map<string, Rational>();
  for (const term of terms) {
    if (term.polynomial.size > MAX_TERMS) refuse("Polynomial exceeds the monomial budget.");
    for (const [key, value] of term.polynomial)
      put(result, key, bounded(multiply(value, term.coefficient)));
  }
  return result;
}
export function equalPolynomials(left: Polynomial, right: Polynomial): boolean {
  return (
    left.size === right.size &&
    [...left].every(([key, a]) => {
      const b = right.get(key);
      return b !== undefined && a.num === b.num && a.den === b.den;
    })
  );
}

export function exactPolynomial(expression: Expression): Polynomial {
  let nodes = 0,
    work = 0;
  function product(a: Polynomial, b: Polynomial): Polynomial {
    const result = new Map<string, Rational>();
    for (const [ka, va] of a)
      for (const [kb, vb] of b) {
        if (++work > MAX_WORK) refuse("Polynomial expansion exceeds the work budget.");
        const factors = [...(JSON.parse(ka) as string[]), ...(JSON.parse(kb) as string[])].sort();
        if (factors.length > MAX_FACTORS) refuse("Polynomial degree exceeds the budget.");
        put(result, JSON.stringify(factors), bounded(multiply(va, vb)));
      }
    return result;
  }
  function visit(raw: Expression, depth: number): Polynomial {
    if (++nodes > 256 || depth > 24) refuse("Expression exceeds the structural budget.");
    const kind =
      raw && typeof raw === "object" ? Object.getOwnPropertyDescriptor(raw, "kind")?.value : null;
    switch (kind) {
      case "number": {
        const value = record(raw, "polynomial.number", ["kind", "value"]);
        return scalar(literal(value.value));
      }
      case "symbol": {
        const value = record(raw, "polynomial.symbol", ["kind", "termId", "quantityId"], ["scale"]);
        if (
          typeof value.quantityId !== "string" ||
          !/^[a-z][A-Za-z0-9-]{0,99}$/.test(value.quantityId)
        )
          refuse("Symbol must have a canonical quantity identity.");
        let scale = rational(1n);
        if (value.scale !== undefined) {
          const s = record(value.scale, "polynomial.scale", ["num", "den"]);
          if (!Number.isSafeInteger(s.num) || !Number.isSafeInteger(s.den) || Number(s.den) <= 0)
            refuse("Symbol scale must be a bounded exact rational.");
          scale = rational(BigInt(s.num as number), BigInt(s.den as number));
        }
        return scale.num === 0n
          ? new Map()
          : new Map([[JSON.stringify([value.quantityId]), scale]]);
      }
      case "group":
      case "negate": {
        const value = record(raw, "polynomial.unary", ["kind", "argument"], ["opId"]);
        return sumPolynomials([
          {
            polynomial: visit(value.argument as Expression, depth + 1),
            coefficient: rational(kind === "negate" ? -1n : 1n),
          },
        ]);
      }
      case "sum":
      case "product": {
        const value = record(raw, "polynomial.aggregate", ["kind", "args"], ["opId"]);
        if (!Array.isArray(value.args) || value.args.length === 0 || value.args.length > 32)
          refuse("Expected a bounded, nonempty list of operands.");
        // Visit every operand, including factors of zero: unsupported domains
        // cannot disappear just because a surrounding product happens to vanish.
        const operands = value.args.map((a) => visit(a as Expression, depth + 1));
        if (kind === "sum")
          return sumPolynomials(
            operands.map((polynomial) => ({ polynomial, coefficient: rational(1n) })),
          );
        return operands.reduce(product, scalar(rational(1n)));
      }
      case "power": {
        const value = record(raw, "polynomial.power", ["kind", "base", "exponent"], ["opId"]);
        const power = record(value.exponent, "polynomial.exponent", ["num", "den"]);
        if (
          power.den !== 1 ||
          !Number.isSafeInteger(power.num) ||
          Number(power.num) < 0 ||
          Number(power.num) > 16
        )
          refuse("Only bounded, nonnegative integer powers are supported.");
        const base = visit(value.base as Expression, depth + 1);
        let result: Polynomial = scalar(rational(1n));
        for (let n = 0; n < Number(power.num); n++) result = product(result, base);
        return result;
      }
      case "quotient": {
        const value = record(
          raw,
          "polynomial.quotient",
          ["kind", "numerator", "denominator"],
          ["opId"],
        );
        const numerator = visit(value.numerator as Expression, depth + 1);
        const denominator = visit(value.denominator as Expression, depth + 1);
        const constant = denominator.get(ONE);
        if (denominator.size !== 1 || !constant || constant.num === 0n)
          refuse("Only a nonzero rational denominator is supported; no variable is cancelled.");
        return sumPolynomials([
          { polynomial: numerator, coefficient: divide(rational(1n), constant) },
        ]);
      }
      default:
        return refuse("This operation is outside exact polynomial algebra; no proof was inferred.");
    }
  }
  return visit(expression, 0);
}
/** A relation is represented by left minus right, retaining its direction.
 * Equality and definition can be premises; approximations cannot become exact.
 */
export function equalityResidual(tree: Expression): Polynomial {
  record(tree, "polynomial.relation", ["kind", "left", "right", "operator"], ["opId"]);
  if (tree.kind !== "relation" || !["=", "define"].includes(tree.operator))
    refuse("An exact equality or explicit definition is required.");
  return sumPolynomials([
    { polynomial: exactPolynomial(tree.left), coefficient: rational(1n) },
    { polynomial: exactPolynomial(tree.right), coefficient: rational(-1n) },
  ]);
}
