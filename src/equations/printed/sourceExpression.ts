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
import { glyphSignature, printedAtoms } from "../latex/printedAtoms.ts";
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
  /** A quantity application keeps an operation identity separate from its printed term. */
  operationId?: string;
  parts: readonly Readonly<{ name: string; node: SourceExpressionNode }>[];
}>;

export type SourceExpression = Readonly<{
  rows: readonly SourceExpressionNode[];
  /** A continuation equality reuses the preceding left side; it does not invent another glyph. */
  continuationRows: readonly number[];
}>;

/** Additional source constructions are admitted by the display's authored operation guide. */
export type SourceExpressionOptions = Readonly<{
  /** Independent relations separated by &\\qquad inside an aligned environment. */
  allowAlignedColumns?: boolean;
  /** A = B < C has a final strict relation on this same left side. */
  allowTerminalStrictBound?: boolean;
  /** A source-authored list of standalone expressions, separated by top-level commas. */
  allowExpressionList?: boolean;
  /** Only named quantity functions consume a following parenthesized argument. */
  functionQuantities?: readonly string[];
  /** Explicit argument counts; zero admits the field without its arguments in a derivative. */
  functionArities?: Readonly<Record<string, readonly number[]>>;
  /** Definite integrals and matched first/higher partial derivatives, never formal d fractions. */
  allowCalculus?: boolean;
  /** The printed e with an exponent denotes exp, not an unbound physical quantity. */
  allowExponentials?: boolean;
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
  const atoms = new Map(printedAtoms(display.latex).map((atom) => [atom.start, atom]));
  const bound: Lexeme[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const term = terms.get(item.start);
    if (!term) {
      bound.push(item);
      continue;
    }
    // A scripted name followed by a power is marked only around its base to preserve MathML.
    // Parse the whole checked name, as identified by the same owner that chose that mark.
    const atom = atoms.get(term.start);
    const end =
      atom?.markEnd === term.end && atom.signature === glyphSignature(term.glyph)
        ? atom.end
        : term.end;
    bound.push({ value: term.glyph, start: term.start, end, term });
    while (items[i + 1] && items[i + 1]!.start < end) i++;
  }
  return bound;
}

class RowParser {
  private index = 0;
  constructor(
    private readonly display: CheckedDisplay,
    private readonly items: readonly Lexeme[],
    private readonly symbolIndices: Readonly<Record<string, string>>,
    private readonly options: SourceExpressionOptions,
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
    return {
      tree: tree.kind === "symbol" ? tree : ({ ...tree, opId } as Expression),
      start,
      end,
      parts,
      marker,
      operationId: opId,
    };
  }

  parse(
    previousLeft?: Expression,
    allowChainedRelations = false,
  ): { rows: readonly SourceExpressionNode[]; continuation: boolean } {
    const alignment = this.peek()?.value === "&";
    if (alignment) this.take("&");
    const continuation = this.peek()?.value === "=";
    const left = continuation ? undefined : this.sum();
    if (this.peek()?.value === "&") this.take("&");
    const printed = this.peek()?.value;
    const operator =
      printed === "=" ? "=" : printed === "\\leqq" ? "le" : printed === "\\geqq" ? "ge" : undefined;
    if (!operator) {
      if (!left) this.fail("Expected an expression or relation.");
      const rows = [left];
      while (this.options.allowExpressionList && this.peek()?.value === ",") {
        this.take(",");
        if (this.peek()?.value === "\\quad") this.take("\\quad");
        rows.push(this.sum());
      }
      this.finish();
      return { rows, continuation: false };
    }
    const sign = this.take();
    const leftTree = left?.tree ?? previousLeft;
    if (!leftTree) this.fail("A continuation equality needs a preceding left side.");
    const right = this.sum();
    const row = this.operation(
      { kind: "relation", operator, left: leftTree, right: right.tree },
      left?.start ?? sign.start,
      right.end,
      [...(left ? [{ name: "left", node: left }] : []), { name: "right", node: right }],
      sign,
    );
    const rows = [row];
    // A = B = C means both A = B and A = C. Only the new right side and equals sign
    // are printed again: reusing A's tree must not invent another physical term occurrence.
    // A separately admitted A = B < C similarly states A < C. The bound must end the chain.
    while (
      operator === "=" &&
      ((allowChainedRelations && this.peek()?.value === "=") ||
        (this.options.allowTerminalStrictBound && rows.length === 1 && this.peek()?.value === "<"))
    ) {
      const nextSign = this.take();
      const nextRight = this.sum();
      rows.push(
        this.operation(
          {
            kind: "relation",
            operator: nextSign.value === "<" ? "<" : "=",
            left: leftTree,
            right: nextRight.tree,
          },
          nextSign.start,
          nextRight.end,
          [{ name: "right", node: nextRight }],
          nextSign,
        ),
      );
      if (nextSign.value === "<") break;
    }
    this.finish();
    return { rows, continuation };
  }

