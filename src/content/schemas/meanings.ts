/**
 * Canonical enums, vocabularies, and Four Meanings contract.
 * Specification: AGENTS.md (§5.1, §5.2, §6.2–6.6, §11.2, §11.4, §11.5, §11.6) and am-cm-schemas-argument-llm
 */

export const EQUATION_SCHEMA_VERSION = 1;

// 1. Four Kinds of Meaning
export const LOGICAL_ROLES = [
  "definition",
  "assumption",
  "derivation",
  "heuristic-inference",
  "empirical-observation",
  "qualification",
] as const;
export type LogicalRole = (typeof LOGICAL_ROLES)[number];

export const HISTORICAL_STATUSES = [
  "available-before-cutoff",
  "introduced-in-current-paper",
  "later-development",
  "pedagogical-reconstruction",
] as const;
export type HistoricalStatus = (typeof HISTORICAL_STATUSES)[number];

export const MODEL_STATUSES = [
  "exact-within-model",
  "approximation",
  "idealized-representation",
  "calibrated-empirical-model",
  "unsupported-outside-domain",
] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

export const EXECUTION_STATUSES = [
  "static-illustration",
  "host-calculation",
  "accepted-frankensim-result",
  "unavailable-or-refused",
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export type FourMeanings = Readonly<{
  logicalRole: LogicalRole;
  historicalStatus: HistoricalStatus;
  modelStatus: ModelStatus;
  executionStatus: ExecutionStatus;
}>;

// 2. Knowledge Card Historical Statements
export const PREMISE_STATUSES = ["available", "parallel-work", "later"] as const;
export type PremiseStatus = (typeof PREMISE_STATUSES)[number];

// 3. Edges, Proofs, and Evidence
export const PREMISE_EDGE_TYPES = [
  "historical-derivation",
  "modern-verification-oracle",
  "cross-reference",
  "pedagogical-reconstruction",
] as const;
export type PremiseEdgeType = (typeof PREMISE_EDGE_TYPES)[number];

export const PROOF_EDGE_KINDS = ["proof-edge", "cross-link"] as const;
export type ProofEdgeKind = (typeof PROOF_EDGE_KINDS)[number];

export const EVIDENCE_RELATIONS = ["supports", "tests", "contradicts"] as const;
export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

export const PROOF_ROUTES = [
  "source-order",
  "discovery",
  "pedagogical-reconstruction",
  "modern-verification",
] as const;
export type ProofRoute = (typeof PROOF_ROUTES)[number];

// 4. Quantities & Dimensions
export const MATHEMATICAL_KINDS = ["scalar", "vector", "vector-component", "matrix"] as const;
export type MathematicalKind = (typeof MATHEMATICAL_KINDS)[number];

export const DENSITY_KINDS = ["density", "total", "not-applicable"] as const;
export type DensityKind = (typeof DENSITY_KINDS)[number];

export const DENSITY_PER_KINDS = [
  "volume",
  "area",
  "length",
  "frequency-interval",
  "wavelength-interval",
  "log-interval",
  "displacement",
  "solid-angle",
  "time",
] as const;
export type DensityPerKind = (typeof DENSITY_PER_KINDS)[number];

export const SPECTRAL_BASES = [
  "per-frequency",
  "per-wavelength",
  "per-log-interval",
  "none",
] as const;
export type SpectralBasis = (typeof SPECTRAL_BASES)[number];

export const FREQUENCY_KINDS = ["cyclic", "angular", "not-applicable"] as const;
export type FrequencyKind = (typeof FREQUENCY_KINDS)[number];

export const TIME_KINDS = ["coordinate", "proper", "not-applicable"] as const;
export type TimeKind = (typeof TIME_KINDS)[number];

export const FRAMES = [
  "stationary-system",
  "moving-system",
  "object-rest",
  "laboratory",
  "frame-independent",
  "not-applicable",
] as const;
export type Frame = (typeof FRAMES)[number];

export const OBSERVATION_KINDS = ["measured", "latent", "not-applicable"] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

export const STATISTICS = [
  "mean",
  "mean-square",
  "variance",
  "standard-deviation",
  "rms",
  "none",
] as const;
export type Statistic = (typeof STATISTICS)[number];

export const DIMENSIONLESS_KINDS = [
  "angle",
  "hyperbolic-angle",
  "ratio",
  "count",
  "probability",
  "pure-number",
] as const;
export type DimensionlessKind = (typeof DIMENSIONLESS_KINDS)[number];

export const DIMENSION_STATUSES = ["declared", "state-dependent", "undefined-in-source"] as const;
export type DimensionStatus = (typeof DIMENSION_STATUSES)[number];

export const COLOR_ROLES = [
  "energy",
  "time-rate",
  "space-geometry",
  "material",
  "statistical",
  "field",
  "quanta",
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export const UNIT_SYSTEMS = ["si", "gaussian-cgs", "emu-cgs"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

// 5. Obstacle Kinds (CamelCase IDs ONLY, exported in canonical order)
// Note: exampleFirst is deliberately NOT in OBSTACLE_KIND_IDS as it is a worked-example reference, not an obstacle category.
export const OBSTACLE_KIND_IDS = [
  "unfamiliarWordOrSymbol",
  "algebraicMove",
  "physicalReason",
  "connectionToPicture",
  "purposeOfCalculation",
  "tooMuchAtOnce",
] as const;
export type ObstacleKindId = (typeof OBSTACLE_KIND_IDS)[number];

// 6. Reading Targets & Modern Relations
export const READING_TARGET_KINDS = [
  "paragraph",
  "heading",
  "footnote",
  "closing",
  "equation",
  "derivation-step",
  "instrument-caption",
] as const;
export type ReadingTargetKind = (typeof READING_TARGET_KINDS)[number];

export const MODERN_RELATIONS = ["rename-only", "unit-conversion", "modernization"] as const;
export type ModernRelation = (typeof MODERN_RELATIONS)[number];

export const NOTATION_MODES = ["generated", "authored"] as const;
export type NotationMode = (typeof NOTATION_MODES)[number];

export const FOUNDATION_KINDS = ["foundation", "bridge"] as const;
export type FoundationKind = (typeof FOUNDATION_KINDS)[number];

export const CONTINUE_WITH_ROUTES = ["more-guidance", "less-guidance"] as const;
export type ContinueWithRoute = (typeof CONTINUE_WITH_ROUTES)[number];
