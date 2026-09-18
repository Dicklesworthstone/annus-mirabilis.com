/**
 * Types and interfaces for LaTeX generation (am-eq-latex-generation-hc3).
 */

import type { Expression } from "../ast.ts";
import type { QuantityRegistry } from "../quantities.ts";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import type { SourceManifestIndex } from "../../content/notation/types.ts";
import type { AlternateForm } from "../alternateForms.ts";

export type RenderPerspective = "source" | "modern";
export type RenderMode = "plain" | "colorized";

export interface RenderLatexOptions {
  /**
   * Perspective: 'source' (printed 1905 notation) or 'modern' (concordance renames).
   * Defaults to 'source'.
   */
  readonly perspective?: RenderPerspective | undefined;
  readonly mode?: RenderMode | undefined;
  readonly marked?: boolean | undefined;
  readonly paper?: string | undefined;
  readonly sectionId?: string | undefined;
  readonly anchor?: string | undefined;
  readonly equationId?: string | undefined;
  readonly concordance?: PaperConcordance | readonly PaperConcordance[] | undefined;
  readonly manifestIndex?: SourceManifestIndex | undefined;
  readonly registry?: QuantityRegistry | undefined;
  readonly strictConcordance?: boolean | undefined;

  /**
   * Optional alternate form to render (e.g. unit-conversion or modernization).
   */
  readonly alternateForm?: AlternateForm | undefined;

  /**
   * Callback invoked when a concordance operation is applied during rendering.
   */
  readonly onAppliedOperation?: ((entryId: string, operation: string) => void) | undefined;
}

export type EquationFormSelector =
  | { readonly kind: "printed" }
  | { readonly kind: "modern" }
  | { readonly kind: "alternate"; readonly id: string };

export type RenderColorMode = "plain" | "colorized";

export type FormRelation = "printed" | "rename-only" | "unit-conversion" | "modernization";

export interface Span {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly termId?: string | undefined;
  readonly opId?: string | undefined;
}

export interface AppliedOperation {
  readonly entryId: string;
  readonly operation: string;
}

export interface RenderEquationLatexInput {
  readonly equation: {
    readonly id: string;
    readonly paper: string;
    readonly sectionId?: string | undefined;
    readonly anchor?: string | undefined;
    readonly tree: Expression;
    readonly alternateForms?: readonly AlternateForm[] | undefined;
    readonly [key: string]: unknown;
  };
  readonly form: EquationFormSelector;
  readonly color: RenderColorMode;
  readonly concordance?: PaperConcordance | readonly PaperConcordance[] | undefined;
  readonly registry?: QuantityRegistry | undefined;
}

export interface RenderEquationLatexResult {
  readonly latex: string;
  readonly termSpans: readonly Span[];
  readonly opSpans: readonly Span[];
  readonly formRelation: FormRelation;
  readonly appliedOperations: readonly AppliedOperation[];
  readonly warnings: readonly string[];
}

export type NotationScopeErrorKind =
  | "missing-entry"
  | "missing-scope"
  | "unknown-paper"
  | "glyph-collision";

export class NotationScopeError extends Error {
  readonly equationId?: string | undefined;
  readonly symbol?: string | undefined;
  readonly paper?: string | undefined;
  readonly scope?: string | undefined;
  readonly kind: NotationScopeErrorKind;

  constructor(options: {
    message: string;
    kind: NotationScopeErrorKind;
    equationId?: string | undefined;
    symbol?: string | undefined;
    paper?: string | undefined;
    scope?: string | undefined;
  }) {
    super(options.message);
    this.name = "NotationScopeError";
    this.kind = options.kind;
    this.equationId = options.equationId;
    this.symbol = options.symbol;
    this.paper = options.paper;
    this.scope = options.scope;
  }
}