  private finish(): void {
    if ([".", ",", ";"].includes(this.peek()?.value ?? "")) this.take();
    if (this.peek()) this.fail(`Unsupported token ${this.peek()!.value}.`);
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
        ["{", "(", "[", "\\left", "\\frac", "\\sqrt", "\\cos", "\\sin", "\\lg", "\\pi"].includes(
          next.value,
        ) ||
        (this.options.allowCalculus && next.value === "\\int") ||
        (this.options.allowExponentials && next.value === "e"))
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

  /** A derivative order is an integer syntax marker, not a second physical power. */
  private derivativeOrder(): number {
    if (this.peek()?.value !== "^") return 1;
    this.take("^");
    const braced = this.peek()?.value === "{";
    if (braced) this.take("{");
    const order = this.take();
    if (!/^[1-9]$/.test(order.value))
      this.fail("A partial derivative needs a positive integer order.");
    if (braced) this.take("}");
    return Number(order.value);
  }

  private derivative(start: number): SourceExpressionNode {
    this.take("{");
    this.take("\\partial");
    const order = this.derivativeOrder();
    const expression = this.sum();
    this.take("}");
    this.take("{");
    this.take("\\partial");
    // The denominator names the differentiation variable; its superscript records order.
    // Consuming it as an ordinary power would silently turn a derivative into a quotient.
    const variable = this.atom();
    if (variable.tree.kind !== "symbol" || variable.tree.at || variable.tree.args)
      this.fail("A partial derivative must name one bound differentiation variable.");
    const denominatorOrder = this.derivativeOrder();
    if (order !== denominatorOrder) this.fail("The partial derivative orders must agree.");
    const close = this.take("}");
    return this.operation(
      {
        kind: "derivative",
        expression: expression.tree,
        variable: variable.tree,
        order,
        partial: true,
      },
      start,
      close.end,
      [
        { name: "expression", node: expression },
        { name: "variable", node: variable },
      ],
    );
  }

  /** Infinity is admitted only as an integration endpoint, never as an arithmetic operand. */
  private integralBound(): SourceExpressionNode {
    const braced = this.peek()?.value === "{";
    if (braced) this.take("{");
    const sign = ["-", "+"].includes(this.peek()?.value ?? "") ? this.take() : undefined;
    let node: SourceExpressionNode;
    if (this.peek()?.value === "\\infty") {
      const token = this.take();
      node = {
        tree: { kind: "constant", name: "infinity" },
        start: token.start,
        end: token.end,
        parts: [],
      };
    } else {
      node = this.atom();
      if (node.tree.kind !== "number" && node.tree.kind !== "symbol")
        this.fail("An integral endpoint must be a number, a bound variable or infinity.");
    }
    if (sign?.value === "-")
      node = {
        tree: { kind: "negate", argument: node.tree },
        start: sign.start,
        end: node.end,
        parts: [{ name: "argument", node }],
      };
    if (braced) this.take("}");
    return node;
  }

  private integral(start: number): SourceExpressionNode {
    this.take("_");
    const lower = this.integralBound();
    this.take("^");
    const upper = this.integralBound();
    const expression = this.sum();
    // No missing measure, guessed dummy variable, or absorbed trailing factor is accepted.
    this.take("d");
    const variable = this.atom();
    if (variable.tree.kind !== "symbol" || variable.tree.at || variable.tree.args)
      this.fail("An integral must name one bound variable after its differential d.");
    return this.operation(
      {
        kind: "integral",
        expression: expression.tree,
        variable: variable.tree,
        lower: lower.tree,
        upper: upper.tree,
      },
      start,
      variable.end,
      [
        { name: "lower", node: lower },
        { name: "upper", node: upper },
        { name: "expression", node: expression },
        { name: "variable", node: variable },
      ],
    );
  }

