/**
 * Source Manifest Types and Interfaces.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

export interface ManifestLocator {
  readonly page: number;
  readonly column?: number | undefined;
  readonly line?: number | undefined;
  readonly region?:
    | {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      }
    | undefined;
  readonly splitPage?: boolean | undefined;
}

export interface ManifestUnitReference {
  readonly id: string;
  readonly targetCitationId?: string | undefined;
  readonly text?: string | undefined;
}

export const MANIFEST_UNIT_KINDS = [
  "masthead",
  "masthead-title",
  "masthead-author",
  "heading",
  "part-heading",
  "paragraph",
  "equation",
  "footnote",
  "citation",
  "closing-dateline",
  "closing-ack",
  "closing-received",
  "closing",
] as const;

export type ManifestUnitKind = (typeof MANIFEST_UNIT_KINDS)[number] | (string & {});

export interface ManifestUnit {
  readonly id: string;
  readonly kind: ManifestUnitKind;
  readonly section?: string | undefined;
  readonly locators: readonly ManifestLocator[];
  readonly containedIn?: string | undefined; // For display equations
  readonly originalLabel?: string | undefined;
  readonly editorialLabel?: string | undefined;
  readonly references?: readonly ManifestUnitReference[] | undefined;
  readonly destination?: string | undefined;
  readonly status?: string | undefined; // e.g. "reviewed", "draft", "proofed", "not-started"
  readonly scope?: "in-scope" | "not-in-scope" | undefined;
  readonly footnoteMark?: string | undefined;
  readonly isSplitFootnote?: boolean | undefined;
  readonly printedForm?: string | undefined;
}

export interface SourceManifestExport {
  readonly id: string;
  readonly statement: string;
  readonly printedForm: string;
  readonly section?: string | undefined;
}

export interface SourceManifestImport {
  readonly paper: string; // Paper slug or bibKey (e.g. 'special-relativity' or 'ap-17-891')
  readonly resultId: string;
  readonly use: "premise" | "comparison";
}

export interface SourceManifest {
  readonly paper: string; // Paper slug e.g. "light-quanta"
  readonly document: string; // Bibliographic key e.g. "ap-17-132"
  readonly status: "complete" | "in-preparation" | "scoped";
  readonly scope?: "full-document" | "selected-sections" | undefined;
  readonly pageCount: number;
  readonly pageRange: readonly [number, number]; // [firstPage, lastPage] inclusive
  readonly pageMap?: readonly unknown[] | undefined;
  readonly idsFrozenAt?: string | undefined;
  readonly frozenBy?: string | undefined;
  readonly units: readonly ManifestUnit[];
  readonly exports?: readonly SourceManifestExport[] | undefined;
  readonly importedResults?: readonly SourceManifestImport[] | undefined;
}

export interface ManifestDiagnostic {
  readonly severity: "error" | "flag";
  readonly rule: string;
  readonly paper: string;
  readonly document: string;
  readonly unitId?: string | undefined;
  readonly message: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly repair?: string | undefined;
  readonly file?: string | undefined;
  readonly path?: string | undefined;
}

export interface ManifestReportData {
  readonly paper: string;
  readonly document: string;
  readonly status: string;
  readonly scope: string;
  readonly pageCount: number;
  readonly pageRange: readonly [number, number];
  readonly totalUnits: number;
  readonly inScopeCount: number;
  readonly notInScopeCount: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly incompleteUnits: readonly {
    readonly id: string;
    readonly kind: string;
    readonly section?: string | undefined;
    readonly status: string;
  }[];
  readonly exportedCount: number;
  readonly importedCount: number;
}
