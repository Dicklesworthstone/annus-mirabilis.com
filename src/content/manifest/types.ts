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
  readonly occurrenceId?: string | undefined;
  readonly printedText?: string | undefined;
  readonly kind?: "bibliographic" | "internal" | "cross-paper" | undefined;
  readonly target?:
    | {
        readonly citationId?: string | undefined;
        readonly id?: string | undefined;
        readonly paper?: string | undefined;
      }
    | undefined;
  readonly targetCitationId?: string | undefined;
  readonly text?: string | undefined;
}

export const MANIFEST_UNIT_KINDS = [
  "masthead",
  "masthead-title",
  "masthead-author",
  "heading",
  "part-heading",
  "section-heading",
  "paragraph",
  // am-xz2d decision 1, owner ruling 2026-09-20, verbatim option "Add a sentence kind":
  // a sentence is a unit in its own right (id `s<n>-p<m>-s<k>`, contained in its
  // paragraph), not a list of ids hanging off the paragraph. The inventories named this
  // gap themselves - see `unfrozenRequiredUnitKinds` in the special-relativity manifest.
  "sentence",
  "equation",
  "display-equation",
  "inline-equation",
  "footnote",
  "citation",
  "closing-dateline",
  "closing-ack",
  "closing-received",
  "closing",
] as const;

export type ManifestUnitKind = (typeof MANIFEST_UNIT_KINDS)[number] | (string & {});

/**
 * The four canonical source layers of an edition.
 * AGENTS.md and am-cm-source-manifest-6qa:
 * - "ledger": diplomatic transcription / reviewed German ledger scan
 * - "transcription": authored German edition source blocks
 * - "translation": aligned English translation units
 * - "gloss": word-level German-to-English gloss units
 */
export const SOURCE_LAYER_KINDS = ["ledger", "transcription", "translation", "gloss"] as const;

export type SourceLayerKind = (typeof SOURCE_LAYER_KINDS)[number];

export type AbsentSourceLayerReason =
  | "no-reviewed-ledger"
  | "transcription-not-started"
  | "translation-not-started"
  | "gloss-not-started"
  | "waiting-on-cloud-ocr"
  | "not-yet-available";

export type SourceLayerState =
  | {
      readonly layer: SourceLayerKind;
      readonly state: "absent";
      readonly reason: AbsentSourceLayerReason | string;
      readonly available: false;
      readonly unitCount: 0;
    }
  | {
      readonly layer: SourceLayerKind;
      readonly state: "present";
      readonly status: "draft" | "proofed" | "reviewed" | "accepted";
      readonly available: true;
      readonly unitCount: number;
    };

export type PaperSourceLayers = Readonly<Record<SourceLayerKind, SourceLayerState>>;

export interface UnitDerivedStatuses {
  readonly transcription: "absent" | "not-started" | "draft" | "proofed" | "reviewed";
  readonly mathTranscription:
    | "absent"
    | "not-started"
    | "draft"
    | "proofed"
    | "reviewed"
    | "not-applicable";
  readonly translation: "absent" | "not-started" | "draft" | "aligned" | "reviewed";
  readonly review: "absent" | "draft" | "in-progress" | "reviewed" | "accepted";
}

export interface ManifestUnit {
  readonly id: string;
  readonly kind: ManifestUnitKind;
  readonly document?: string | undefined;
  readonly section?: string | undefined;
  readonly locators: readonly ManifestLocator[];
  readonly containedIn?: string | undefined; // For display equations
  readonly originalLabel?: string | undefined;
  readonly editorialLabel?: string | undefined;
  readonly references?: readonly ManifestUnitReference[] | undefined;
  readonly destination?:
    | {
        readonly editionBlockId?: string | undefined;
        readonly translationUnits?: readonly string[] | undefined;
        readonly argumentObligations?: readonly string[] | undefined;
        readonly notes?: readonly string[] | undefined;
      }
    | string
    | undefined;
  readonly status?: string | undefined; // e.g. "reviewed", "draft", "proofed", "not-started"
  readonly scope?: "in-scope" | "not-in-scope" | undefined;
  readonly notInScopeReason?: string | undefined;
  readonly footnoteMark?: string | undefined;
  readonly unmarked?: boolean | undefined;
  readonly unmarkedReason?: string | undefined;
  readonly isSplitFootnote?: boolean | undefined;
  readonly markPage?: number | undefined;
  readonly printedForm?: string | undefined;
  readonly derivedStatuses?: UnitDerivedStatuses | undefined;
}

export interface SourceManifestExport {
  readonly id?: string | undefined;
  readonly resultId?: string | undefined;
  readonly blockIds?: readonly string[] | undefined;
  readonly equationIds?: readonly string[] | undefined;
  readonly statement: string;
  readonly printedForm: string;
  readonly section?: string | undefined;
}

export interface SourceManifestImport {
  readonly paper?: string | undefined;
  readonly fromPaper?: string | undefined;
  readonly resultId: string;
  readonly use: "premise" | "comparison";
}

export interface SourceManifest {
  readonly paper: string; // Paper slug e.g. "light-quanta"
  readonly document: string; // Bibliographic key e.g. "ap-17-132"
  readonly documents?: readonly string[] | undefined;
  readonly figures?: "none" | undefined;
  readonly status: "complete" | "in-preparation" | "scoped";
  readonly scope?: "full-document" | "selected-sections" | undefined;
  readonly pageCount: number;
  readonly pageRange: readonly [number, number]; // [firstPage, lastPage] inclusive
  readonly pageMap?: readonly unknown[] | undefined;
  readonly idsFrozenAt?: string | undefined;
  readonly frozenBy?: string | undefined;
  readonly units: readonly ManifestUnit[];
  readonly exports?: readonly SourceManifestExport[] | undefined;
  readonly exportedResults?: readonly SourceManifestExport[] | undefined;
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
  readonly layers: PaperSourceLayers;
}
