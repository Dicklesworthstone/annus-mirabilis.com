/**
 * Authoring Format Parser for Semantic Expression Trees.
 *
 * Implements a bounded Pratt parser for the authoring grammar.
 * Rejects non-ASCII identifiers, unknown symbols, and budget/nesting overruns.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.3).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import { parseOperationId, parseTermId } from "../../content/ids.ts";
import type {
  DerivativeNode,
  ExactScale,
  Expression,
  FunctionName,
  IntegralNode,
  MatrixNode,
  PiecewiseCase,
  PiecewiseNode,
  RelationOperator,
  SymbolNode,
} from "./types.ts";

export class ParseError extends Error {
  readonly position?: number | undefined;

  constructor(message: string, position?: number) {
    super(position !== undefined ? `${message} at position ${position}` : message);
    this.name = "ParseError";
    this.position = position;
  }
}

export class ParseLimitError extends Error {
  readonly code: "size-limit" | "depth-limit";

  constructor(code: "size-limit" | "depth-limit", message: string) {
    super(message);
    this.name = "ParseLimitError";
    this.code = code;
  }
}

export interface SymbolDeclaration {
  termId: string;
  quantityId: string;
  scale?: ExactScale | undefined;
  component?: "x" | "y" | "z" | undefined;
  role?: string | undefined;
}

export interface ParseOptions {
  readonly symbols?: Record<string, SymbolDeclaration> | undefined;
  readonly equationId?: string | undefined;
  readonly maxDepth?: number | undefined;
}

const MAX_SOURCE_BYTES = 8192;
const MAX_NESTING_DEPTH = 64;

// Precedence levels
const PREC_LOWEST = 0;
const PREC_RELATION = 10;
const PREC_ADD_SUB = 20;
const PREC_MUL_DIV = 30;
const PREC_UNARY = 40;
const PREC_POWER = 50;

type TokenType =
  | "NUMBER"
  | "IDENT"
  | "OP_ID"
  | "STRING"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "CARET"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "LBRACE"
  | "RBRACE"
  | "COMMA"
  | "RELATION"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export function parseAuthoring(source: string, options: ParseOptions = {}): Expression {
  if (source.length > MAX_SOURCE_BYTES) {
    throw new ParseLimitError(
      "size-limit",
      `Expression source exceeds 8 KiB maximum limit (got ${source.length} bytes)`,
    );
  }

  // Strictly enforce ASCII identifiers and content
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code > 127) {
      throw new ParseError(
        `Non-ASCII character '${source[i]}' (U+${code.toString(16).padStart(4, "0")}) detected. Identifiers must be ASCII (e.g. use 'eta' instead of 'η', and no Cyrillic lookalikes).`,
        i,
      );
    }
  }

  const tokens = tokenize(source);
  let cur = 0;

  function peek(): Token {
    return tokens[cur] ?? { type: "EOF", value: "", pos: source.length };
  }

  function advance(): Token {
    const t = peek();
    if (t.type !== "EOF") cur++;
    return t;
  }

  function match(type: TokenType): boolean {
    if (peek().type === type) {
      advance();
      return true;
    }
    return false;
  }

  function expect(type: TokenType, msg?: string): Token {
    const t = advance();
    if (t.type !== type) {
      throw new ParseError(msg ?? `Expected token ${type} but got ${t.type} ('${t.value}')`, t.pos);
    }
    return t;
  }

  function parseExpression(precedence: number, depth: number): Expression {
    if (depth > MAX_NESTING_DEPTH) {
      throw new ParseLimitError(
        "depth-limit",
        `Expression exceeds maximum nesting depth of ${MAX_NESTING_DEPTH}`,
      );
    }

    // Check for opId prefix e.g. @denominator or @opId
    let pendingOpId: string | undefined;
    if (peek().type === "OP_ID") {
      const opToken = advance();
      const rawOpName = opToken.value;
      if (options.equationId && !rawOpName.includes(".op.")) {
        pendingOpId = `${options.equationId}.op.${rawOpName}`;
      } else {
        pendingOpId = rawOpName;
      }
      match("COLON" as TokenType); // optional colon after @opId
    }

    let left = parsePrefix(depth);

    if (pendingOpId) {
      // Attach opId to left
      left = attachOpId(left, pendingOpId);
    }

    while (true) {
      const next = peek();
      const nextPrec = getInfixPrecedence(next);
      if (nextPrec <= precedence) {
        break;
      }

      left = parseInfix(left, nextPrec, depth);
    }

    return left;
  }

  function parsePrefix(depth: number): Expression {
    const token = peek();

    if (token.type === "MINUS") {
      advance();
      const operand = parseExpression(PREC_UNARY, depth + 1);
      return { kind: "negate", argument: operand };
    }

    if (token.type === "PLUS") {
      advance();
      return parseExpression(PREC_UNARY, depth + 1);
    }

    if (token.type === "NUMBER") {
      advance();
      return { kind: "number", value: token.value };
    }

    if (token.type === "LPAREN") {
      advance();
      const inner = parseExpression(PREC_LOWEST, depth + 1);
      expect("RPAREN", "Expected ')' to close grouped expression");
      return { kind: "group", argument: inner };
    }

    if (token.type === "LBRACKET") {
      advance();
      const elements: Expression[] = [];
      if (peek().type !== "RBRACKET") {
        while (true) {
          elements.push(parseExpression(PREC_LOWEST, depth + 1));
          if (!match("COMMA")) break;
        }
      }
      expect("RBRACKET", "Expected ']' to close list");
      return { kind: "vector", elements };
    }

    if (token.type === "IDENT") {
      const identToken = advance();
      const name = identToken.value;

      // Functional forms
      if (peek().type === "LPAREN") {
        return parseFunctionCall(name, identToken.pos, depth);
      }

      // Symbol or Constant
      if (name === "pi" && (!options.symbols || !options.symbols[name])) {
        return { kind: "constant", name: "pi" };
      }

      const symDecl = options.symbols?.[name];
      if (symDecl) {
        return {
          kind: "symbol",
          termId: symDecl.termId,
          quantityId: symDecl.quantityId,
          scale: symDecl.scale,
          component: symDecl.component,
          role: symDecl.role,
        };
      }

      throw new ParseError(
        `Unknown identifier '${name}': not declared in symbols block.`,
        identToken.pos,
      );
    }

    throw new ParseError(`Unexpected token '${token.value}' (${token.type})`, token.pos);
  }

  function parseFunctionCall(name: string, pos: number, depth: number): Expression {
    expect("LPAREN");
    const args: Expression[] = [];
    if (peek().type !== "RPAREN") {
      while (true) {
        args.push(parseExpression(PREC_LOWEST, depth + 1));
        if (!match("COMMA")) break;
      }
    }
    expect("RPAREN", `Expected ')' to close call to ${name}`);

    // Built-in functional forms
    if (name === "frac") {
      if (args.length !== 2 || !args[0] || !args[1]) {
        throw new ParseError("frac(numerator, denominator) requires exactly 2 arguments", pos);
      }
      return {
        kind: "quotient",
        numerator: args[0],
        denominator: args[1],
        style: "fraction",
      };
    }

    if (name === "sqrt") {
      if (args.length !== 1 || !args[0]) {
        throw new ParseError("sqrt(radicand) requires exactly 1 argument", pos);
      }
      return { kind: "root", radicand: args[0], degree: 2 };
    }

    if (name === "root") {
      if (args.length !== 2 || !args[0] || !args[1]) {
        throw new ParseError("root(radicand, degree) requires exactly 2 arguments", pos);
      }
      const degree = args[1].kind === "number" ? Number(args[1].value) : 2;
      return { kind: "root", radicand: args[0], degree };
    }

    const mathFns: FunctionName[] = ["ln", "exp", "sin", "cos", "sinh", "cosh", "tanh", "sqrt"];
    if (mathFns.includes(name as FunctionName)) {
      if (args.length !== 1 || !args[0]) {
        throw new ParseError(`${name}(x) requires exactly 1 argument`, pos);
      }
      return { kind: "function", name: name as FunctionName, argument: args[0] };
    }

    if (name === "diff" || name === "pdiff") {
      if (args.length < 2 || !args[0] || !args[1]) {
        throw new ParseError(
          `${name}(expression, variable, [order], [heldFixed]) requires at least 2 arguments`,
          pos,
        );
      }
      const order = args[2] && args[2].kind === "number" ? Number(args[2].value) : 1;
      const heldFixed = args[3];
      return {
        kind: "derivative",
        partial: name === "pdiff",
        expression: args[0],
        variable: args[1],
        order,
        heldFixed,
      };
    }

    if (name === "int") {
      if (args.length < 2 || !args[0] || !args[1]) {
        throw new ParseError(
          "int(expression, variable, [lower], [upper]) requires at least 2 arguments",
          pos,
        );
      }
      return {
        kind: "integral",
        expression: args[0],
        variable: args[1],
        lowerBound: args[2],
        upperBound: args[3],
      };
    }

    if (name === "sum" || name === "seriesSum") {
      if (args.length < 2 || !args[0] || !args[1]) {
        throw new ParseError(
          "sum(body, index, [lower], [upper]) requires at least 2 arguments",
          pos,
        );
      }
      return {
        kind: "seriesSum",
        body: args[0],
        index: args[1],
        lowerBound: args[2],
        upperBound: args[3],
      };
    }

    if (name === "prod" || name === "seriesProduct") {
      if (args.length < 2 || !args[0] || !args[1]) {
        throw new ParseError(
          "prod(body, index, [lower], [upper]) requires at least 2 arguments",
          pos,
        );
      }
      return {
        kind: "seriesProduct",
        body: args[0],
        index: args[1],
        lowerBound: args[2],
        upperBound: args[3],
      };
    }

    if (name === "limit") {
      if (args.length !== 3 || !args[0] || !args[1] || !args[2]) {
        throw new ParseError("limit(body, variable, target) requires 3 arguments", pos);
      }
      return {
        kind: "limit",
        body: args[0],
        variable: args[1],
        target: args[2],
      };
    }

    if (name === "avg") {
      if (args.length !== 1 || !args[0]) {
        throw new ParseError("avg(x) requires 1 argument", pos);
      }
      return { kind: "average", argument: args[0] };
    }

    if (name === "norm" || name === "abs") {
      if (args.length !== 1 || !args[0]) {
        throw new ParseError("norm(x) requires 1 argument", pos);
      }
      return { kind: "norm", argument: args[0] };
    }

    if (name === "dot") {
      if (args.length !== 2 || !args[0] || !args[1]) {
        throw new ParseError("dot(a, b) requires 2 arguments", pos);
      }
      return { kind: "dotProduct", left: args[0], right: args[1] };
    }

    if (name === "cross") {
      if (args.length !== 2 || !args[0] || !args[1]) {
        throw new ParseError("cross(a, b) requires 2 arguments", pos);
      }
      return { kind: "crossProduct", left: args[0], right: args[1] };
    }

    if (name === "matrix") {
      const rows: Expression[][] = [];
      if (
        args.length === 1 &&
        args[0] &&
        args[0].kind === "vector" &&
        args[0].elements.every((e) => e.kind === "vector")
      ) {
        for (const rowVec of args[0].elements) {
          rows.push([...(rowVec as { kind: "vector"; elements: readonly Expression[] }).elements]);
        }
      } else {
        for (const arg of args) {
          if (arg.kind === "vector") {
            rows.push([...arg.elements]);
          } else {
            rows.push([arg]);
          }
        }
      }
      return { kind: "matrix", rows };
    }

    if (name === "piecewise") {
      const cases: PiecewiseCase[] = [];
      let otherwise: Expression | undefined;

      for (const arg of args) {
        if (
          arg.kind === "vector" &&
          arg.elements.length === 2 &&
          arg.elements[0] &&
          arg.elements[1]
        ) {
          cases.push({ condition: arg.elements[0], value: arg.elements[1] });
        } else if (cases.length > 0 && !otherwise) {
          otherwise = arg;
        }
      }
      return { kind: "piecewise", cases, otherwise };
    }

    if (name === "trunc") {
      const order = args[0] && args[0].kind === "number" ? args[0].value : undefined;
      return { kind: "seriesTruncation", order };
    }

    if (name === "text") {
      const textVal = args[0] && "value" in args[0] ? String(args[0].value) : name;
      return { kind: "textAnnotation", text: textVal };
    }

    throw new ParseError(`Unknown function or operator '${name}'`, pos);
  }

  function parseInfix(left: Expression, prec: number, depth: number): Expression {
    const token = peek();

    // Power
    if (token.type === "CARET") {
      advance();
      // Right associative: parse with prec - 1
      const exponent = parseExpression(PREC_POWER - 1, depth + 1);
      return { kind: "power", base: left, exponent };
    }

    // Add / Subtract
    if (token.type === "PLUS") {
      advance();
      const right = parseExpression(prec, depth + 1);
      // Binary sum
      return { kind: "sum", args: [left, right] };
    }

    if (token.type === "MINUS") {
      advance();
      const right = parseExpression(prec, depth + 1);
      return {
        kind: "sum",
        args: [left, { kind: "negate", argument: right }],
      };
    }

    // Multiply / Divide
    if (token.type === "STAR") {
      advance();
      const right = parseExpression(prec, depth + 1);
      return {
        kind: "product",
        args: [left, right],
        style: "explicit",
      };
    }

    if (token.type === "SLASH") {
      advance();
      const right = parseExpression(prec, depth + 1);
      return {
        kind: "quotient",
        numerator: left,
        denominator: right,
        style: "solidus",
      };
    }

    // Relation
    if (token.type === "RELATION") {
      advance();
      const op = normalizeRelationOp(token.value);
      const right = parseExpression(prec, depth + 1);
      return {
        kind: "relation",
        operator: op,
        left,
        right,
      };
    }

    // Juxtaposition (implicit multiplication)
    if (canStartExpression(token)) {
      const right = parseExpression(PREC_MUL_DIV, depth + 1);
      return {
        kind: "product",
        args: [left, right],
        style: "juxtaposed",
      };
    }

    throw new ParseError(`Unexpected infix token '${token.value}'`, token.pos);
  }

  function getInfixPrecedence(token: Token): number {
    switch (token.type) {
      case "RELATION":
        return PREC_RELATION;
      case "PLUS":
      case "MINUS":
        return PREC_ADD_SUB;
      case "STAR":
      case "SLASH":
        return PREC_MUL_DIV;
      case "CARET":
        return PREC_POWER;
      default:
        if (canStartExpression(token)) {
          return PREC_MUL_DIV;
        }
        return PREC_LOWEST;
    }
  }

  function canStartExpression(token: Token): boolean {
    return (
      token.type === "NUMBER" ||
      token.type === "IDENT" ||
      token.type === "LPAREN" ||
      token.type === "LBRACKET" ||
      token.type === "OP_ID"
    );
  }

  const result = parseExpression(PREC_LOWEST, 0);
  if (peek().type !== "EOF") {
    const extra = peek();
    throw new ParseError(`Extra tokens after expression: '${extra.value}'`, extra.pos);
  }
  return result;
}

function attachOpId(node: Expression, opId: string): Expression {
  if (node.kind === "symbol" || node.kind === "constant") return node;
  return { ...node, opId } as Expression;
}

function normalizeRelationOp(raw: string): RelationOperator {
  if (raw === "~=") return "approx";
  if (raw === "===") return "equiv";
  if (raw === ":=") return "define";
  if (raw === "->") return "maps-to";
  if (raw === "le") return "<=";
  if (raw === "ge") return ">=";
  return raw as RelationOperator;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Op annotation: @name
    if (ch === "@") {
      const start = i;
      i++;
      let name = "";
      while (i < src.length && /[a-zA-Z0-9_.-]/.test(src[i]!)) {
        name += src[i]!;
        i++;
      }
      tokens.push({ type: "OP_ID", value: name, pos: start });
      continue;
    }

    // Number
    if (/[0-9]/.test(ch)) {
      const start = i;
      let numStr = "";
      while (i < src.length && /[0-9]/.test(src[i]!)) {
        numStr += src[i]!;
        i++;
      }
      if (i < src.length && src[i] === "." && /[0-9]/.test(src[i + 1] ?? "")) {
        numStr += ".";
        i++;
        while (i < src.length && /[0-9]/.test(src[i]!)) {
          numStr += src[i]!;
          i++;
        }
      }
      if (i < src.length && (src[i] === "e" || src[i] === "E")) {
        const nextCh = src[i + 1];
        if (nextCh === "+" || nextCh === "-" || /[0-9]/.test(nextCh ?? "")) {
          numStr += src[i]!;
          i++;
          if (src[i] === "+" || src[i] === "-") {
            numStr += src[i]!;
            i++;
          }
          while (i < src.length && /[0-9]/.test(src[i]!)) {
            numStr += src[i]!;
            i++;
          }
        }
      }
      tokens.push({ type: "NUMBER", value: numStr, pos: start });
      continue;
    }

    // Multi-char relations & operators
    if (src.slice(i, i + 7) === "approx ") {
      tokens.push({ type: "RELATION", value: "approx", pos: i });
      i += 6;
      continue;
    }
    if (src.slice(i, i + 7) === "propto ") {
      tokens.push({ type: "RELATION", value: "propto", pos: i });
      i += 6;
      continue;
    }
    if (src.slice(i, i + 6) === "equiv ") {
      tokens.push({ type: "RELATION", value: "equiv", pos: i });
      i += 5;
      continue;
    }
    if (src.slice(i, i + 7) === "define ") {
      tokens.push({ type: "RELATION", value: "define", pos: i });
      i += 6;
      continue;
    }
    if (src.slice(i, i + 8) === "maps-to ") {
      tokens.push({ type: "RELATION", value: "maps-to", pos: i });
      i += 7;
      continue;
    }
    if (src.slice(i, i + 3) === "===") {
      tokens.push({ type: "RELATION", value: "===", pos: i });
      i += 3;
      continue;
    }
    if (src.slice(i, i + 2) === ":=") {
      tokens.push({ type: "RELATION", value: ":=", pos: i });
      i += 2;
      continue;
    }
    if (src.slice(i, i + 2) === "->") {
      tokens.push({ type: "RELATION", value: "->", pos: i });
      i += 2;
      continue;
    }
    if (src.slice(i, i + 2) === "~=") {
      tokens.push({ type: "RELATION", value: "~=", pos: i });
      i += 2;
      continue;
    }
    if (src.slice(i, i + 2) === "<=") {
      tokens.push({ type: "RELATION", value: "<=", pos: i });
      i += 2;
      continue;
    }
    if (src.slice(i, i + 2) === ">=") {
      tokens.push({ type: "RELATION", value: ">=", pos: i });
      i += 2;
      continue;
    }
    if (ch === "=" || ch === "<" || ch === ">") {
      tokens.push({ type: "RELATION", value: ch, pos: i });
      i++;
      continue;
    }

    // Single-char punctuation
    if (ch === "+") {
      tokens.push({ type: "PLUS", value: "+", pos: i });
      i++;
      continue;
    }
    if (ch === "-") {
      tokens.push({ type: "MINUS", value: "-", pos: i });
      i++;
      continue;
    }
    if (ch === "*") {
      tokens.push({ type: "STAR", value: "*", pos: i });
      i++;
      continue;
    }
    if (ch === "/") {
      tokens.push({ type: "SLASH", value: "/", pos: i });
      i++;
      continue;
    }
    if (ch === "^") {
      tokens.push({ type: "CARET", value: "^", pos: i });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", pos: i });
      i++;
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "LBRACKET", value: "[", pos: i });
      i++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "RBRACKET", value: "]", pos: i });
      i++;
      continue;
    }
    if (ch === "{") {
      tokens.push({ type: "LBRACE", value: "{", pos: i });
      i++;
      continue;
    }
    if (ch === "}") {
      tokens.push({ type: "RBRACE", value: "}", pos: i });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "COMMA", value: ",", pos: i });
      i++;
      continue;
    }

    // Identifier
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      let ident = "";
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i]!)) {
        ident += src[i]!;
        i++;
      }
      tokens.push({ type: "IDENT", value: ident, pos: start });
      continue;
    }

    throw new ParseError(`Unexpected character '${ch}'`, i);
  }

  tokens.push({ type: "EOF", value: "", pos: i });
  return tokens;
}
