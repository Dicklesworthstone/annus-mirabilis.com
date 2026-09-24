/**
 * The exercise checker's tiny, closed grammar (am-disc-exercise-checker-i4h2):
 * a tokenizer and a recursive-descent parser producing a syntax tree, never
 * `eval` or the `Function` constructor. Keep this grammar small -- every
 * added feature is attack surface and a new way numerical equivalence can
 * lie (see equivalence.ts's adversarial fixtures).
 */

export const ALLOWED_FUNCTIONS = ["sqrt", "exp", "ln", "sin", "cos", "abs"] as const;
export type FunctionName = (typeof ALLOWED_FUNCTIONS)[number];

export type Expr =
  | Readonly<{ kind: "number"; value: number }>
  | Readonly<{ kind: "identifier"; name: string }>
  | Readonly<{ kind: "unary"; op: "-"; operand: Expr }>
  | Readonly<{ kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }>
  | Readonly<{ kind: "call"; name: FunctionName; arg: Expr }>;

export type ParseError = Readonly<{ ok: false; position: number; message: string }>;
export type ParseSuccess = Readonly<{
  ok: true;
  expr: Expr;
  nodeCount: number;
  depth: number;
}>;

const MAX_LENGTH = 200;
const MAX_NODES = 200;
const MAX_DEPTH = 32;

type TokenType = "number" | "identifier" | "op" | "lparen" | "rparen" | "end";
interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly position: number;
}

function fail(position: number, message: string): ParseError {
  return { ok: false, position, message };
}

function tokenize(text: string): Token[] | ParseError {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === " ") {
      i++;
      continue;
    }
    if (ch === ".") {
      const next = text[i + 1];
      if (next === undefined || !/[0-9]/.test(next)) {
        return fail(i, "A decimal needs a leading digit; write '0.5' instead of '.5'.");
      }
      return fail(i, "A decimal needs a leading digit; write '0.5' instead of '.5'.");
    }
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < text.length && /[0-9]/.test(text[i] as string)) i++;
      if (text[i] === ".") {
        i++;
        if (!/[0-9]/.test(text[i] ?? ""))
          return fail(i, "Expected a digit after the decimal point.");
        while (i < text.length && /[0-9]/.test(text[i] as string)) i++;
      }
      if (text[i] === "e" || text[i] === "E") {
        const expStart = i;
        i++;
        if (text[i] === "+" || text[i] === "-") i++;
        if (!/[0-9]/.test(text[i] ?? "")) {
          i = expStart; // not an exponent after all; leave 'e'/'E' for the identifier/operator scan
        } else {
          while (i < text.length && /[0-9]/.test(text[i] as string)) i++;
        }
      }
      tokens.push({ type: "number", value: text.slice(start, i), position: start });
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const start = i;
      while (i < text.length && /[A-Za-z0-9_]/.test(text[i] as string)) i++;
      tokens.push({ type: "identifier", value: text.slice(start, i), position: start });
      continue;
    }
    if ("+-*/^".includes(ch)) {
      tokens.push({ type: "op", value: ch, position: i });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch, position: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch, position: i });
      i++;
      continue;
    }
    return fail(i, `Unexpected character '${ch}'.`);
  }
  tokens.push({ type: "end", value: "", position: text.length });
  return tokens;
}

function parseNumberToken(tok: Token): number | ParseError {
  const raw = tok.value;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fail(tok.position, `The number '${raw}' is out of the representable range.`);
  }
  if (value === 0 && !/^0*\.?0*$/.test(raw)) {
    return fail(
      tok.position,
      `The number '${raw}' underflows to zero; use a value inside the representable range.`,
    );
  }
  return value;
}

class Parser {
  private readonly tokens: readonly Token[];
  private pos = 0;
  private nodeCount = 0;
  private maxDepthSeen = 0;
  private readonly declaredNames: ReadonlySet<string>;

  constructor(tokens: readonly Token[], declaredNames: ReadonlySet<string>) {
    this.tokens = tokens;
    this.declaredNames = declaredNames;
  }