  private atom(): SourceExpressionNode {
    const token = this.take();
    if (token.term) {
      const tree: Extract<Expression, { kind: "symbol" }> = {
        kind: "symbol",
        termId: token.term.termId,
        quantityId: token.term.quantityId,
        ...(this.symbolIndices[token.term.glyph] !== undefined
          ? { index: this.symbolIndices[token.term.glyph] }
          : {}),
      };
      const arities =
        this.options.functionArities?.[token.term.quantityId] ??
        (this.options.functionQuantities?.includes(token.term.quantityId) ? [1] : undefined);
      if (arities && (this.peek()?.value === "(" || !arities.includes(0))) {
        // A declared quantity such as psi(v) is evaluated at v; multiplying psi by v
        // would change both its physical meaning and its dimensions. Its source glyph
        // still owns one term, and the argument owns its own term and operations.
        this.take("(");
        const args = [this.sum()];
        while (this.peek()?.value === ",") {
          this.take(",");
          if (args.length >= 4) this.fail("A quantity function accepts at most four arguments.");
          args.push(this.sum());
        }
        const close = this.take(")");
        if (!arities.includes(args.length))
          this.fail("The quantity function has an unauthored argument count.");
        return this.operation(
          args.length === 1
            ? { ...tree, at: args[0]!.tree }
            : { ...tree, args: args.map((arg) => arg.tree) },
          token.start,
          close.end,
          args.map((node, i) => ({ name: args.length === 1 ? "at" : `args.${i}`, node })),
        );
      }
      return {
        tree,
        start: token.start,
        end: token.end,
        parts: [],
      };
    }
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
    if (token.value === "\\pi")
      return {
        tree: { kind: "constant", name: "pi" },
        start: token.start,
        end: token.end,
        parts: [],
      };
    if (token.value === "\\frac") {
      if (
        this.options.allowCalculus &&
        this.peek()?.value === "{" &&
        this.items[this.index + 1]?.value === "\\partial"
      )
        return this.derivative(token.start);
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
    if (token.value === "\\int" && this.options.allowCalculus) return this.integral(token.start);
    if (token.value === "e" && this.options.allowExponentials) {
      this.take("^");
      const argument = this.peek()?.value === "{" ? this.argument() : this.unbracedExponent();
      return this.operation(
        { kind: "function", name: "exp", argument: argument.node.tree },
        token.start,
        argument.end,
        [{ name: "argument", node: argument.node }],
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
    if (token.value === "\\cos" || token.value === "\\sin" || token.value === "\\lg") {
      const argument = this.unary();
      return this.operation(
        {
          kind: "function",
          name: token.value === "\\lg" ? "ln" : token.value === "\\sin" ? "sin" : "cos",
          argument: argument.tree,
        },
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
  allowChainedRelations = false,
  options: SourceExpressionOptions = {},
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
  // Preserve physical rows so a later equality cannot accidentally inherit a left side
  // from the other column. The delimiter is opted in exactly as printed; \quad and a bare
  // alignment tab still belong to the ordinary grammar and are not guessed to be separators.
  const lines: Lexeme[][][] = [[[]]];
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    if (aligned && item.value === "\\\\") lines.push([[]]);
    else if (
      aligned &&
      options.allowAlignedColumns &&
      item.value === "&" &&
      items[index + 1]?.value === "\\qquad"
    ) {
      lines.at(-1)!.push([]);
      index++;
    } else lines.at(-1)!.at(-1)!.push(item);
  }
  const rows: SourceExpressionNode[] = [];
  const continuationRows: number[] = [];
  let previousLineHadColumns = false;
  for (const line of lines) {
    const independent = line.length > 1;
    for (const column of line) {
      const previous = independent || previousLineHadColumns ? undefined : rows.at(-1)?.tree;
      const parsed = new RowParser(display, column, symbolIndices, options).parse(
        previous?.kind === "relation" ? previous.left : undefined,
        allowChainedRelations,
      );
      if (independent && parsed.rows.some((row) => row.tree.kind !== "relation"))
        throw new SourceExpressionError(
          "printed-expression-unsupported",
          display.display,
          column[0]?.start ?? display.latex.length,
          "Each aligned column must contain an independent relation.",
        );
      if (parsed.continuation) continuationRows.push(rows.length);
      for (let i = 1; i < parsed.rows.length; i++) {
        if (parsed.rows[i]!.tree.kind === "relation") continuationRows.push(rows.length + i);
      }
      rows.push(...parsed.rows);
    }
    previousLineHadColumns = independent;
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
