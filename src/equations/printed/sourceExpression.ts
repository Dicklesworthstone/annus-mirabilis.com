/**
 * Read the algebraic subset of a printed display into the edition's expression model.
 *
 * This is a parser over the ONE LaTeX tokenizer, not a second tokenizer or a glyph replacement
 * rule. Identifiers come from the display's already checked, scoped term bindings. Unsupported
 * commands stop the parse; they never become dimensionless constants. Source offsets describe
 * where each operation is printed, while the expression tree describes what it does.
 *
 * Product owners explicitly select their displays. Parsing another display does not silently
 * opt it into a source-semantics contract or supply an authored explanation.
 */
import type { Expression } from "../ast.ts";
import { tokenizeLatex } from "../latex/tokenize.ts";
import type { CheckedDisplay, CheckedTerm } from "./displayTerms.ts";

type Lexeme = Readonly<{
  value: string;
  start: number;
  end: number;
  term?: CheckedTerm;
}>;

export type SourceExpressionNode = Readonly<{
  tree: Expression;
  start: number;
  end: number;
  /** Only the printed sign for a relation or a sum; the whole construct for a fraction/root. */
  marker?: Readonly<{ start: number; end: number }>;
  parts: readonly Readonly<{ name: string; node: SourceExpressionNode }>[];
}>;

export type SourceExpression = Readonly<{
  rows: readonly SourceExpressionNode[];
  /** A continuation equality reuses the preceding left side; it does not invent another glyph. */
  continuationRows: readonly number[];
}>;

export class SourceExpressionError extends Error {
  constructor(
    readonly code: "printed-expression-unsupported",
    readonly display: string,
    readonly offset: number,
    reason: string,
  ) {
    super(`${display} at ${offset}: ${reason}`);
    this.name = "SourceExpressionError";
  }
}

function lexemes(display: CheckedDisplay): readonly Lexeme[] {
  const items: Lexeme[] = [];
  const tokens = tokenizeLatex(display.latex);
  for (const token of tokens) {
    if (token.kind === "whitespace") continue;
    if (token.kind === "text") {
      // A text token can contain adjacent arithmetic signs and digits. Each character retains
      // the offset the shared tokenizer supplied; identifiers are joined by checked spans below.
      for (let i = 0; i < token.value.length; i++)
        items.push({
          value: token.value[i]!,
          start: token.offset + i,
          end: token.offset + i + 1,
        });
    } else {
      const value = token.environmentName
        ? `${token.value}{${token.environmentName}}`
        : token.value;
      items.push({ value, start: token.offset, end: token.offset + value.length });
    }
  }
  const terms = new Map(display.terms.map((term) => [term.start, term]));
  const bound: Lexeme[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const term = terms.get(item.start);
    if (!term) {
      bound.push(item);
      continue;
    }
    bound.push({ value: term.glyph, start: term.start, end: term.end, term });
    while (items[i + 1] && items[i + 1]!.start < term.end) i++;
  }
  return bound;
}

class RowParser {
  private index = 0;
  constructor(
    private readonly display: CheckedDisplay,
    private readonly items: readonly Lexeme[],
    private readonly symbolIndices: Readonly<Record<string, string>>,
  ) {}

  private peek(): Lexeme | undefined {
    return this.items[this.index];
  }

  private fail(reason: string): never {
    throw new SourceExpressionError(
      "printed-expression-unsupported",
      this.display.display,
      this.peek()?.start ?? this.display.latex.length,
      reason,
    );
  }

  private take(value?: string): Lexeme {
    const token = this.peek();
    if (!token || (value !== undefined && token.value !== value))
      return this.fail(value === undefined ? "Expected an expression." : `Expected ${value}.`);
    this.index++;
    return token;
  }

  private operation(
    tree: Expression,
    start: number,
    end: number,
    parts: SourceExpressionNode["parts"],
    marker: Readonly<{ start: number; end: number }> = { start, end },
  ): SourceExpressionNode {
    const opId = `${this.display.paper}.${this.display.display}.op.${start}.${tree.kind}`;
    return { tree: { ...tree, opId } as Expression, start, end, parts, marker };
  }