  private peek(): Token {
    return this.tokens[this.pos] as Token;
  }

  private advance(): Token {
    const t = this.peek();
    this.pos++;
    return t;
  }

  private node(expr: Expr): Expr | ParseError {
    this.nodeCount++;
    if (this.nodeCount > MAX_NODES) {
      return fail(this.peek().position, `Expression has more than ${MAX_NODES} syntax nodes.`);
    }
    return expr;
  }

  private guardDepth(depth: number): ParseError | null {
    if (depth > this.maxDepthSeen) this.maxDepthSeen = depth;
    if (depth > MAX_DEPTH) {
      return fail(this.peek().position, `Expression nests more than ${MAX_DEPTH} levels deep.`);
    }
    return null;
  }

  parseExpression(depth = 0): Expr | ParseError {
    return this.parseAdditive(depth);
  }

  /** Parses a full expression, then requires end-of-input, reporting an implicit-multiplication trailing token by name. */
  parseProgram(): ParseSuccess | ParseError {
    const expr = this.parseExpression();
    if (isParseError(expr)) return expr;
    const trailing = this.peek();
    if (trailing.type !== "end") {
      if (
        trailing.type === "number" ||
        trailing.type === "identifier" ||
        trailing.type === "lparen"
      ) {
        return fail(
          trailing.position,
          `Implicit multiplication is not allowed; write an explicit '*' before '${trailing.value || "("}'.`,
        );
      }
      return fail(trailing.position, `Unexpected token '${trailing.value}'.`);
    }
    const nodeCount = countNodes(expr);
    if (nodeCount > MAX_NODES) {
      return fail(trailing.position, `Expression has more than ${MAX_NODES} syntax nodes.`);
    }
    return { ok: true, expr, nodeCount, depth: this.maxDepthSeen };
  }

  private parseAdditive(depth: number): Expr | ParseError {
    const guard = this.guardDepth(depth);
    if (guard) return guard;
    let left = this.parseMultiplicative(depth + 1);
    if (isParseError(left)) return left;
    for (;;) {
      const tok = this.peek();
      if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
        this.advance();
        const right = this.parseMultiplicative(depth + 1);
        if (isParseError(right)) return right;
        const combined = this.node({ kind: "binary", op: tok.value, left, right });
        if (isParseError(combined)) return combined;
        left = combined;
      } else {
        return left;
      }
    }
  }

  private parseMultiplicative(depth: number): Expr | ParseError {
    const guard = this.guardDepth(depth);
    if (guard) return guard;
    let left = this.parseUnary(depth + 1);
    if (isParseError(left)) return left;
    for (;;) {
      const tok = this.peek();
      if (tok.type === "op" && (tok.value === "*" || tok.value === "/")) {
        this.advance();
        const right = this.parseUnary(depth + 1);
        if (isParseError(right)) return right;
        const combined = this.node({ kind: "binary", op: tok.value, left, right });
        if (isParseError(combined)) return combined;
        left = combined;
      } else if (tok.type === "number" || tok.type === "identifier" || tok.type === "lparen") {
        return fail(
          tok.position,
          `Implicit multiplication is not allowed; write an explicit '*' (for example '2*${tok.value || "x"}').`,
        );
      } else {
        return left;
      }
    }
  }

  private parseUnary(depth: number): Expr | ParseError {
    const guard = this.guardDepth(depth);
    if (guard) return guard;
    const tok = this.peek();
    if (tok.type === "op" && tok.value === "-") {
      this.advance();
      const operand = this.parseUnary(depth + 1);
      if (isParseError(operand)) return operand;
      return this.node({ kind: "unary", op: "-", operand });
    }
    return this.parsePower(depth);
  }

  private parsePower(depth: number): Expr | ParseError {
    const guard = this.guardDepth(depth);
    if (guard) return guard;
    const base = this.parsePrimary(depth + 1);
    if (isParseError(base)) return base;
    const tok = this.peek();
    if (tok.type === "op" && tok.value === "^") {
      this.advance();
      const exponent = this.parseUnary(depth + 1);
      if (isParseError(exponent)) return exponent;
      return this.node({ kind: "binary", op: "^", left: base, right: exponent });
    }
    return base;
  }

  private parsePrimary(depth: number): Expr | ParseError {
    const guard = this.guardDepth(depth);
    if (guard) return guard;
    const tok = this.advance();
    if (tok.type === "number") {
      const value = parseNumberToken(tok);
      if (isParseError(value)) return value;
      return this.node({ kind: "number", value });
    }
    if (tok.type === "identifier") {
      if ((ALLOWED_FUNCTIONS as readonly string[]).includes(tok.value)) {
        const open = this.peek();
        if (open.type !== "lparen") {
          return fail(
            open.position,
            `'${tok.value}' is a function and needs parentheses, for example '${tok.value}(x)'.`,
          );
        }
        this.advance();
        const arg = this.parseExpression(depth + 1);
        if (isParseError(arg)) return arg;
        const close = this.advance();
        if (close.type !== "rparen") return fail(close.position, "Expected ')'.");
        return this.node({ kind: "call", name: tok.value as FunctionName, arg });
      }
      if (!this.declaredNames.has(tok.value)) {
        return fail(
          tok.position,
          `'${tok.value}' is not a declared variable or constant for this exercise.`,
        );
      }
      return this.node({ kind: "identifier", name: tok.value });
    }
    if (tok.type === "lparen") {
      const inner = this.parseExpression(depth + 1);
      if (isParseError(inner)) return inner;
      const close = this.advance();
      if (close.type !== "rparen") return fail(close.position, "Expected ')'.");
      return inner;
    }
    if (tok.type === "end") return fail(tok.position, "Expression ended unexpectedly.");
    return fail(tok.position, `Unexpected token '${tok.value}'.`);
  }
}

