import { ContentError } from "../content/compiler/json.ts";
import { rational } from "../content/dimensions/rational.ts";
import type { QuantityRegistry } from "./quantities.ts";
export type ExactScale = Readonly<{ num: number; den: number }>;
type Op = Readonly<{ opId?: string }>;
export type Expression =
  | Readonly<{
      kind: "symbol";
      termId: string;
      quantityId: string;
      scale?: ExactScale;
      /**
       * A component (x, y, z) or an instance label (0, 1) of the same quantity, printed as a
       * subscript: E_y, t_0. It does not change the quantity, its dimension or its colour.
       */
      index?: string;
      /** The quantity's value at an argument, printed glyph(argument): gamma(u), u(t). */
      at?: Expression;
      /**
       * The quantity's value at two to four arguments, printed glyph(a, b): paper 2's density
       * p(x, t) and p(x - Delta, t). An alternative to `at`, never both. The value has the
       * quantity's own dimension; each argument is still checked.
       */
      args?: readonly Expression[];
    }>
  /** "infinity" is admitted only as an integral's limit or the value a limit approaches, or its
      negation: the density integrals of paper 2, section 4 run from minus to plus infinity. It is
      never a value in arithmetic. */
  | Readonly<{ kind: "constant"; name: "pi" | "infinity" }>
  | Readonly<{ kind: "number"; value: string }>
  | (Op & Readonly<{ kind: "sum" | "product"; args: readonly Expression[] }>)
  | (Op & Readonly<{ kind: "quotient"; numerator: Expression; denominator: Expression }>)
  | (Op & Readonly<{ kind: "power"; base: Expression; exponent: ExactScale }>)
  /** A power whose exponent is a quantity, not a number: W = f^n, a probability raised to a
      count (paper 1, section 5). Both sides must be dimensionless. */
  | (Op & Readonly<{ kind: "symbolPower"; base: Expression; exponent: Expression }>)
  | (Op & Readonly<{ kind: "root"; radicand: Expression; degree: number }>)
  | (Op & Readonly<{ kind: "negate" | "average" | "group"; argument: Expression }>)
  | (Op & Readonly<{ kind: "function"; name: "exp" | "ln" | "sin" | "cos"; argument: Expression }>)
  | (Op &
      Readonly<{
        kind: "relation";
        /** "le" and "ge" state a bound: an energy budget, a threshold, a count at most. */
        operator: "=" | "approx" | "define" | "le" | "ge";
        left: Expression;
        right: Expression;
      }>)
  | (Op &
      Readonly<{
        kind: "derivative";
        expression: Expression;
        variable: Expression;
        order: number;
        partial: boolean;
        /** The quantities held fixed while the variable changes, printed as a subscript on the
            bracketed partial derivative: (ds/drho)_nu, paper 1, section 3. Partial only. */
        heldFixed?: readonly Expression[];
      }>)
  | (Op &
      Readonly<{
        kind: "integral";
        expression: Expression;
        variable: Expression;
        /** Both or neither: a definite integral from lower to upper. */
        lower?: Expression;
        upper?: Expression;
      }>)
  /** The limit of an expression as a variable approaches a value: paper 4's low-speed limit,
      lim_{v -> 0} 2L(gamma - 1)/v^2 = L/c^2. The value approached is a value of the variable, so
      it carries the variable's dimension; zero and plus or minus infinity are admitted as they are
      for an integral's limits. The limit has the dimension of the expression. */
  | (Op &
      Readonly<{
        kind: "limit";
        variable: Expression;
        approaches: Expression;
        expression: Expression;
      }>)
  /** A sum over an index, the sum for i from `from` to `to` of `expression`: the mean of M values,
      (1/M) times the sum of x_i, and the sum of n steps in paper 2, section 4. The index is one
      letter that the body's symbols carry as their `index`; the bounds are counts, so they are
      dimensionless; the sum has the body's dimension. */
  | (Op &
      Readonly<{
        kind: "indexedSum";
        index: string;
        from: Expression;
        to: Expression;
        expression: Expression;
      }>)
  /** The operator "partial derivative with respect to variable", standing alone: an identity
      between operators (paper 3, section 6) relates these, not quantities. */
  | (Op & Readonly<{ kind: "partialOperator"; variable: Expression }>);
