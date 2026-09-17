/**
 * Type definitions and contracts for machine-readable exports (/exports/v1/).
 *
 * Spec: AGENTS.md, am-cm-machine-readable-exports-xgy, and docs/EXPORTS.md.
 */

export const EXPORT_SCHEMA_VERSION = 1 as const;

export type ExportFormat = "json" | "markdown" | "xml" | "tsv";

export type ContentLayer =
  | "german-text"
  | "translation"
  | "explanatory-prose"
  | "code"
  | "scan"
  | "dataset";

export type RatificationStatus =
  | "delegated-not-owner-ratified"
  | "owner-ratified"
  | "statutory-public-domain";

export interface RightsStatement {
  readonly layer: ContentLayer;
  readonly status: string;
  readonly statement: string;
  readonly license?: string | undefined;
  readonly basis?: string | undefined;
  readonly recordedAt?: string | undefined;
  readonly copyright?: string | undefined;
  readonly credit?: string | undefined;
  readonly decisionRef?: string | undefined;
  readonly ratificationStatus?: RatificationStatus | undefined;
}

export interface LayerRights {
  readonly germanText?: RightsStatement;
  readonly translation?: RightsStatement;
  readonly explanatoryProse?: RightsStatement;
  readonly code?: RightsStatement;
  readonly dataset?: RightsStatement;
}

export interface ExportDateEntry {
  readonly type: string;
  readonly text?: string;
  readonly earliest?: string;
  readonly latest?: string;
  readonly precision?: string;
  readonly source?: string;
  readonly verifiedAt?: string;
}

export interface PaperExportSectionRef {
  readonly id: string;
  readonly title: string;
  readonly arguments?: readonly string[];
  readonly exportJsonUrl: string;
  readonly exportMarkdownUrl: string;
}

export interface PaperExport {
  readonly schemaVersion: 1;
  readonly slug: string;
  readonly bibKey: string;
  readonly titleGerman: string;
  readonly titleEnglishWorking: string;
  readonly authorLine: string;
  readonly dates: readonly ExportDateEntry[];
  readonly journal: {
    readonly name: string;
    readonly series: number;
    readonly volume: number;
    readonly wholeSeriesVolume: number;
    readonly issue: string | number;
    readonly pages: { readonly first: number; readonly last: number };
    readonly doi: string;
    readonly doiVerifiedAt: string;
  };
  readonly sections: readonly PaperExportSectionRef[];
  readonly rights: LayerRights;
  readonly contentRevision: string;
  readonly sourceAssetDigest?: string | undefined;
  readonly links: {
    readonly self: string;
    readonly jsonld: string;
    readonly tei: string;
    readonly parallelCorpus: string;
  };
}

export interface SectionSentenceExport {
  readonly id: string;
  readonly german: string;
  readonly english?: string | undefined;
  readonly sourceBlockId: string;
  readonly translationUnitId?: string | undefined;
  readonly reviewState?: string | undefined;
  readonly draft?: boolean | undefined;
}

export interface SectionBlockExport {
  readonly id: string;
  readonly kind: string;
  readonly order: number;
  readonly diplomaticText: string;
  readonly locators: readonly {
    readonly pdfPageIndex: number;
    readonly printedPage: number;
  }[];
  readonly translation?: string | undefined;
  readonly equationId?: string | undefined;
}

export interface SectionReadingBlockExport {
  readonly kind: string;
  readonly text?: string;
  readonly latex?: string;
  readonly spoken?: string;
  readonly items?: readonly string[];
  readonly id?: string;
  readonly returnCaption?: string;
}

export interface SectionExport {
  readonly schemaVersion: 1;
  readonly paperSlug: string;
  readonly sectionId: string;
  readonly title: string;
  readonly sentences: readonly SectionSentenceExport[];
  readonly blocks: readonly SectionBlockExport[];
  readonly readings?:
    | {
        readonly overview?: readonly SectionReadingBlockExport[] | undefined;
        readonly full?: readonly SectionReadingBlockExport[] | undefined;
        readonly steps?: readonly SectionReadingBlockExport[] | undefined;
        readonly margin?: readonly SectionReadingBlockExport[] | undefined;
      }
    | undefined;
  readonly footnotes?:
    | readonly {
        readonly id: string;
        readonly text: string;
      }[]
    | undefined;
  readonly editorialNotes?:
    | readonly {
        readonly id: string;
        readonly title: string;
        readonly text: string;
      }[]
    | undefined;
  readonly reviewState?: string | undefined;
  readonly draft?: boolean | undefined;
  readonly rights: LayerRights;
  readonly contentRevision: string;
  readonly translationRevision?: number | undefined;
  readonly sourceAssetDigest?: string | undefined;
}

export interface EquationExport {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly paper: string;
  readonly section?: string;
  readonly argument?: string;
  readonly title: string;
  readonly latexSource?: string;
  readonly latexModern: string;
  readonly spoken: string;
  readonly explanation: string;
  readonly quantityIds: readonly string[];
  readonly operationIds?: readonly string[];
  readonly derivations?: readonly string[];
  readonly rights: LayerRights;
  readonly contentRevision: string;
}

export interface ArgumentExport {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly paper: string;
  readonly section: string;
  readonly title: string;
  readonly question: string;
  readonly recap: string;
  readonly premises: readonly string[];
  readonly limitations: readonly string[];
  readonly evidence?: readonly string[];
  readonly conclusion?: string;
  readonly meaning: {
    readonly logicalRole: string;
    readonly historicalStatus: string;
    readonly modelStatus: string;
    readonly executionStatus: string;
  };
  readonly experiments?: readonly string[];
  readonly citations?: readonly string[];
  readonly rights: LayerRights;
  readonly contentRevision: string;
}

export interface ExperimentExportParameter {
  readonly id: string;
  readonly name: string;
  readonly unit?: string;
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
}

export interface ExperimentExportMeasurement {
  readonly id: string;
  readonly name: string;
  readonly unit?: string;
}

export interface ExperimentExport {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly paper: string;
  readonly title: string;
  readonly kind: string;
  readonly description?: string;
  readonly parameters: readonly ExperimentExportParameter[];
  readonly measurements?: readonly ExperimentExportMeasurement[];
  readonly historicalBasis?: string;
  readonly rights: LayerRights;
  readonly contentRevision: string;
}

export interface ExportIndexEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly schemaVersion: 1;
  readonly contentRevision: string;
  readonly format: ExportFormat;
  readonly mimeType: string;
  readonly description: string;
}

export interface ExportIndex {
  readonly schemaVersion: 1;
  readonly contentRevision: string;
  readonly releaseProfile: string;
  readonly files: readonly ExportIndexEntry[];
}