function isParseError(value: unknown): value is ParseError {
  return typeof value === "object" && value !== null && (value as { ok?: boolean }).ok === false;
}

function countNodes(expr: Expr): number {
  switch (expr.kind) {
    case "number":
    case "identifier":
      return 1;
    case "unary":
      return 1 + countNodes(expr.operand);
    case "call":
      return 1 + countNodes(expr.arg);
    case "binary":
      return 1 + countNodes(expr.left) + countNodes(expr.right);
  }
}

/** Parses `text` (already normalize()'d) against `declaredNames`, the only identifiers this expression may use. */
const ECHO_OPERATORS = { "+": "+", "-": "\u2212", "*": "\u00b7", "/": "/", "^": "^" } as const;

/**
 * The parsed expression written back with every grouping explicit, so a reader sees how the
 * checker read their answer before seeing whether it matched: 2*x/3*y reads as ((2 · x) / 3) · y,
 * -x^2 as −(x^2), and 2^3^2 as 2^(3^2). Every operand that is itself a sum, product, quotient or
 * power is bracketed; names, numbers and function calls are not.
 */
export function echo(expr: Expr): string {
  const operand = (e: Expr): string => (e.kind === "binary" ? `(${echo(e)})` : echo(e));
  switch (expr.kind) {
    case "number":
      return String(expr.value);
    case "identifier":
      return expr.name;
    case "unary":
      return `\u2212${operand(expr.operand)}`;
    case "binary":
      return expr.op === "^"
        ? `${operand(expr.left)}^${operand(expr.right)}`
        : `${operand(expr.left)} ${ECHO_OPERATORS[expr.op]} ${operand(expr.right)}`;
    case "call":
      return `${expr.name}(${echo(expr.arg)})`;
  }
}

export function parse(text: string, declaredNames: ReadonlySet<string>): ParseSuccess | ParseError {
  if (text.length > MAX_LENGTH) {
    return fail(MAX_LENGTH, `Expression is longer than ${MAX_LENGTH} characters.`);
  }
  const tokens = tokenize(text);
  if (isParseError(tokens)) return tokens;
  return new Parser(tokens, declaredNames).parseProgram();
}
