/**
 * Types and interfaces for LaTeX generation (am-eq-latex-generation-hc3).
 */

import type { SourceManifestIndex } from "../../content/notation/types.ts";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import type { AlternateForm } from "../alternateForms.ts";
import type { Expression } from "../ast.ts";
import type { QuantityRegistry } from "../quantities.ts";

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
   * `quantityId#index` to a letter that replaces a symbol's glyph AND its index: Einstein printed
   * the y component of the electric force as Y, where the tree binds E with index y
   * (src/equations/notationForms.ts). A symbol not named here draws as before.
   */
  readonly componentGlyphs?: Readonly<Record<string, string>> | undefined;

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

  /**
   * The code is the FIRST argument, as a kebab-case string literal, per the am-p465 ruling.
   * The structured locators stay in a trailing options object: they are evidence about the
   * refusal, not its identity, and only the identity has to be readable by construction.
   */
  constructor(
    kind: NotationScopeErrorKind,
    message: string,
    details?: {
      equationId?: string | undefined;
      symbol?: string | undefined;
      paper?: string | undefined;
      scope?: string | undefined;
    },
  ) {
    super(message);
    this.name = "NotationScopeError";
    this.kind = kind;
    this.equationId = details?.equationId;
    this.symbol = details?.symbol;
    this.paper = details?.paper;
    this.scope = details?.scope;
  }
}
