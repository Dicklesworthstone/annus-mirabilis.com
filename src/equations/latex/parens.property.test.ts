/**
 * Property-based parenthesization and operator precedence tests for LaTeX generation
 * (am-eq-latex-generation-hc3).
 *
 * Implements requirement:
 * "parens.property.test.ts: 500 random trees from fixed seeds, logged as decimal strings.
 *  Rendering and then parsing the structure back with a test parser preserves operator
 *  precedence. A failing tree is logged and never rerun until it passes."
 *
 * Enforces:
 * - Minimal correct parentheses from operator precedence (Requirement 123-128).
 * - Preservation of operator precedence without precedence inversion.
 * - Test parser parsing rendered LaTeX according to standard mathematical precedence.
 * - Structured JSONL logging through src/testing/log/logger.ts with seed and failure retention.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import type { Expression } from "../ast.ts";
import { printAuthoring } from "../tree/printAuthoring.ts";
import { renderLatex } from "./render.ts";

/**
 * 64-bit deterministic SplitMix PRNG.
 */
class SplitMix64 {
  private state: bigint;

  constructor(seed: string) {
    this.state = BigInt(seed);
  }

  nextU64(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Number(this.nextU64() % BigInt(max));
  }
}

const SYMBOLS: Record<string, Expression> = {
  x: { kind: "symbol", termId: "x", quantityId: "x" },
  y: { kind: "symbol", termId: "y", quantityId: "y" },
  z: { kind: "symbol", termId: "z", quantityId: "z" },
  t: { kind: "symbol", termId: "t", quantityId: "t" },
  v: { kind: "symbol", termId: "v", quantityId: "v" },
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

/**
 * Generates a random expression tree exploring mathematical operations and precedence boundaries.
 */
function generateRandomTree(rng: SplitMix64, depth = 0, maxDepth = 4): Expression {
  if (depth >= maxDepth) {
    const termKind = rng.nextInt(3);
    if (termKind === 0) {
      const symKey = SYMBOL_KEYS[rng.nextInt(SYMBOL_KEYS.length)]!;
      return SYMBOLS[symKey]!;
    }
    if (termKind === 1) {
      return { kind: "constant", name: "pi" };
    }
    const num = rng.nextInt(50) + 1;
    return { kind: "number", value: String(num) };
  }

  // At top-level depth 0, 20% chance to generate an equation relation
  if (depth === 0 && rng.nextInt(5) === 0) {
    return {
      kind: "relation",
      operator: "=",
      left: generateRandomTree(rng, 1, maxDepth),
      right: generateRandomTree(rng, 1, maxDepth),
    };
  }

  const choice = rng.nextInt(14);
  switch (choice) {
    case 0:
    case 1: {
      // Sum with 2 or 3 arguments, optionally containing negated terms
      const count = rng.nextInt(2) + 2;
      const args: Expression[] = [];
      for (let i = 0; i < count; i++) {
        const isNeg = rng.nextInt(3) === 0;
        const sub = generateRandomTree(rng, depth + 1, maxDepth);
        if (isNeg) {
          args.push({ kind: "negate", argument: sub });
        } else {
          args.push(sub);
        }
      }
      return { kind: "sum", args };
    }
    case 2:
    case 3: {
      // Product with 2 or 3 arguments
      const count = rng.nextInt(2) + 2;
      const args: Expression[] = [];
      for (let i = 0; i < count; i++) {
        args.push(generateRandomTree(rng, depth + 1, maxDepth));
      }
      return { kind: "product", args };
    }
    case 4:
    case 5: {
      // Quotient
      return {
        kind: "quotient",
        numerator: generateRandomTree(rng, depth + 1, maxDepth),
        denominator: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 6: {
      // Power with integer exponent on base
      const expVal = rng.nextInt(3) + 2;
      return {
        kind: "power",
        base: generateRandomTree(rng, depth + 1, maxDepth),
        exponent: { num: expVal, den: 1 },
      };
    }
    case 7: {
      // Root (degree 2 or 3)
      const degree = rng.nextInt(2) === 0 ? 2 : 3;
      return {
        kind: "root",
        degree,
        radicand: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 8: {
      // Function (sin, cos, exp, ln)
      const fns = ["sin", "cos", "exp", "ln"] as const;
      const name = fns[rng.nextInt(fns.length)]!;
      return {
        kind: "function",
        name,
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 9: {
      // Average
      return {
        kind: "average",
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 10: {
      // Explicit group
      return {
        kind: "group",
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 11:
    default: {
      // Negate
      return {
        kind: "negate",
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
  }
}

// -----------------------------------------------------------------------------
// Test LaTeX Tokenizer & Precedence Parser
// -----------------------------------------------------------------------------

interface Token {
  readonly type:
    | "LPAREN"
    | "RPAREN"
    | "LANGLE"
    | "RANGLE"
    | "LBRACE"
    | "RBRACE"
    | "LBRACKET"
    | "RBRACKET"
    | "FRAC"
    | "SQRT"
    | "FN"
    | "CONST"
    | "REL_OP"
    | "PLUS"
    | "MINUS"
    | "MUL"
    | "CARET"
    | "NUMBER"
    | "SYMBOL";
  readonly value: string;
  readonly offset: number;
}

function tokenizeTestLatex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "\\") {
      const start = i;
      if (input.startsWith("\\left(", i)) {
        tokens.push({ type: "LPAREN", value: "\\left(", offset: start });
        i += 6;
        continue;
      }
      if (input.startsWith("\\right)", i)) {
        tokens.push({ type: "RPAREN", value: "\\right)", offset: start });
        i += 7;
        continue;
      }
      if (input.startsWith("\\left\\langle", i)) {
        tokens.push({ type: "LANGLE", value: "\\left\\langle", offset: start });
        i += 12;
        continue;
      }
      if (input.startsWith("\\right\\rangle", i)) {
        tokens.push({ type: "RANGLE", value: "\\right\\rangle", offset: start });
        i += 13;
        continue;
      }
      if (input.startsWith("\\frac", i)) {
        tokens.push({ type: "FRAC", value: "\\frac", offset: start });
        i += 5;
        continue;
      }
      if (input.startsWith("\\sqrt", i)) {
        tokens.push({ type: "SQRT", value: "\\sqrt", offset: start });
        i += 5;
        continue;
      }
      if (input.startsWith("\\sin", i)) {
        tokens.push({ type: "FN", value: "sin", offset: start });
        i += 4;
        continue;
      }
      if (input.startsWith("\\cos", i)) {
        tokens.push({ type: "FN", value: "cos", offset: start });
        i += 4;
        continue;
      }
      if (input.startsWith("\\exp", i)) {
        tokens.push({ type: "FN", value: "exp", offset: start });
        i += 4;
        continue;
      }
      if (input.startsWith("\\ln", i)) {
        tokens.push({ type: "FN", value: "ln", offset: start });
        i += 3;
        continue;
      }
      if (input.startsWith("\\pi", i)) {
        tokens.push({ type: "CONST", value: "pi", offset: start });
        i += 3;
        continue;
      }
      if (input.startsWith("\\,", i)) {
        tokens.push({ type: "MUL", value: "\\,", offset: start });
        i += 2;
        continue;
      }
      if (input.startsWith("\\approx", i)) {
        tokens.push({ type: "REL_OP", value: "approx", offset: start });
        i += 7;
        continue;
      }

      // Generic command word (e.g. \tau, \beta, \gamma)
      i++; // skip backslash
      const wordStart = i;
      while (i < len && /[a-zA-Z]/.test(input[i]!)) {
        i++;
      }
      const word = input.slice(wordStart, i);
      tokens.push({ type: "SYMBOL", value: `\\${word}`, offset: start });
      continue;
    }

    if (ch === "{") {
      tokens.push({ type: "LBRACE", value: "{", offset: i });
      i++;
      continue;
    }
    if (ch === "}") {
      tokens.push({ type: "RBRACE", value: "}", offset: i });
      i++;
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "LBRACKET", value: "[", offset: i });
      i++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "RBRACKET", value: "]", offset: i });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", offset: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", offset: i });
      i++;
      continue;
    }
    if (ch === "^") {
      tokens.push({ type: "CARET", value: "^", offset: i });
      i++;
      continue;
    }
    if (ch === "+") {
      tokens.push({ type: "PLUS", value: "+", offset: i });
      i++;
      continue;
    }
    if (ch === "-") {
      tokens.push({ type: "MINUS", value: "-", offset: i });
      i++;
      continue;
    }
    if (ch === "=") {
      tokens.push({ type: "REL_OP", value: "=", offset: i });
      i++;
      continue;
    }
    if (ch === ":" && input[i + 1] === "=") {
      tokens.push({ type: "REL_OP", value: ":=", offset: i });
      i += 2;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < len && /[0-9.]/.test(input[i]!)) {
        i++;
      }
      tokens.push({ type: "NUMBER", value: input.slice(start, i), offset: start });
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      tokens.push({ type: "SYMBOL", value: ch, offset: i });
      i++;
      continue;
    }

    throw new Error(`Unexpected character in LaTeX at offset ${i}: '${ch}' in "${input}"`);
  }

  return tokens;
}

type ParsedNode =
  | { kind: "symbol"; name: string }
  | { kind: "number"; value: string }
  | { kind: "constant"; name: string }
  | { kind: "sum"; args: ParsedNode[] }
  | { kind: "product"; args: ParsedNode[] }
  | { kind: "quotient"; numerator: ParsedNode; denominator: ParsedNode }
  | { kind: "power"; base: ParsedNode; exponent: ParsedNode }
  | { kind: "root"; radicand: ParsedNode; degree: number }
  | { kind: "negate"; argument: ParsedNode }
  | { kind: "group"; argument: ParsedNode }
  | { kind: "average"; argument: ParsedNode }
  | { kind: "function"; name: string; argument: ParsedNode }
  | { kind: "relation"; operator: string; left: ParsedNode; right: ParsedNode };

class TestPrecedenceParser {
  private pos = 0;
  constructor(private readonly tokens: readonly Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  consume(expectedType?: Token["type"]): Token {
    const tok = this.tokens[this.pos];
    if (!tok) {
      throw new Error(`Unexpected end of tokens, expected ${expectedType ?? "token"}`);
    }
    if (expectedType && tok.type !== expectedType) {
      throw new Error(
        `Expected ${expectedType} at offset ${tok.offset}, got ${tok.type} (${tok.value})`,
      );
    }
    this.pos++;
    return tok;
  }

  isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  parse(): ParsedNode {
    const node = this.parseRelation();
    if (!this.isAtEnd()) {
      const leftover = this.tokens[this.pos]!;
      throw new Error(
        `Unparsed trailing tokens at offset ${leftover.offset}: ${leftover.type} (${leftover.value})`,
      );
    }
    return node;
  }

  parseRelation(): ParsedNode {
    const left = this.parseAdditive();
    if (this.peek()?.type === "REL_OP") {
      const opTok = this.consume("REL_OP");
      const right = this.parseRelation();
      return { kind: "relation", operator: opTok.value, left, right };
    }
    return left;
  }

  parseAdditive(): ParsedNode {
    const first = this.parseMultiplicative();
    const terms: ParsedNode[] = [first];

    while (this.peek()?.type === "PLUS" || this.peek()?.type === "MINUS") {
      const op = this.consume();
      const next = this.parseMultiplicative();
      if (op.type === "MINUS") {
        terms.push({ kind: "negate", argument: next });
      } else {
        terms.push(next);
      }
    }

    if (terms.length === 1) {
      return terms[0]!;
    }
    return { kind: "sum", args: terms };
  }

  parseMultiplicative(): ParsedNode {
    const first = this.parsePrefix();
    const factors: ParsedNode[] = [first];

    while (this.peek()?.type === "MUL") {
      this.consume("MUL");
      factors.push(this.parsePrefix());
    }

    if (factors.length === 1) {
      return factors[0]!;
    }
    return { kind: "product", args: factors };
  }

  parsePrefix(): ParsedNode {
    if (this.peek()?.type === "MINUS") {
      this.consume("MINUS");
      const arg = this.parsePrefix();
      return { kind: "negate", argument: arg };
    }
    return this.parsePower();
  }

  parsePower(): ParsedNode {
    const base = this.parsePrimary();
    if (this.peek()?.type === "CARET") {
      this.consume("CARET");
      this.consume("LBRACE");
      const exponent = this.parseRelation();
      this.consume("RBRACE");
      return { kind: "power", base, exponent };
    }
    return base;
  }

  parsePrimary(): ParsedNode {
    const tok = this.peek();
    if (!tok) {
      throw new Error("Unexpected end of tokens in primary expression");
    }

    if (tok.type === "LPAREN") {
      this.consume("LPAREN");
      const inner = this.parseRelation();
      this.consume("RPAREN");
      return { kind: "group", argument: inner };
    }

    if (tok.type === "LANGLE") {
      this.consume("LANGLE");
      const inner = this.parseRelation();
      this.consume("RANGLE");
      return { kind: "average", argument: inner };
    }

    if (tok.type === "FRAC") {
      this.consume("FRAC");
      this.consume("LBRACE");
      const numerator = this.parseRelation();
      this.consume("RBRACE");
      this.consume("LBRACE");
      const denominator = this.parseRelation();
      this.consume("RBRACE");
      return { kind: "quotient", numerator, denominator };
    }

    if (tok.type === "SQRT") {
      this.consume("SQRT");
      let degree = 2;
      if (this.peek()?.type === "LBRACKET") {
        this.consume("LBRACKET");
        const degTok = this.consume("NUMBER");
        degree = Number(degTok.value);
        this.consume("RBRACKET");
      }
      this.consume("LBRACE");
      const radicand = this.parseRelation();
      this.consume("RBRACE");
      return { kind: "root", degree, radicand };
    }

    if (tok.type === "FN") {
      const fnTok = this.consume("FN");
      this.consume("LPAREN");
      const argument = this.parseRelation();
      this.consume("RPAREN");
      return { kind: "function", name: fnTok.value, argument };
    }

    if (tok.type === "CONST") {
      this.consume("CONST");
      return { kind: "constant", name: "pi" };
    }

    if (tok.type === "NUMBER") {
      this.consume("NUMBER");
      return { kind: "number", value: tok.value };
    }

    if (tok.type === "SYMBOL") {
      this.consume("SYMBOL");
      return { kind: "symbol", name: tok.value };
    }

    throw new Error(`Unexpected token at offset ${tok.offset}: ${tok.type} (${tok.value})`);
  }
}

/**
 * Parses rendered LaTeX into an AST adhering strictly to standard operator precedence.
 */
export function parseTestLatex(latex: string): ParsedNode {
  const tokens = tokenizeTestLatex(latex);
  const parser = new TestPrecedenceParser(tokens);
  return parser.parse();
}

// -----------------------------------------------------------------------------
// Tree Precedence Normalization & Structural Equivalence
// -----------------------------------------------------------------------------

function unwrapGroups(node: any): any {
  if (!node) return node;
  if (node.kind === "group") {
    return unwrapGroups(node.argument);
  }
  return node;
}

/**
 * Normalizes an AST for precedence comparison:
 * 1. Unwraps group nodes (whose semantic purpose in LaTeX was to enforce operator precedence).
 * 2. Flattens adjacent associative sums and products.
 * 3. In original trees, reflects renderLatex's extraction of leading numerator negation:
 *    renderLatex renders quotient(negate(X), Y) as -\frac{X}{Y}.
 */
function normalizeOriginal(node: any): any {
  if (!node) return node;
  const unwrapped = unwrapGroups(node);

  if (unwrapped.kind === "quotient") {
    if (unwrapped.numerator.kind === "negate") {
      return {
        kind: "negate",
        argument: {
          kind: "quotient",
          numerator: normalizeOriginal(unwrapped.numerator.argument),
          denominator: normalizeOriginal(unwrapped.denominator),
        },
      };
    }
    return {
      kind: "quotient",
      numerator: normalizeOriginal(unwrapped.numerator),
      denominator: normalizeOriginal(unwrapped.denominator),
    };
  }

  if (unwrapped.kind === "sum") {
    const flatArgs: any[] = [];
    for (const arg of unwrapped.args) {
      const normArg = normalizeOriginal(arg);
      if (normArg.kind === "sum") {
        flatArgs.push(...normArg.args);
      } else {
        flatArgs.push(normArg);
      }
    }
    return { kind: "sum", args: flatArgs };
  }

  if (unwrapped.kind === "product") {
    const flatArgs: any[] = [];
    for (const arg of unwrapped.args) {
      const normArg = normalizeOriginal(arg);
      if (normArg.kind === "product") {
        flatArgs.push(...normArg.args);
      } else {
        flatArgs.push(normArg);
      }
    }
    return { kind: "product", args: flatArgs };
  }

  if (unwrapped.kind === "power") {
    return {
      kind: "power",
      base: normalizeOriginal(unwrapped.base),
      exponent: normalizeOriginal(unwrapped.exponent),
    };
  }

  if (unwrapped.kind === "root") {
    return {
      kind: "root",
      degree: unwrapped.degree,
      radicand: normalizeOriginal(unwrapped.radicand),
    };
  }

  if (unwrapped.kind === "negate") {
    const normArg = normalizeOriginal(unwrapped.argument);
    if (normArg.kind === "product" && normArg.args.length > 0) {
      return {
        kind: "product",
        args: [{ kind: "negate", argument: normArg.args[0] }, ...normArg.args.slice(1)],
      };
    }
    return {
      kind: "negate",
      argument: normArg,
    };
  }

  if (unwrapped.kind === "function") {
    return {
      kind: "function",
      name: unwrapped.name,
      argument: normalizeOriginal(unwrapped.argument),
    };
  }

  if (unwrapped.kind === "average") {
    return {
      kind: "average",
      argument: normalizeOriginal(unwrapped.argument),
    };
  }

  if (unwrapped.kind === "relation") {
    return {
      kind: "relation",
      operator: unwrapped.operator,
      left: normalizeOriginal(unwrapped.left),
      right: normalizeOriginal(unwrapped.right),
    };
  }

  return unwrapped;
}

function normalizeParsed(node: any): any {
  if (!node) return node;
  const unwrapped = unwrapGroups(node);

  if (unwrapped.kind === "sum") {
    const flatArgs: any[] = [];
    for (const arg of unwrapped.args) {
      const normArg = normalizeParsed(arg);
      if (normArg.kind === "sum") {
        flatArgs.push(...normArg.args);
      } else {
        flatArgs.push(normArg);
      }
    }
    return { kind: "sum", args: flatArgs };
  }

  if (unwrapped.kind === "product") {
    const flatArgs: any[] = [];
    for (const arg of unwrapped.args) {
      const normArg = normalizeParsed(arg);
      if (normArg.kind === "product") {
        flatArgs.push(...normArg.args);
      } else {
        flatArgs.push(normArg);
      }
    }
    return { kind: "product", args: flatArgs };
  }

  if (unwrapped.kind === "quotient") {
    return {
      kind: "quotient",
      numerator: normalizeParsed(unwrapped.numerator),
      denominator: normalizeParsed(unwrapped.denominator),
    };
  }

  if (unwrapped.kind === "power") {
    return {
      kind: "power",
      base: normalizeParsed(unwrapped.base),
      exponent: normalizeParsed(unwrapped.exponent),
    };
  }

  if (unwrapped.kind === "root") {
    return {
      kind: "root",
      degree: unwrapped.degree,
      radicand: normalizeParsed(unwrapped.radicand),
    };
  }

  if (unwrapped.kind === "negate") {
    const normArg = normalizeParsed(unwrapped.argument);
    if (normArg.kind === "product" && normArg.args.length > 0) {
      return {
        kind: "product",
        args: [{ kind: "negate", argument: normArg.args[0] }, ...normArg.args.slice(1)],
      };
    }
    return {
      kind: "negate",
      argument: normArg,
    };
  }

  if (unwrapped.kind === "function") {
    return {
      kind: "function",
      name: unwrapped.name,
      argument: normalizeParsed(unwrapped.argument),
    };
  }

  if (unwrapped.kind === "average") {
    return {
      kind: "average",
      argument: normalizeParsed(unwrapped.argument),
    };
  }

  if (unwrapped.kind === "relation") {
    return {
      kind: "relation",
      operator: unwrapped.operator,
      left: normalizeParsed(unwrapped.left),
      right: normalizeParsed(unwrapped.right),
    };
  }

  return unwrapped;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "symbol": {
      const aName = a.termId ?? a.quantityId ?? a.name;
      const bName = b.termId ?? b.quantityId ?? b.name;
      return aName === bName;
    }
    case "number":
      return String(a.value) === String(b.value);
    case "constant":
      return a.name === b.name;
    case "sum":
    case "product": {
      if (a.args.length !== b.args.length) return false;
      return a.args.every((arg: any, i: number) => deepEqual(arg, b.args[i]));
    }
    case "quotient":
      return deepEqual(a.numerator, b.numerator) && deepEqual(a.denominator, b.denominator);
    case "power": {
      if (!deepEqual(a.base, b.base)) return false;
      const aExpVal =
        typeof a.exponent === "object" && "num" in a.exponent
          ? a.exponent.num / a.exponent.den
          : Number(a.exponent.value ?? a.exponent);
      const bExpVal =
        typeof b.exponent === "object" && "num" in b.exponent
          ? b.exponent.num / b.exponent.den
          : Number(b.exponent.value ?? b.exponent);
      return aExpVal === bExpVal;
    }
    case "root":
      return a.degree === b.degree && deepEqual(a.radicand, b.radicand);
    case "negate":
    case "average":
      return deepEqual(a.argument, b.argument);
    case "function":
      return a.name === b.name && deepEqual(a.argument, b.argument);
    case "relation":
      return a.operator === b.operator && deepEqual(a.left, b.left) && deepEqual(a.right, b.right);
    default:
      return false;
  }
}

/**
 * Asserts structural equivalence under mathematical operator precedence.
 */
export function structuralPrecedenceEqual(original: Expression, parsed: ParsedNode): boolean {
  const normOriginal = normalizeOriginal(original);
  const normParsed = normalizeParsed(parsed);
  return deepEqual(normOriginal, normParsed);
}

// -----------------------------------------------------------------------------
// Test Suite: Precedence, Minimal Parens, and Property Trees
// -----------------------------------------------------------------------------

test("parens.property.test: minimal correct parentheses from precedence", () => {
  const symA: Expression = { kind: "symbol", termId: "x", quantityId: "x" };
  const symB: Expression = { kind: "symbol", termId: "y", quantityId: "y" };
  const symC: Expression = { kind: "symbol", termId: "z", quantityId: "z" };

  // 1. Addition of product: a + b * c does NOT need parentheses
  const addProd: Expression = {
    kind: "sum",
    args: [symA, { kind: "product", args: [symB, symC] }],
  };
  const renderedAddProd = renderLatex(addProd, { mode: "plain" });
  assert.equal(renderedAddProd, "x + y\\,z");
  assert.equal(renderedAddProd.includes("\\left("), false);

  // 2. Sum of products: a * b + c * d does NOT need parentheses
  const sumProds: Expression = {
    kind: "sum",
    args: [
      { kind: "product", args: [symA, symB] },
      { kind: "product", args: [symC, symA] },
    ],
  };
  const renderedSumProds = renderLatex(sumProds, { mode: "plain" });
  assert.equal(renderedSumProds, "x\\,y + z\\,x");
  assert.equal(renderedSumProds.includes("\\left("), false);

  // 3. Product with fraction: a * (b / c) does NOT need parentheses around fraction
  const prodFrac: Expression = {
    kind: "product",
    args: [symA, { kind: "quotient", numerator: symB, denominator: symC }],
  };
  const renderedProdFrac = renderLatex(prodFrac, { mode: "plain" });
  assert.equal(renderedProdFrac, "x\\,\\frac{y}{z}");
  assert.equal(renderedProdFrac.includes("\\left("), false);

  // 4. Product with sum: (a + b) * c MUST have parentheses
  const prodSum: Expression = {
    kind: "product",
    args: [{ kind: "sum", args: [symA, symB] }, symC],
  };
  const renderedProdSum = renderLatex(prodSum, { mode: "plain" });
  assert.equal(renderedProdSum, "\\left(x + y\\right)\\,z");

  // 5. Power with sum base: (a + b)^2 MUST have parentheses
  const powerSum: Expression = {
    kind: "power",
    base: { kind: "sum", args: [symA, symB] },
    exponent: { num: 2, den: 1 },
  };
  const renderedPowerSum = renderLatex(powerSum, { mode: "plain" });
  assert.equal(renderedPowerSum, "\\left(x + y\\right)^{2}");

  // 6. Subtraction of sum: a - (b + c) MUST have parentheses around (b + c)
  const subSum: Expression = {
    kind: "sum",
    args: [symA, { kind: "negate", argument: { kind: "sum", args: [symB, symC] } }],
  };
  const renderedSubSum = renderLatex(subSum, { mode: "plain" });
  assert.equal(renderedSubSum, "x - \\left(y + z\\right)");

  // 7. Product with negated factor: (-a) * b MUST have parentheses around (-a)
  const prodNeg: Expression = {
    kind: "product",
    args: [{ kind: "negate", argument: symA }, symB],
  };
  const renderedProdNeg = renderLatex(prodNeg, { mode: "plain" });
  assert.equal(renderedProdNeg, "\\left(-\\left(x\\right)\\right)\\,y");
});

test("parens.property.test: test parser catches precedence inversions (planted defects)", () => {
  const symA: Expression = { kind: "symbol", termId: "x", quantityId: "x" };
  const symB: Expression = { kind: "symbol", termId: "y", quantityId: "y" };
  const symC: Expression = { kind: "symbol", termId: "z", quantityId: "z" };

  // Defect 1: If (x + y) * z were rendered as "x + y\,z" without parentheses,
  // the parser parses it as x + (y * z), which inverts precedence and must fail.
  const prodSum: Expression = {
    kind: "product",
    args: [{ kind: "sum", args: [symA, symB] }, symC],
  };
  const badProdSumParsed = parseTestLatex("x + y\\,z");
  assert.equal(structuralPrecedenceEqual(prodSum, badProdSumParsed), false);

  // Defect 2: If (x + y)^2 were rendered as "x + y^{2}" without parentheses,
  // the parser parses it as x + y^2, which inverts precedence and must fail.
  const powerSum: Expression = {
    kind: "power",
    base: { kind: "sum", args: [symA, symB] },
    exponent: { num: 2, den: 1 },
  };
  const badPowerParsed = parseTestLatex("x + y^{2}");
  assert.equal(structuralPrecedenceEqual(powerSum, badPowerParsed), false);

  // Defect 3: If -(x + y) were rendered as "-x + y" without parentheses,
  // the parser parses it as (-x) + y, which fails.
  const negSum: Expression = {
    kind: "negate",
    argument: { kind: "sum", args: [symA, symB] },
  };
  const badNegSumParsed = parseTestLatex("-x + y");
  assert.equal(structuralPrecedenceEqual(negSum, badNegSumParsed), false);

  // Defect 4: If x - (y + z) were rendered as "x - y + z" without parentheses,
  // the parser parses it as x - y + z = (x - y) + z, which fails.
  const subSum: Expression = {
    kind: "sum",
    args: [symA, { kind: "negate", argument: { kind: "sum", args: [symB, symC] } }],
  };
  const badSubSumParsed = parseTestLatex("x - y + z");
  assert.equal(structuralPrecedenceEqual(subSum, badSubSumParsed), false);
});

test("parens.property.test: 500 seeded random trees preserve precedence", async () => {
  const SEEDS = ["1", "9007199254740993", "18446744073709551615"] as const;
  const TREES_PER_SEED = [167, 167, 166]; // Total: 500 trees

  const logRunId = newRunIdentity();
  const logger = new TestLogger("equations-latex", logRunId);

  let totalTested = 0;

  for (let sIdx = 0; sIdx < SEEDS.length; sIdx++) {
    const seedStr = SEEDS[sIdx]!;
    const count = TREES_PER_SEED[sIdx]!;
    const rng = new SplitMix64(seedStr);
    const startMs = Date.now();

    for (let i = 0; i < count; i++) {
      const tree = generateRandomTree(rng, 0, 4);
      let rendered = "";

      try {
        rendered = renderLatex(tree, { mode: "plain" });
        const parsed = parseTestLatex(rendered);
        const matches = structuralPrecedenceEqual(tree, parsed);

        if (!matches) {
          const authoring = printAuthoring(tree as any, { includeOpIds: false });
          const errMsg = `Precedence preservation failed for seed "${seedStr}" tree ${i}!\nLaTeX: ${rendered}\nAuthoring: ${authoring}\nTree: ${JSON.stringify(tree)}\nParsed: ${JSON.stringify(parsed)}`;

          logger.log({
            testId: `parens-property-seed-${seedStr}-tree-${i}`,
            beadId: "am-eq-latex-generation-hc3",
            seed: seedStr,
            outcome: "failed",
            comparisonKind: "bitwise",
            expected: "precedence-preserved",
            actual: {
              latex: rendered,
              treeInAuthoring: authoring,
              tree,
              parsed,
            },
            durationMs: Date.now() - startMs,
          });
          await logger.flush();

          throw new Error(errMsg);
        }
      } catch (err: unknown) {
        const authoring = printAuthoring(tree as any, { includeOpIds: false });
        logger.log({
          testId: `parens-property-seed-${seedStr}-tree-${i}`,
          beadId: "am-eq-latex-generation-hc3",
          seed: seedStr,
          outcome: "failed",
          comparisonKind: "bitwise",
          expected: "precedence-preserved",
          actual: {
            latex: rendered,
            treeInAuthoring: authoring,
            error: err instanceof Error ? err.message : String(err),
          },
          durationMs: Date.now() - startMs,
        });
        await logger.flush();
        throw err;
      }
      totalTested++;
    }

    const durationMs = Date.now() - startMs;
    logger.log({
      testId: `parens-property-seed-${seedStr}`,
      beadId: "am-eq-latex-generation-hc3",
      seed: seedStr,
      outcome: "passed",
      comparisonKind: "bitwise",
      expected: `${count} trees precedence-preserved`,
      actual: `${count} trees precedence-preserved`,
      durationMs,
    });
    await logger.flush();
  }

  assert.equal(totalTested, 500, "Must test exactly 500 trees across all seeds");
});