export function children(n: Expression): readonly Expression[] {
  switch (n.kind) {
    case "symbol":
      return n.at ? [n.at] : (n.args ?? []);
    case "number":
    case "constant":
      return [];
    case "sum":
    case "product":
      return n.args;
    case "quotient":
      return [n.numerator, n.denominator];
    case "power":
      return [n.base];
    case "symbolPower":
      return [n.base, n.exponent];
    case "root":
      return [n.radicand];
    case "negate":
    case "average":
    case "group":
    case "function":
      return [n.argument];
    case "relation":
      return [n.left, n.right];
    case "derivative":
      return [n.expression, n.variable, ...(n.heldFixed ?? [])];
    case "integral":
      return [
        n.expression,
        n.variable,
        ...(n.lower ? [n.lower] : []),
        ...(n.upper ? [n.upper] : []),
      ];
    case "limit":
      return [n.expression, n.variable, n.approaches];
    case "indexedSum":
      return [n.expression, n.from, n.to];
    case "partialOperator":
      return [n.variable];
  }
}
export const nodeId = (n: Expression): string | null =>
  n.kind === "symbol" ? n.termId : "opId" in n ? (n.opId ?? null) : null;
export function walk(root: Expression): readonly Expression[] {
  return [root, ...children(root).flatMap(walk)];
}
function fail(path: string, message: string): never {
  throw new ContentError("equation-invalid", path, message);
}
export function record(
  x: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(x))
  )
    return fail(path, "Expected a plain record.");
  const descriptors = Object.getOwnPropertyDescriptors(x);
  for (const key of Reflect.ownKeys(x)) {
    if (typeof key !== "string" || ![...required, ...optional].includes(key)) {
      fail(path, "Unexpected field or accessor.");
    }
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(path, "Unexpected field or accessor.");
    }
  }
  for (const key of required)
    if (!Object.hasOwn(descriptors, key)) fail(path, `Missing field ${key}.`);
  return x as Record<string, unknown>;
}
export function exactScale(input: unknown, path: string, nonzero = false): ExactScale {
  const o = record(input, path, ["num", "den"]);
  if (
    !Number.isSafeInteger(o.num) ||
    !Number.isSafeInteger(o.den) ||
    Number(o.den) <= 0 ||
    (nonzero && o.num === 0)
  )
    return fail(path, "Expected an exact rational with positive denominator.");
  const reduced = rational(BigInt(o.num as number), BigInt(o.den as number));
  if (reduced.num !== BigInt(o.num as number) || reduced.den !== BigInt(o.den as number))
    return fail(path, "Write the scale in lowest terms.");
  return { num: o.num as number, den: o.den as number };
}
export function parseExpression(
  input: unknown,
  equationId: string,
  registry: QuantityRegistry,
): Expression {
  if (!/^(?:eq-(?:s\d+-)?(?:d)?\d+|eq-model-[a-z0-9-]+)$/.test(equationId))
    fail(equationId, "Invalid equation identity.");
  const ids = new Set<string>();
  let count = 0;
  function identity(value: unknown, kind: "t" | "op", path: string) {
    if (
      typeof value !== "string" ||
      !value.startsWith(`${equationId}.${kind}.`) ||
      !/^[a-z][A-Za-z0-9]{0,47}$/.test(value.slice(equationId.length + kind.length + 2))
    )
      fail(path, "Selectable identities must be authored and equation-qualified.");
    if (ids.has(value)) fail(path, `Duplicate selectable identity: ${value}.`);
    ids.add(value);
  }
  function parse(x: unknown, path: string, depth: number, limit = false): Expression {
    if (++count > 256 || depth > 24) fail(path, "Expression budget exceeded.");
    const kind =
      x && typeof x === "object" ? Object.getOwnPropertyDescriptor(x, "kind")?.value : null;
    const fields: Record<string, readonly string[]> = {
      symbol: ["termId", "quantityId"],
      constant: ["name"],
      number: ["value"],
      sum: ["args"],
      product: ["args"],
      quotient: ["numerator", "denominator"],
      power: ["base", "exponent"],
      symbolPower: ["base", "exponent"],
      root: ["radicand", "degree"],
      negate: ["argument"],
      average: ["argument"],
      group: ["argument"],
      function: ["name", "argument"],
      relation: ["operator", "left", "right"],
      derivative: ["expression", "variable", "order", "partial"],
      integral: ["expression", "variable"],
      limit: ["variable", "approaches", "expression"],
      indexedSum: ["index", "from", "to", "expression"],
      partialOperator: ["variable"],
    };
    if (typeof kind !== "string" || !Object.hasOwn(fields, kind))
      fail(path, "Unsupported expression kind.");
    const kindFields = fields[kind];
    if (!kindFields) fail(path, "Unsupported expression kind.");
    const o = record(
      x,
      path,
      ["kind", ...kindFields],
      kind === "symbol"
        ? ["scale", "index", "at", "args"]
        : kind === "integral"
          ? ["opId", "lower", "upper"]
          : kind === "derivative"
            ? ["opId", "heldFixed"]
            : ["number", "constant"].includes(kind)
              ? []
              : ["opId"],
    );
    if (kind === "symbol") {
      identity(o.termId, "t", path);
      if (typeof o.quantityId !== "string" || !Object.hasOwn(registry, o.quantityId))
        fail(path, "Bind to an exact registered quantity id, not a glyph or label.");
      if (Object.hasOwn(o, "scale")) exactScale(o.scale, path, true);
      // A label printed as a subscript, never TeX: one or two lower-case letters or digits.
      if (Object.hasOwn(o, "index") && !/^[a-z0-9]{1,2}$/.test(String(o.index)))
        fail(path, "An index is a component or instance label of one or two letters or digits.");
      if (Object.hasOwn(o, "at")) parse(o.at, `${path}.at`, depth + 1);
      if (Object.hasOwn(o, "args")) {
        if (Object.hasOwn(o, "at"))
          fail(path, "A value is taken at one argument (at) or at several (args), not both.");
        if (!Array.isArray(o.args) || o.args.length < 2 || o.args.length > 4)
          fail(path, "Take a value at two to four arguments; use `at` for one.");
        o.args.forEach((v, i) => {
          parse(v, `${path}.args[${i}]`, depth + 1);
        });
      }
    } else if (kind === "constant") {
      if (o.name === "infinity") {
        if (!limit)
          fail(
            path,
            "Infinity is admitted only as an integral's limit or the value a limit approaches.",
          );
      } else if (o.name !== "pi") fail(path, "Unsupported mathematical constant.");
    } else if (kind === "number") {
      if (
        typeof o.value !== "string" ||
        o.value.length > 80 ||
        !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/.test(o.value) ||
        !Number.isFinite(Number(o.value))
      )
        fail(path, "Expected an exact decimal literal, not executable TeX.");
    } else {
      if (Object.hasOwn(o, "opId")) identity(o.opId, "op", path);
      if (kind === "sum" || kind === "product") {
        if (!Array.isArray(o.args) || o.args.length < 2 || o.args.length > 32)
          fail(path, "Expected 2–32 operands.");
        o.args.forEach((v, i) => {
          parse(v, `${path}.args[${i}]`, depth + 1);
        });
      } else {
        for (const key of kindFields)
          if (
            !["degree", "name", "operator", "order", "partial"].includes(key) &&
            !(key === "exponent" && kind === "power") &&
            !(key === "approaches" && kind === "limit") &&
            !(key === "index" && kind === "indexedSum")
          )
            // A negated limit is still a limit: minus infinity is -(infinity).
            parse(o[key], `${path}.${key}`, depth + 1, limit && kind === "negate");
      }
      if (kind === "power") exactScale(o.exponent, path);
      if (kind === "symbolPower" && (o.exponent as Expression).kind !== "symbol")
        fail(path, "A symbolic exponent is one bound symbol; write a number as a power.");
      if (
        kind === "root" &&
        (!Number.isSafeInteger(o.degree) || Number(o.degree) < 2 || Number(o.degree) > 32)
      )
        fail(path, "Root degree must be 2–32.");
      if (kind === "function" && !["exp", "ln", "sin", "cos"].includes(String(o.name)))
        fail(path, "Unsupported function.");
      if (
        kind === "relation" &&
        !["=", "approx", "define", "le", "ge"].includes(String(o.operator))
      )
        fail(path, "Unsupported relation.");
      if (
        kind === "derivative" &&
        (!Number.isSafeInteger(o.order) ||
          Number(o.order) < 1 ||
          Number(o.order) > 4 ||
          typeof o.partial !== "boolean")
      )
        fail(path, "Unsupported derivative order.");
      if (
        (kind === "derivative" ||
          kind === "integral" ||
          kind === "limit" ||
          kind === "partialOperator") &&
        (o.variable as Expression).kind !== "symbol"
      )
        fail(path, "The variable must be a bound symbol.");
      if (kind === "derivative" && Object.hasOwn(o, "heldFixed")) {
        const held = o.heldFixed;
        if (o.partial !== true) fail(path, "Only a partial derivative holds quantities fixed.");
        if (!Array.isArray(held) || held.length < 1 || held.length > 3)
          fail(path, "Hold one to three quantities fixed.");
        const variable = (o.variable as Extract<Expression, { kind: "symbol" }>).quantityId;
        held.forEach((h, i) => {
          parse(h, `${path}.heldFixed[${i}]`, depth + 1);
          if ((h as Expression).kind !== "symbol")
            fail(path, "A held-fixed quantity is a bound symbol.");
          if ((h as Extract<Expression, { kind: "symbol" }>).quantityId === variable)
            fail(path, "The variable that changes cannot also be held fixed.");
        });
      }
      if (kind === "limit") {
        // Parsed as a limit value, so plus or minus infinity is admitted here and nowhere else.
        parse(o.approaches, `${path}.approaches`, depth + 1, true);
        const variable = (o.variable as Extract<Expression, { kind: "symbol" }>).quantityId;
        if (
          walk(o.approaches as Expression).some(
            (a) => a.kind === "symbol" && a.quantityId === variable,
          )
        )
          fail(
            path,
            "The value a limit approaches cannot contain the variable that approaches it.",
          );
      }
      if (kind === "indexedSum") {
        if (typeof o.index !== "string" || !/^[a-z]$/.test(o.index))
          fail(path, "An indexed sum's index is one lower-case letter.");
        const index = o.index;
        if (!walk(o.expression as Expression).some((s) => s.kind === "symbol" && s.index === index))
          fail(path, "The body of an indexed sum must use its index.");
      }
      if (kind === "integral") {
        if (Object.hasOwn(o, "lower") !== Object.hasOwn(o, "upper"))
          fail(path, "A definite integral states both limits.");
        if (Object.hasOwn(o, "lower")) {
          parse(o.lower, `${path}.lower`, depth + 1, true);
          parse(o.upper, `${path}.upper`, depth + 1, true);
        }
      }
    }
    return x as Expression;
  }
  parse(input, equationId, 0);
  function freeze<T>(x: T): T {
    if (x && typeof x === "object") {
      Object.values(x).forEach(freeze);
      Object.freeze(x);
    }
    return x;
  }
  return freeze(structuredClone(input) as Expression);
}
export const findNode = (root: Expression, id: string): Expression | undefined =>
  walk(root).find((n) => nodeId(n) === id);
export const quantityBindings = (root: Expression) =>
  walk(root)
    .filter((n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol")
    .map((n) => ({
      termId: n.termId,
      quantityId: n.quantityId,
      scale: n.scale ?? { num: 1, den: 1 },
    }));
/** Canonical serialization carries authored identities and exact scales; object key order is irrelevant. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}
export function substitute(
  root: Expression,
  id: string,
  replacement: Expression,
  equationId: string,
  registry: QuantityRegistry,
): Expression {
  if (!findNode(root, id))
    throw new RangeError("The substitution target is not in this expression.");
  function visit(n: unknown): unknown {
    if (!n || typeof n !== "object") return n;
    if (Array.isArray(n)) return n.map(visit);
    if (nodeId(n as Expression) === id) return replacement;
    return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, visit(v)]));
  }
  return parseExpression(visit(root), equationId, registry);
}

export * from "./alternateForms.ts";
export * from "./monomial.ts";
