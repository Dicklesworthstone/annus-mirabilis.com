/**
 * Source Manifest Module Entry Point.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

export {
  registerSourceManifestCheck,
  SOURCE_MANIFEST_CHECK_ID,
} from "./check.ts";

export {
  formatManifestReportText,
  generateManifestReport,
  getAbsentSourceLayers,
  writeManifestReportJson,
} from "./report.ts";

export {
  ManifestSchemaError,
  validateSourceManifest,
} from "./schema.ts";

export {
  type AbsentSourceLayerReason,
  MANIFEST_UNIT_KINDS,
  type ManifestDiagnostic,
  type ManifestLocator,
  type ManifestReportData,
  type ManifestUnit,
  type ManifestUnitKind,
  type ManifestUnitReference,
  type PaperSourceLayers,
  SOURCE_LAYER_KINDS,
  type SourceLayerKind,
  type SourceLayerState,
  type SourceManifest,
  type SourceManifestExport,
  type SourceManifestImport,
  type UnitDerivedStatuses,
} from "./types.ts";

export {
  KNOWN_DOCUMENT_JOURNAL_RANGES,
  type ManifestValidationContext,
  type ManifestValidationResult,
  validateManifest,
  validateManifestCorpus,
} from "./validator.ts";