  parse(previousLeft?: Expression): { row: SourceExpressionNode; continuation: boolean } {
    const alignment = this.peek()?.value === "&";
    if (alignment) this.take("&");
    const continuation = this.peek()?.value === "=";
    const left = continuation ? undefined : this.sum();
    if (this.peek()?.value === "&") this.take("&");
    const sign = this.take("=");
    if (!left && !previousLeft) this.fail("A continuation equality needs a preceding left side.");
    const right = this.sum();
    if ([".", ",", ";"].includes(this.peek()?.value ?? "")) this.take();
    if (this.peek()) this.fail(`Unsupported token ${this.peek()!.value}.`);
    const row = this.operation(
      { kind: "relation", operator: "=", left: left?.tree ?? previousLeft!, right: right.tree },
      left?.start ?? sign.start,
      right.end,
      [...(left ? [{ name: "left", node: left }] : []), { name: "right", node: right }],
      sign,
    );
    return { row, continuation };
  }

  private sum(): SourceExpressionNode {
    const first = this.product();
    const args = [first];
    let firstSign: Lexeme | undefined;
    while (this.peek()?.value === "+" || this.peek()?.value === "-") {
      const sign = this.take();
      firstSign ??= sign;
      const next = this.product();
      args.push(
        sign.value === "-"
          ? this.operation(
              { kind: "negate", argument: next.tree },
              sign.start,
              next.end,
              [{ name: "argument", node: next }],
              sign,
            )
          : next,
      );
    }
    return args.length === 1
      ? first
      : this.operation(
          { kind: "sum", args: args.map((arg) => arg.tree) },
          first.start,
          args.at(-1)!.end,
          args.map((node, i) => ({ name: `args.${i}`, node })),
          firstSign!,
        );
  }

  private startsFactor(): boolean {
    const next = this.peek();
    return !!(
      next &&
      (next.term ||
        /^[0-9]$/.test(next.value) ||
        ["{", "(", "[", "\\left", "\\frac", "\\sqrt", "\\cos", "\\lg"].includes(next.value))
    );
  }

  private product(): SourceExpressionNode {
    const first = this.unary();
    const args = [first];
    while (this.startsFactor() || this.peek()?.value === "\\cdot") {
      if (this.peek()?.value === "\\cdot") this.take();
      args.push(this.unary());
    }
    return args.length === 1
      ? first
      : this.operation(
          { kind: "product", args: args.map((arg) => arg.tree) },
          first.start,
          args.at(-1)!.end,
          args.map((node, i) => ({ name: `args.${i}`, node })),
        );
  }

  private unary(): SourceExpressionNode {
    if (this.peek()?.value === "-") {
      const sign = this.take();
      const argument = this.unary();
      return this.operation(
        { kind: "negate", argument: argument.tree },
        sign.start,
        argument.end,
        [{ name: "argument", node: argument }],
        sign,
      );
    }
    let node = this.atom();
    if (this.peek()?.value === "^") {
      this.take("^");
      const exponent = this.peek()?.value === "{" ? this.argument() : this.unbracedExponent();
      if (exponent.node.tree.kind === "number") {
        const num = Number(exponent.node.tree.value);
        if (!Number.isSafeInteger(num)) this.fail("The integer power exceeds the exact range.");
        node = this.operation(
          { kind: "power", base: node.tree, exponent: { num, den: 1 } },
          node.start,
          exponent.end,
          [{ name: "base", node }],
        );
      } else {
        node = this.operation(
          { kind: "symbolPower", base: node.tree, exponent: exponent.node.tree },
          node.start,
          exponent.end,
          [
            { name: "base", node },
            { name: "exponent", node: exponent.node },
          ],
        );
      }
    }
    return node;
  }

  /** TeX takes one unbraced exponent token; checked glyph spans retain their own decorations. */
  private unbracedExponent(): { node: SourceExpressionNode; end: number } {
    const token = this.peek();
    if (token && /^[0-9]$/.test(token.value)) {
      this.take();
      const node: SourceExpressionNode = {
        tree: { kind: "number", value: token.value },
        start: token.start,
        end: token.end,
        parts: [],
      };
      return { node, end: node.end };
    }
    const node = this.atom();
    return { node, end: node.end };
  }

