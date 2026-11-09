import type { Expression } from "../ast.ts";

/**
 * The derivation renderer uses term ids as its authored notation. Equation records instead use
 * qualified ids and keep their notation in quantity records. Project that identity at the tree
 * boundary, never by replacing letters in LaTeX. The caller supplies every glyph explicitly;
 * quantities, exact scales, operation ids, arguments and the expression structure stay intact.
 */
export function projectDerivationSymbols(
  expression: Expression,
  glyph: (symbol: Extract<Expression, { kind: "symbol" }>) => string,
): Expression {
  function project(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(project);
    if (value === null || typeof value !== "object") return value;
    const source = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(source).map(([key, child]) => [key, project(child)]),
    );
    if (source.kind === "symbol") {
      result.termId = glyph(source as Extract<Expression, { kind: "symbol" }>);
    }
    return result;
  }
  return project(expression) as Expression;
}
