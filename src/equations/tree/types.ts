/**
 * Semantic Expression Tree Node Types and Structures.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.3, §11.4, §11.5).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import type { AlternateFormId, OperationId, TermId } from "../../content/ids.ts";

export const TREE_SCHEMA_VERSION = 1 as const;

export type ExactScale = Readonly<{
  num: number;
  den: number;
}>;

export type SymbolNode = Readonly<{
  kind: "symbol";
  termId: TermId | string;
  quantityId: string;
  scale?: ExactScale | undefined;
  component?: "x" | "y" | "z" | undefined;
  role?: string | undefined;
}>;

export type ConstantNode = Readonly<{
  kind: "constant";
  name: string; // e.g. "pi"
}>;

export type NumberNode = Readonly<{
  kind: "number";
  value: string; // exact decimal string
  unit?: string | undefined;
}>;

export type SumNode = Readonly<{
  kind: "sum";
  opId?: OperationId | string | undefined;
  args: readonly Expression[];
}>;

export type ProductNode = Readonly<{
  kind: "product";
  opId?: OperationId | string | undefined;
  args: readonly Expression[];
  style?: "explicit" | "juxtaposed" | undefined;
}>;

export type QuotientNode = Readonly<{
  kind: "quotient";
  opId?: OperationId | string | undefined;
  numerator: Expression;
  denominator: Expression;
  style?: "fraction" | "solidus" | undefined;
}>;

export type PowerNode = Readonly<{
  kind: "power";
  opId?: OperationId | string | undefined;
  base: Expression;
  exponent: ExactScale | Expression;
}>;

export type RootNode = Readonly<{
  kind: "root";
  opId?: OperationId | string | undefined;
  radicand: Expression;
  degree: number; // default 2
}>;

export type NegateNode = Readonly<{
  kind: "negate";
  opId?: OperationId | string | undefined;
  argument: Expression;
}>;

export type FunctionName = "ln" | "exp" | "sin" | "cos" | "sinh" | "cosh" | "tanh" | "sqrt";

export type FunctionNode = Readonly<{
  kind: "function";
  opId?: OperationId | string | undefined;
  name: FunctionName;
  argument: Expression;
}>;

export type RelationOperator =
  | "="
  | "approx"
  | "<"
  | "<="
  | ">"
  | ">="
  | "propto"
  | "equiv"
  | "define"
  | "maps-to";

export type RelationNode = Readonly<{
  kind: "relation";
  opId?: OperationId | string | undefined;
  operator: RelationOperator;
  left: Expression;
  right: Expression;
}>;

export type DerivativeNode = Readonly<{
  kind: "derivative";
  opId?: OperationId | string | undefined;
  expression: Expression;
  variable: Expression;
  order: number;
  partial: boolean;
  heldFixed?: Expression | string | undefined;
}>;

export type IntegralNode = Readonly<{
  kind: "integral";
  opId?: OperationId | string | undefined;
  expression: Expression;
  variable: Expression;
  lowerBound?: Expression | undefined;
  upperBound?: Expression | undefined;
}>;

export type SeriesSumNode = Readonly<{
  kind: "seriesSum";
  opId?: OperationId | string | undefined;
  index: Expression | string;
  lowerBound?: Expression | undefined;
  upperBound?: Expression | undefined;
  body: Expression;
}>;

export type SeriesProductNode = Readonly<{
  kind: "seriesProduct";
  opId?: OperationId | string | undefined;
  index: Expression | string;
  lowerBound?: Expression | undefined;
  upperBound?: Expression | undefined;
  body: Expression;
}>;

export type LimitNode = Readonly<{
  kind: "limit";
  opId?: OperationId | string | undefined;
  variable: Expression;
  target: Expression;
  body: Expression;
}>;

export type AverageNode = Readonly<{
  kind: "average";
  opId?: OperationId | string | undefined;
  argument: Expression;
}>;

export type NormNode = Readonly<{
  kind: "norm";
  opId?: OperationId | string | undefined;
  argument: Expression;
}>;

export type DotProductNode = Readonly<{
  kind: "dotProduct";
  opId?: OperationId | string | undefined;
  left: Expression;
  right: Expression;
}>;

export type CrossProductNode = Readonly<{
  kind: "crossProduct";
  opId?: OperationId | string | undefined;
  left: Expression;
  right: Expression;
}>;

export type VectorNode = Readonly<{
  kind: "vector";
  opId?: OperationId | string | undefined;
  elements: readonly Expression[];
}>;

export type MatrixNode = Readonly<{
  kind: "matrix";
  opId?: OperationId | string | undefined;
  rows: readonly (readonly Expression[])[];
  targetDimensions?: readonly unknown[] | undefined;
}>;

export type PiecewiseCase = Readonly<{
  condition: Expression;
  value: Expression;
}>;

export type PiecewiseNode = Readonly<{
  kind: "piecewise";
  opId?: OperationId | string | undefined;
  cases: readonly PiecewiseCase[];
  otherwise?: Expression | undefined;
}>;

export type SeriesTruncationNode = Readonly<{
  kind: "seriesTruncation";
  opId?: OperationId | string | undefined;
  order?: string | undefined;
}>;

export type GroupNode = Readonly<{
  kind: "group";
  opId?: OperationId | string | undefined;
  argument: Expression;
}>;

export type TextAnnotationNode = Readonly<{
  kind: "textAnnotation";
  opId?: OperationId | string | undefined;
  text: string;
}>;

export type Expression =
  | SymbolNode
  | ConstantNode
  | NumberNode
  | SumNode
  | ProductNode
  | QuotientNode
  | PowerNode
  | RootNode
  | NegateNode
  | FunctionNode
  | RelationNode
  | DerivativeNode
  | IntegralNode
  | SeriesSumNode
  | SeriesProductNode
  | LimitNode
  | AverageNode
  | NormNode
  | DotProductNode
  | CrossProductNode
  | VectorNode
  | MatrixNode
  | PiecewiseNode
  | SeriesTruncationNode
  | GroupNode
  | TextAnnotationNode;

export type NodeKind = Expression["kind"];

export type LayoutHints = Readonly<{
  breaks?: readonly string[] | undefined;
  alignAt?: readonly string[] | undefined;
}>;

export type CompositeGroup = Readonly<{
  id: string;
  memberTermIds: readonly string[];
  quantityId: string;
  role?: string | undefined;
  modernSymbol?: string | undefined;
}>;

export type AlternateFormRelation = "unit-conversion" | "modernization";

export type AlternateForm = Readonly<{
  id: AlternateFormId | string;
  relation: AlternateFormRelation;
  label: string;
  tree: Expression;
  unitSystem?: Readonly<{ from: string; to: string }> | undefined;
  derivationChainId?: string | undefined;
  modernLensId?: string | undefined;
  historicalStatus?: "later-development" | undefined;
}>;

export type EquationTree = Readonly<{
  treeSchemaVersion: typeof TREE_SCHEMA_VERSION;
  root: Expression;
  layout?: LayoutHints | undefined;
  groups?: readonly CompositeGroup[] | undefined;
  alternateForms?: readonly AlternateForm[] | undefined;
}>;
