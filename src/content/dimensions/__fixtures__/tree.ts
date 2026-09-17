/**
 * Minimal typed test tree for the dimension validator. Node kinds match the
 * planned expression-tree bead; that bead replaces this adapter when it lands.
 * Bead: am-cm-dimension-validator-aoz
 */

export type ExactRational = Readonly<{ num: number | bigint; den: number | bigint }>;

export type DimensionTree =
  | Readonly<{
      kind: "symbol";
      quantityId: string;
      id?: string;
      glyph?: string;
      scale?: ExactRational;
    }>
  | Readonly<{ kind: "number"; value: string }>
  | Readonly<{ kind: "constant"; name: string }>
  | Readonly<{ kind: "sum" | "product"; args: readonly DimensionTree[] }>
  | Readonly<{ kind: "quotient"; numerator: DimensionTree; denominator: DimensionTree }>
  | Readonly<{ kind: "power"; base: DimensionTree; exponent: ExactRational | DimensionTree }>
  | Readonly<{ kind: "root"; radicand: DimensionTree; degree?: number }>
  | Readonly<{ kind: "negate" | "average" | "group"; argument: DimensionTree }>
  | Readonly<{
      kind: "function";
      name: string;
      argument: DimensionTree;
    }>
  | Readonly<{
      kind: "relation";
      operator?: string;
      left: DimensionTree;
      right: DimensionTree;
    }>
  | Readonly<{
      kind: "derivative";
      expression: DimensionTree;
      variable: DimensionTree;
      order?: number;
    }>
  | Readonly<{ kind: "integral"; expression: DimensionTree; variable: DimensionTree }>
  | Readonly<{
      kind: "conversion";
      argument: DimensionTree;
      from: string;
      to: string;
    }>
  | Readonly<{
      kind: "matrix";
      targetDimensions?: readonly string[];
    }>;

export const sym = (quantityId: string, id?: string): DimensionTree => ({
  kind: "symbol",
  quantityId,
  id: id ?? `t.${quantityId}`,
});

export const glyphOnly = (glyph: string): { kind: "symbol"; glyph: string } => ({
  kind: "symbol",
  glyph,
});

export const num = (value: string | number): DimensionTree => ({
  kind: "number",
  value: String(value),
});

export const prod = (...args: DimensionTree[]): DimensionTree => ({ kind: "product", args });
export const quot = (numerator: DimensionTree, denominator: DimensionTree): DimensionTree => ({
  kind: "quotient",
  numerator,
  denominator,
});
export const sum = (...args: DimensionTree[]): DimensionTree => ({ kind: "sum", args });
export const root = (radicand: DimensionTree, degree = 2): DimensionTree => ({
  kind: "root",
  radicand,
  degree,
});
export const pow = (
  base: DimensionTree,
  exponent: ExactRational | DimensionTree,
): DimensionTree => ({
  kind: "power",
  base,
  exponent,
});
export const fn = (name: string, argument: DimensionTree): DimensionTree => ({
  kind: "function",
  name,
  argument,
});
export const rel = (left: DimensionTree, right: DimensionTree, op = "="): DimensionTree => ({
  kind: "relation",
  operator: op,
  left,
  right,
});
export const deriv = (
  expression: DimensionTree,
  variable: DimensionTree,
  order = 1,
): DimensionTree => ({
  kind: "derivative",
  expression,
  variable,
  order,
});
export const integral = (expression: DimensionTree, variable: DimensionTree): DimensionTree => ({
  kind: "integral",
  expression,
  variable,
});
export const conversion = (argument: DimensionTree, from: string, to: string): DimensionTree => ({
  kind: "conversion",
  argument,
  from,
  to,
});
export const matrix = (targetDimensions?: readonly string[]): DimensionTree =>
  targetDimensions ? { kind: "matrix", targetDimensions } : { kind: "matrix" };
