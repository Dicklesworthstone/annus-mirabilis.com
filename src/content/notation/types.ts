/**
 * Canonical types and schemas for the Scoped Notation Concordance.
 * Specification: AGENTS.md, am-not-concordance-model-uag, am-not-entries-brownian-1rq.
 */

export * from "../schemas/concordance.ts";

import type { ConcordanceEntry, RationalScale } from "../schemas/concordance.ts";

export type ResolveGlyphError = "unknownAnchor" | "unknownPaper" | "unscoped" | "ambiguous";

export type ResolveGlyphResult =
  | { readonly ok: true; readonly entry: ConcordanceEntry }
  | { readonly ok: false; readonly error: ResolveGlyphError; readonly message: string };

export interface PaperManifestIndex {
  readonly paper: string;
  readonly document?: string | undefined;
  readonly unitToSection: ReadonlyMap<string, string>;
  readonly sectionToUnits: ReadonlyMap<string, readonly string[]>;
  readonly allAnchors: ReadonlySet<string>;
  readonly sections: ReadonlySet<string>;
}

export interface SourceManifestIndex {
  readonly papers: ReadonlyMap<string, PaperManifestIndex>;
  getSectionForAnchor(paper: string, anchor: string): string | undefined;
  hasAnchor(paper: string, anchor: string): boolean;
  hasPaper(paper: string): boolean;
  getSectionAnchors(paper: string, sectionId: string): readonly string[];
}

export interface ModernGroupRename {
  readonly entryId: string;
  readonly printedGroup: string;
  readonly modernGroup: string;
  readonly scale?: RationalScale | undefined;
}

export type ConcordanceDiagnosticRule =
  | "modern-glyph-collision"
  | "cross-toggle-unflagged"
  | "same-scope-modern-only-printed-clash"
  | "scope-overlap"
  | "scaled-rename-mismatch"
  | "unit-conversion-invalid-system"
  | "collision-missing-first-use"
  | "collision-targets-empty"
  | "unknown-quantity-id"
  | "duplicate-entry-id"
  | "empty-concordance";

export interface ConcordanceDiagnostic {
  readonly severity: "error" | "warning";
  readonly rule: ConcordanceDiagnosticRule;
  readonly paper: string;
  readonly entryId?: string | undefined;
  readonly glyph?: string | undefined;
  readonly scope?: string | undefined;
  readonly message: string;
  readonly repair?: string | undefined;
}

export interface ConcordanceValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly ConcordanceDiagnostic[];
}