  private argument(): { node: SourceExpressionNode; end: number } {
    this.take("{");
    const node = this.sum();
    const close = this.take("}");
    return { node, end: close.end };
  }

  private atom(): SourceExpressionNode {
    const token = this.take();
    if (token.term)
      return {
        tree: {
          kind: "symbol",
          termId: token.term.termId,
          quantityId: token.term.quantityId,
          ...(this.symbolIndices[token.term.glyph] !== undefined
            ? { index: this.symbolIndices[token.term.glyph] }
            : {}),
        },
        start: token.start,
        end: token.end,
        parts: [],
      };
    if (/^[0-9]$/.test(token.value)) {
      let value = token.value;
      let end = token.end;
      while (this.peek() && /^[0-9]$/.test(this.peek()!.value)) {
        const digit = this.take();
        value += digit.value;
        end = digit.end;
      }
      return { tree: { kind: "number", value }, start: token.start, end, parts: [] };
    }
    if (token.value === "\\frac") {
      const numerator = this.argument();
      const denominator = this.argument();
      return this.operation(
        { kind: "quotient", numerator: numerator.node.tree, denominator: denominator.node.tree },
        token.start,
        denominator.end,
        [
          { name: "numerator", node: numerator.node },
          { name: "denominator", node: denominator.node },
        ],
      );
    }
    if (token.value === "\\sqrt") {
      const radicand = this.argument();
      return this.operation(
        { kind: "root", degree: 2, radicand: radicand.node.tree },
        token.start,
        radicand.end,
        [{ name: "radicand", node: radicand.node }],
      );
    }
    if (token.value === "\\cos" || token.value === "\\lg") {
      const argument = this.unary();
      return this.operation(
        { kind: "function", name: token.value === "\\lg" ? "ln" : "cos", argument: argument.tree },
        token.start,
        argument.end,
        [{ name: "argument", node: argument }],
      );
    }
    const sized = token.value === "\\left";
    const open = sized ? this.take() : token;
    const close = new Map([
      ["{", "}"],
      ["(", ")"],
      ["[", "]"],
      ["\\{", "\\}"],
    ]).get(open.value);
    if (close) {
      const argument = this.sum();
      if (sized) this.take("\\right");
      const last = this.take(close);
      return this.operation({ kind: "group", argument: argument.tree }, token.start, last.end, [
        { name: "argument", node: argument },
      ]);
    }
    return this.fail(`Unsupported token ${token.value}.`);
  }
}

/** Every input token must belong to the supported grammar, including every aligned row. */
export function parseSourceExpression(
  display: CheckedDisplay,
  symbolIndices: Readonly<Record<string, string>> = {},
): SourceExpression {
  let items = lexemes(display);
  const aligned = items[0]?.value === "\\begin{aligned}";
  if (aligned) {
    if (items.at(-1)?.value !== "\\end{aligned}")
      throw new SourceExpressionError(
        "printed-expression-unsupported",
        display.display,
        display.latex.length,
        "Unclosed alignment.",
      );
    items = items.slice(1, -1);
  }
  const lines: Lexeme[][] = [[]];
  for (const item of items) {
    if (aligned && item.value === "\\\\") lines.push([]);
    else lines.at(-1)!.push(item);
  }
  const rows: SourceExpressionNode[] = [];
  const continuationRows: number[] = [];
  for (const line of lines) {
    const previous = rows.at(-1)?.tree;
    const parsed = new RowParser(display, line, symbolIndices).parse(
      previous?.kind === "relation" ? previous.left : undefined,
    );
    if (parsed.continuation) continuationRows.push(rows.length);
    rows.push(parsed.row);
  }
  return { rows, continuationRows };
}

export function sourceNodes(
  source: SourceExpression,
): readonly Readonly<{ path: string; node: SourceExpressionNode }>[] {
  const nodes: { path: string; node: SourceExpressionNode }[] = [];
  function visit(node: SourceExpressionNode, path: string) {
    nodes.push({ path, node });
    for (const part of node.parts) visit(part.node, `${path}.${part.name}`);
  }
  source.rows.forEach((row, i) => {
    visit(row, `row${i + 1}`);
  });
  return nodes;
}
