/**
 * Canonical schemas and validators for Experiment manifests, Scenarios,
 * HistoricalDatasets, Tours, and ConstantSets.
 *
 * Specification: AGENTS.md, am-cm-schemas-experiment-fuu, am-inst-parameter-controls-cmj9,
 * am-ver-scenario-registry-om3, am-inst-dataset-overlay-ra9r, am-tours-infra-g518,
 * am-ref-constants-xik, am-rt-u64-identities-7ce.
 */

import {
  type InstrumentId,
  type ModeId,
  type PredictPromptId,
  type PresetId,
  parseInstrumentId,
  parseModeId,
  parsePredictPromptId,
  parsePresetId,
  parseTapeId,
  type TapeId,
} from "../ids.ts";
import type { SourceAssetRights } from "../provenance/receiptToSourceAsset.ts";
import { type PaperDate, validatePaperDate } from "./dates.ts";
import { type Citation, validateCitation } from "./source.ts";
import { U64ValidationError, validateU64String } from "./u64String.ts";

export class ExperimentValidationError extends Error {
  readonly code: string;
  readonly entity: string;
  readonly path: string;

  constructor(code: string, message: string, entity = "ExperimentSchema", path = "root") {
    super(`[${entity}] ${path}: ${message} (${code})`);
    this.name = "ExperimentValidationError";
    this.code = code;
    this.entity = entity;
    this.path = path;
  }
}

export const EXPERIMENT_SCHEMA_VERSION = 1;

// ============================================================================
// 1. EXPERIMENT MANIFEST
// ============================================================================

export type ParameterMapping =
  | Readonly<{ kind: "linear" }>
  | Readonly<{ kind: "log"; base?: number | undefined }>
  | Readonly<{ kind: "step"; size: number }>
  | Readonly<{ kind: "step"; gridParameterId: string }>;

export type ModelDomain = Readonly<{
  min?: number | undefined;
  max?: number | undefined;
  minInclusive?: boolean | undefined;
  maxInclusive?: boolean | undefined;
  enumerated?: readonly number[] | undefined;
  reason?: string | undefined;
}>;

export type NumericalDomain = Readonly<{
  min?: number | undefined;
  max?: number | undefined;
  minInclusive?: boolean | undefined;
  maxInclusive?: boolean | undefined;
}>;

export type VisualRange = Readonly<{
  min: number;
  max: number;
}>;

export const COMMAND_CLASSES = [
  "setup-change",
  "physical-intervention",
  "observer-change",
  "measurement-change",
  "estimator-change",
  "presentation-change",
] as const;
export type CommandClass = (typeof COMMAND_CLASSES)[number];

export type ParameterSpec = Readonly<{
  id: string;
  label: string;
  accessibleName: string;
  accessibleDescription: string;
  quantityId: string;
  displayUnit: string;
  modelDomain: ModelDomain;
  numericalDomain?: NumericalDomain | undefined;
  visualRange: VisualRange;
  default: number | string;
  mapping: ParameterMapping;
  step?: number | undefined;
  role: "independent" | "derived";
  derivedFrom?: readonly string[] | undefined;
  commandClass: CommandClass;
}>;

export const OUTPUT_STATUSES = [
  "value",
  "symbolic",
  "analytic-limit",
  "underdetermined",
  "not-applicable",
  "outside-domain",
] as const;
export type OutputStatus = (typeof OUTPUT_STATUSES)[number];

export type OutputSpec = Readonly<{
  id: string;
  quantityId: string;
  allowedStatuses: readonly OutputStatus[];
  primary: boolean;
}>;

export const KERNEL_DISPLAY_ROLES = [
  "executing-source",
  "reference-implementation",
  "pseudocode",
  "derivation",
] as const;
export type KernelDisplayRole = (typeof KERNEL_DISPLAY_ROLES)[number];

export type KernelFunctionRef = Readonly<{
  displayRole: KernelDisplayRole;
  language?: "ts" | "rust" | undefined;
  module?: string | undefined;
  exportName?: string | undefined;
  crate?: string | undefined;
  path?: string | undefined;
  fnName?: string | undefined;
  revision?: string | undefined;
  independentReferences?:
    | readonly Readonly<{ experimentId: string; quantityId: string }>[]
    | undefined;
}>;

export type IdentifierBinding = Readonly<{
  kernelFunction: string;
  identifier: string;
  quantityId: string;
  termIds?: readonly string[] | undefined;
}>;

export type TraceRow = Readonly<{
  label: string;
  expression: string;
  value: number | string;
  unit: string;
  quantityId?: string | undefined;
  opId?: string | undefined;
}>;

export type ExperimentOwner = Readonly<{
  kind: "reference-evaluator" | "frankensim" | "static";
  capabilityId?: string | undefined;
  staticReason?: string | undefined;
  kernelFunctions?: readonly KernelFunctionRef[] | undefined;
  identifierBindings?: readonly IdentifierBinding[] | undefined;
  traceScenarioId?: string | undefined;
  traceRows?: readonly TraceRow[] | undefined;
}>;

export const VIEW_KINDS = ["svg", "canvas", "three", "table", "text"] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export const RENDERING_CAPABILITIES = ["webgl", "canvas-2d"] as const;
export type RenderingCapability = (typeof RENDERING_CAPABILITIES)[number];

export type ViewSpec = Readonly<{
  id: string;
  kind: ViewKind;
  consumes: readonly string[];
  requires?: readonly RenderingCapability[] | undefined;
  spatialJustification?: string | undefined;
}>;

export const ACTION_FAMILIES = [
  "probability-diffusion",
  "clock-event",
  "radiation-entropy",
  "fields-boosts",
  "energy-accounting",
  "derivations",
] as const;
export type ActionFamily = (typeof ACTION_FAMILIES)[number];

export type ActionContract = Readonly<{
  actionId: string;
  family: ActionFamily;
  question: string;
  inputs: readonly string[];
  commandClass: string;
  acceptedResult: Readonly<{
    outputs: readonly string[];
    allowedStatuses: readonly string[];
  }>;
  visualAffordance: string;
  equivalentAffordance: string;
  announcement: string;
}>;

export type RealRate =
  | Readonly<{ natural: false }>
  | Readonly<{
      natural: true;
      quantity: string;
      scaleBar: Readonly<{ length: number; unit: string }>;
    }>;

export type PredictCandidate = Readonly<{
  id: string;
  label: string;
  description: string;
  separatingAssumption: string;
  curve?: string | undefined;
  relation?: string | undefined;
}>;

export type PredictPrompt = Readonly<{
  promptId: string;
  controlId?: string | undefined;
  actionId?: string | undefined;
  question: string;
  candidates: readonly PredictCandidate[];
  sketchAxes?: Readonly<{ x: string; y: string }> | undefined;
  verbalChoices?: readonly string[] | undefined;
  valueTargets?: readonly number[] | undefined;
}>;

export type PredictMode =
  | Readonly<{ exempt: true; reason: string }>
  | Readonly<{ enabled: true; prompts: readonly PredictPrompt[] }>;

export const HISTORICAL_STATUSES = [
  "original-1905",
  "contemporary-alternative",
  "historical-precursor",
  "later-development",
] as const;
export type HistoricalStatus = (typeof HISTORICAL_STATUSES)[number];

export type ExperimentMode = Readonly<{
  id: string;
  label: string;
  historicalStatus: HistoricalStatus;
  lensLabel?: string | undefined;
  notModeledAdditions?: readonly string[] | undefined;
  parameterOverrides?: Record<string, any> | undefined;
  outputOverrides?: Record<string, any> | undefined;
  ownerOverride?: ExperimentOwner | undefined;
}>;

export type PresetEntry = Readonly<{
  presetId: string;
  label: string;
  parameterValues: Record<string, number | string>;
  scenarioId?: string | undefined;
}>;

export type Experiment = Readonly<{
  id: InstrumentId;
  title: string;
  explanatoryQuestion: string;
  sourceRefs: readonly Readonly<{ paper: string; id: string }>[];
  argumentIds: readonly string[];
  schemaVersion: number;
  parameters: readonly ParameterSpec[];
  outputs: readonly OutputSpec[];
  assumptions: readonly string[];
  admittedDomain: string;
  notModeled: readonly string[];
  owner: ExperimentOwner;
  views: readonly ViewSpec[];
  actions: readonly ActionContract[];
  acceptanceCases: readonly string[];
  defaultScenario: string;
  tapeModel: Readonly<{ modelId: string; modelVersion: number }>;
  teachingTapes: readonly Readonly<{ tapeId: string; title: string }>[];
  presets: readonly PresetEntry[];
  probes: readonly string[];
  weavePredicates: readonly string[];
  historicalOverlays: readonly string[];
  realRate: RealRate;
  embeddable: boolean;
  predictMode: PredictMode;
  modes?: readonly ExperimentMode[] | undefined;
  provenance?: any | undefined;
}>;

export function validateExperiment(raw: unknown, path = "Experiment"): Experiment {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "Experiment must be an object.",
      "Experiment",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  // Identity
  if (typeof o.id !== "string") {
    throw new ExperimentValidationError(
      "missing-id",
      "Experiment id is required.",
      "Experiment",
      `${path}.id`,
    );
  }
  const instParsed = parseInstrumentId(o.id);
  if (!instParsed.ok) {
    throw new ExperimentValidationError(
      "invalid-instrument-id",
      instParsed.error,
      "Experiment",
      `${path}.id`,
    );
  }
  const instrumentId = instParsed.value;

  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new ExperimentValidationError(
      "missing-title",
      "Experiment title is required.",
      "Experiment",
      `${path}.title`,
    );
  }
  if (typeof o.explanatoryQuestion !== "string" || !o.explanatoryQuestion.trim()) {
    throw new ExperimentValidationError(
      "missing-question",
      "explanatoryQuestion is required.",
      "Experiment",
      `${path}.explanatoryQuestion`,
    );
  }
  if (!Array.isArray(o.sourceRefs)) {
    throw new ExperimentValidationError(
      "missing-source-refs",
      "sourceRefs must be an array.",
      "Experiment",
      `${path}.sourceRefs`,
    );
  }
  if (!Array.isArray(o.argumentIds)) {
    throw new ExperimentValidationError(
      "missing-argument-ids",
      "argumentIds must be an array.",
      "Experiment",
      `${path}.argumentIds`,
    );
  }
  if (typeof o.schemaVersion !== "number" || o.schemaVersion <= 0) {
    throw new ExperimentValidationError(
      "invalid-schema-version",
      "schemaVersion must be a positive number.",
      "Experiment",
      `${path}.schemaVersion`,
    );
  }

  // Parameters
  if (!Array.isArray(o.parameters) || o.parameters.length === 0) {
    throw new ExperimentValidationError(
      "missing-parameters",
      "parameters must be a non-empty array.",
      "Experiment",
      `${path}.parameters`,
    );
  }
  const paramMap = new Map<string, ParameterSpec>();
  const parameters: ParameterSpec[] = [];

  for (let i = 0; i < o.parameters.length; i++) {
    const pRaw = o.parameters[i];
    const pPath = `${path}.parameters[${i}]`;
    if (!pRaw || typeof pRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-parameter",
        "Parameter must be an object.",
        "Experiment",
        pPath,
      );
    }
    const p = pRaw as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id.trim()) {
      throw new ExperimentValidationError(
        "missing-param-id",
        "Parameter id is required.",
        "Experiment",
        `${pPath}.id`,
      );
    }
    if (typeof p.quantityId !== "string" || !p.quantityId.trim()) {
      throw new ExperimentValidationError(
        "missing-param-quantity-id",
        "Parameter quantityId is required.",
        "Experiment",
        `${pPath}.quantityId`,
      );
    }
    if (!p.modelDomain || typeof p.modelDomain !== "object") {
      throw new ExperimentValidationError(
        "missing-model-domain",
        "Parameter modelDomain is required.",
        "Experiment",
        `${pPath}.modelDomain`,
      );
    }
    if (!p.visualRange || typeof p.visualRange !== "object") {
      throw new ExperimentValidationError(
        "missing-visual-range",
        "Parameter visualRange is required.",
        "Experiment",
        `${pPath}.visualRange`,
      );
    }
    if (!p.mapping || typeof p.mapping !== "object") {
      throw new ExperimentValidationError(
        "missing-param-mapping",
        "Parameter mapping is required.",
        "Experiment",
        `${pPath}.mapping`,
      );
    }
    const mapping = p.mapping as Record<string, unknown>;
    if (!["linear", "log", "step"].includes(mapping.kind as string)) {
      throw new ExperimentValidationError(
        "invalid-param-mapping-kind",
        `Invalid mapping kind "${mapping.kind}".`,
        "Experiment",
        `${pPath}.mapping.kind`,
      );
    }
    if (!COMMAND_CLASSES.includes(p.commandClass as CommandClass)) {
      throw new ExperimentValidationError(
        "invalid-command-class",
        `Invalid commandClass "${p.commandClass}".`,
        "Experiment",
        `${pPath}.commandClass`,
      );
    }

    const param: ParameterSpec = {
      id: p.id,
      label: (p.label as string) || p.id,
      accessibleName: (p.accessibleName as string) || (p.label as string) || p.id,
      accessibleDescription: (p.accessibleDescription as string) || "",
      quantityId: p.quantityId,
      displayUnit: (p.displayUnit as string) || "",
      modelDomain: p.modelDomain as ModelDomain,
      numericalDomain: (p.numericalDomain as NumericalDomain) || undefined,
      visualRange: p.visualRange as VisualRange,
      default: p.default as number | string,
      mapping: p.mapping as ParameterMapping,
      step: typeof p.step === "number" ? p.step : undefined,
      role: p.role === "derived" ? "derived" : "independent",
      derivedFrom: Array.isArray(p.derivedFrom) ? (p.derivedFrom as string[]) : undefined,
      commandClass: p.commandClass as CommandClass,
    };
    parameters.push(param);
    paramMap.set(param.id, param);
  }

  // Check gridParameterId references
  for (const param of parameters) {
    if (
      param.mapping.kind === "step" &&
      "gridParameterId" in param.mapping &&
      param.mapping.gridParameterId
    ) {
      const targetId = param.mapping.gridParameterId;
      const target = paramMap.get(targetId);
      if (!target) {
        throw new ExperimentValidationError(
          "missing-grid-parameter",
          `Parameter "${param.id}" references non-existent gridParameterId "${targetId}".`,
          "Experiment",
          `${path}.parameters.${param.id}.mapping`,
        );
      }
      if (target.quantityId !== param.quantityId) {
        throw new ExperimentValidationError(
          "grid-parameter-dimension-mismatch",
          `Parameter "${param.id}" (quantity "${param.quantityId}") references gridParameterId "${targetId}" with mismatched quantity "${target.quantityId}".`,
          "Experiment",
          `${path}.parameters.${param.id}.mapping`,
        );
      }
      if (
        target.mapping.kind === "step" &&
        "gridParameterId" in target.mapping &&
        target.mapping.gridParameterId
      ) {
        throw new ExperimentValidationError(
          "grid-parameter-chain-forbidden",
          `Grid parameter chaining is forbidden: "${targetId}" itself uses gridParameterId.`,
          "Experiment",
          `${path}.parameters.${param.id}.mapping`,
        );
      }
    }
  }

  // Outputs
  if (!Array.isArray(o.outputs) || o.outputs.length === 0) {
    throw new ExperimentValidationError(
      "missing-outputs",
      "outputs must be a non-empty array.",
      "Experiment",
      `${path}.outputs`,
    );
  }
  const outputs: OutputSpec[] = [];
  let hasPrimaryOutput = false;
  let allowsNonValue = false;

  for (let i = 0; i < o.outputs.length; i++) {
    const outRaw = o.outputs[i];
    const outPath = `${path}.outputs[${i}]`;
    if (!outRaw || typeof outRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-output",
        "Output must be an object.",
        "Experiment",
        outPath,
      );
    }
    const out = outRaw as Record<string, unknown>;
    if (typeof out.id !== "string" || !out.id.trim()) {
      throw new ExperimentValidationError(
        "missing-output-id",
        "Output id is required.",
        "Experiment",
        `${outPath}.id`,
      );
    }
    if (typeof out.quantityId !== "string" || !out.quantityId.trim()) {
      throw new ExperimentValidationError(
        "missing-output-quantity-id",
        "Output quantityId is required.",
        "Experiment",
        `${outPath}.quantityId`,
      );
    }
    if (!Array.isArray(out.allowedStatuses) || out.allowedStatuses.length === 0) {
      throw new ExperimentValidationError(
        "missing-allowed-statuses",
        "Output allowedStatuses must be a non-empty array.",
        "Experiment",
        `${outPath}.allowedStatuses`,
      );
    }
    for (const st of out.allowedStatuses) {
      if (!OUTPUT_STATUSES.includes(st as OutputStatus)) {
        throw new ExperimentValidationError(
          "invalid-output-status",
          `Invalid output status "${st}".`,
          "Experiment",
          `${outPath}.allowedStatuses`,
        );
      }
      if (st !== "value") {
        allowsNonValue = true;
      }
    }
    if (out.primary === true) {
      hasPrimaryOutput = true;
    }
    outputs.push({
      id: out.id,
      quantityId: out.quantityId,
      allowedStatuses: out.allowedStatuses as OutputStatus[],
      primary: Boolean(out.primary),
    });
  }

  if (!hasPrimaryOutput) {
    throw new ExperimentValidationError(
      "missing-primary-output",
      "Experiment must declare at least one primary output (primary: true).",
      "Experiment",
      `${path}.outputs`,
    );
  }

  // Model Claims: notModeled must be non-empty
  if (!Array.isArray(o.notModeled) || o.notModeled.length === 0) {
    throw new ExperimentValidationError(
      "empty-not-modeled",
      "Experiment notModeled array MUST BE NON-EMPTY. An empty notModeled list fails the audit to ensure honest boundary declarations.",
      "Experiment",
      `${path}.notModeled`,
    );
  }
  const notModeled = o.notModeled as string[];

  if (!Array.isArray(o.assumptions)) {
    throw new ExperimentValidationError(
      "missing-assumptions",
      "assumptions must be an array.",
      "Experiment",
      `${path}.assumptions`,
    );
  }
  if (typeof o.admittedDomain !== "string" || !o.admittedDomain.trim()) {
    throw new ExperimentValidationError(
      "missing-admitted-domain",
      "admittedDomain prose is required.",
      "Experiment",
      `${path}.admittedDomain`,
    );
  }

  // Owner
  if (!o.owner || typeof o.owner !== "object") {
    throw new ExperimentValidationError(
      "missing-owner",
      "owner block is required.",
      "Experiment",
      `${path}.owner`,
    );
  }
  const ow = o.owner as Record<string, unknown>;
  if (!["reference-evaluator", "frankensim", "static"].includes(ow.kind as string)) {
    throw new ExperimentValidationError(
      "invalid-owner-kind",
      `Invalid owner kind "${ow.kind}".`,
      "Experiment",
      `${path}.owner.kind`,
    );
  }
  if (ow.kind === "static") {
    if (typeof ow.staticReason !== "string" || !ow.staticReason.trim()) {
      throw new ExperimentValidationError(
        "missing-static-reason",
        "Static owner requires non-empty staticReason.",
        "Experiment",
        `${path}.owner.staticReason`,
      );
    }
    if (Array.isArray(ow.kernelFunctions) && ow.kernelFunctions.length > 0) {
      throw new ExperimentValidationError(
        "static-owner-has-functions",
        "Static owner cannot declare kernel functions.",
        "Experiment",
        `${path}.owner.kernelFunctions`,
      );
    }
    if (ow.traceScenarioId || (Array.isArray(ow.traceRows) && ow.traceRows.length > 0)) {
      throw new ExperimentValidationError(
        "static-owner-has-trace",
        "Static owner cannot declare trace scenario or trace rows.",
        "Experiment",
        `${path}.owner`,
      );
    }
  }

  // Kernel functions
  const kernelFunctions: KernelFunctionRef[] = [];
  if (Array.isArray(ow.kernelFunctions)) {
    for (let i = 0; i < ow.kernelFunctions.length; i++) {
      const kRaw = ow.kernelFunctions[i];
      const kPath = `${path}.owner.kernelFunctions[${i}]`;
      if (!kRaw || typeof kRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-kernel-function",
          "Kernel function must be an object.",
          "Experiment",
          kPath,
        );
      }
      const k = kRaw as Record<string, unknown>;
      if (!KERNEL_DISPLAY_ROLES.includes(k.displayRole as KernelDisplayRole)) {
        throw new ExperimentValidationError(
          "invalid-kernel-display-role",
          `Invalid displayRole "${k.displayRole}".`,
          "Experiment",
          `${kPath}.displayRole`,
        );
      }
      const role = k.displayRole as KernelDisplayRole;
      if (role === "pseudocode" || role === "derivation") {
        if (k.module || k.crate || k.path || k.fnName || k.revision) {
          throw new ExperimentValidationError(
            "pseudocode-with-exec-fields",
            `Kernel function with displayRole "${role}" must not declare executable reference fields (module, crate, path, fnName, revision).`,
            "Experiment",
            kPath,
          );
        }
      } else if (role === "executing-source" || role === "reference-implementation") {
        if (k.language === "ts") {
          if (!k.module || !k.exportName) {
            throw new ExperimentValidationError(
              "missing-ts-kernel-fields",
              `TypeScript kernel function with displayRole "${role}" requires module and exportName.`,
              "Experiment",
              kPath,
            );
          }
        } else if (k.language === "rust") {
          if (!k.crate || !k.path || !k.fnName || !k.revision) {
            throw new ExperimentValidationError(
              "missing-rust-kernel-fields",
              `Rust kernel function with displayRole "${role}" requires crate, path, fnName, and revision.`,
              "Experiment",
              kPath,
            );
          }
        } else {
          throw new ExperimentValidationError(
            "missing-kernel-language",
            `Kernel function requires language: "ts" | "rust".`,
            "Experiment",
            `${kPath}.language`,
          );
        }
      }
      kernelFunctions.push(k as any);
    }
  }

  // Trace rows cap (at most 12 rows)
  let traceRows: TraceRow[] | undefined;
  if (Array.isArray(ow.traceRows)) {
    if (ow.traceRows.length > 12) {
      throw new ExperimentValidationError(
        "trace-rows-exceeded",
        `Experiment "${instrumentId}" traceRows contains ${ow.traceRows.length} rows, exceeding the 12-row cap.`,
        "Experiment",
        `${path}.owner.traceRows`,
      );
    }
    traceRows = ow.traceRows as TraceRow[];
  }

  const owner: ExperimentOwner = {
    kind: ow.kind as any,
    ...(typeof ow.capabilityId === "string" ? { capabilityId: ow.capabilityId } : {}),
    ...(typeof ow.staticReason === "string" ? { staticReason: ow.staticReason } : {}),
    kernelFunctions,
    identifierBindings: Array.isArray(ow.identifierBindings)
      ? (ow.identifierBindings as IdentifierBinding[])
      : [],
    ...(typeof ow.traceScenarioId === "string" ? { traceScenarioId: ow.traceScenarioId } : {}),
    ...(traceRows ? { traceRows } : {}),
  };

  // Views
  if (!Array.isArray(o.views) || o.views.length === 0) {
    throw new ExperimentValidationError(
      "missing-views",
      "views must be a non-empty array.",
      "Experiment",
      `${path}.views`,
    );
  }
  const views: ViewSpec[] = [];
  let hasCanvasOrThree = false;
  let hasTableOrText = false;
  let hasNoRequiresView = false;

  for (let i = 0; i < o.views.length; i++) {
    const vRaw = o.views[i];
    const vPath = `${path}.views[${i}]`;
    if (!vRaw || typeof vRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-view",
        "View must be an object.",
        "Experiment",
        vPath,
      );
    }
    const v = vRaw as Record<string, unknown>;
    if (!VIEW_KINDS.includes(v.kind as ViewKind)) {
      throw new ExperimentValidationError(
        "invalid-view-kind",
        `Invalid view kind "${v.kind}".`,
        "Experiment",
        `${vPath}.kind`,
      );
    }
    const kind = v.kind as ViewKind;
    if (kind === "three") {
      hasCanvasOrThree = true;
      if (typeof v.spatialJustification !== "string" || !v.spatialJustification.trim()) {
        throw new ExperimentValidationError(
          "missing-spatial-justification",
          `A "three" view requires a non-empty spatialJustification explaining why 3D is necessary over 2D.`,
          "Experiment",
          `${vPath}.spatialJustification`,
        );
      }
      const req = Array.isArray(v.requires) ? v.requires : [];
      if (!req.includes("webgl")) {
        throw new ExperimentValidationError(
          "three-view-missing-webgl",
          'A "three" view must declare requires: ["webgl"].',
          "Experiment",
          `${vPath}.requires`,
        );
      }
    } else if (kind === "canvas") {
      hasCanvasOrThree = true;
      const req = Array.isArray(v.requires) ? v.requires : [];
      if (!req.includes("canvas-2d")) {
        throw new ExperimentValidationError(
          "canvas-view-missing-canvas-2d",
          'A "canvas" view must declare requires: ["canvas-2d"].',
          "Experiment",
          `${vPath}.requires`,
        );
      }
    } else if (kind === "table" || kind === "text") {
      hasTableOrText = true;
      if (Array.isArray(v.requires) && v.requires.length > 0) {
        throw new ExperimentValidationError(
          "table-text-view-declares-capability",
          `A "${kind}" view must not declare rendering capabilities in requires.`,
          "Experiment",
          `${vPath}.requires`,
        );
      }
    } else if (kind === "svg") {
      if (Array.isArray(v.requires) && v.requires.length > 0) {
        throw new ExperimentValidationError(
          "svg-view-declares-capability",
          'An "svg" view must not declare rendering capabilities in requires.',
          "Experiment",
          `${vPath}.requires`,
        );
      }
    }

    if (!Array.isArray(v.requires) || v.requires.length === 0) {
      hasNoRequiresView = true;
    }

    views.push({
      id: (v.id as string) || `${kind}-${i}`,
      kind,
      consumes: Array.isArray(v.consumes) ? (v.consumes as string[]) : [],
      requires: Array.isArray(v.requires) ? (v.requires as RenderingCapability[]) : undefined,
      spatialJustification:
        typeof v.spatialJustification === "string" ? v.spatialJustification : undefined,
    });
  }

  if (hasCanvasOrThree && !hasTableOrText) {
    throw new ExperimentValidationError(
      "canvas-or-three-missing-fallback-view",
      'Every manifest with a "canvas" or "three" view must also include at least one "table" or "text" accessible fallback view.',
      "Experiment",
      `${path}.views`,
    );
  }
  if (!hasNoRequiresView) {
    throw new ExperimentValidationError(
      "all-views-require-capabilities",
      "Every manifest must keep at least one view with no rendering capability requirements.",
      "Experiment",
      `${path}.views`,
    );
  }

  // RealRate
  if (!o.realRate || typeof o.realRate !== "object") {
    throw new ExperimentValidationError(
      "missing-real-rate",
      "realRate declaration is required.",
      "Experiment",
      `${path}.realRate`,
    );
  }
  const rr = o.realRate as Record<string, unknown>;
  let realRate: RealRate;
  if (rr.natural === true) {
    if (typeof rr.quantity !== "string" || !rr.quantity.trim()) {
      throw new ExperimentValidationError(
        "missing-real-rate-quantity",
        "natural: true requires output quantity.",
        "Experiment",
        `${path}.realRate.quantity`,
      );
    }
    const sb = rr.scaleBar as Record<string, unknown>;
    if (!sb || typeof sb.length !== "number" || typeof sb.unit !== "string") {
      throw new ExperimentValidationError(
        "missing-real-rate-scalebar",
        "natural: true requires scaleBar: { length, unit }.",
        "Experiment",
        `${path}.realRate.scaleBar`,
      );
    }
    realRate = {
      natural: true,
      quantity: rr.quantity,
      scaleBar: { length: sb.length as number, unit: sb.unit as string },
    };
  } else if (rr.natural === false) {
    realRate = { natural: false };
  } else {
    throw new ExperimentValidationError(
      "invalid-real-rate",
      "realRate must be { natural: true, ... } or { natural: false }.",
      "Experiment",
      `${path}.realRate`,
    );
  }

  // PredictMode
  if (!o.predictMode || typeof o.predictMode !== "object") {
    throw new ExperimentValidationError(
      "missing-predict-mode",
      "predictMode is required (must be enabled or exempt with reason).",
      "Experiment",
      `${path}.predictMode`,
    );
  }
  const pm = o.predictMode as Record<string, unknown>;
  let predictMode: PredictMode;

  if (pm.exempt === true) {
    if (typeof pm.reason !== "string" || !pm.reason.trim()) {
      throw new ExperimentValidationError(
        "missing-predict-exemption-reason",
        "predictMode exemption requires a non-empty reason.",
        "Experiment",
        `${path}.predictMode.reason`,
      );
    }
    predictMode = { exempt: true, reason: pm.reason };
  } else if (pm.enabled === true) {
    if (!Array.isArray(pm.prompts) || pm.prompts.length === 0) {
      throw new ExperimentValidationError(
        "missing-predict-prompts",
        "predictMode.enabled: true requires a non-empty prompts array.",
        "Experiment",
        `${path}.predictMode.prompts`,
      );
    }
    const prompts: PredictPrompt[] = [];
    const promptControlIds = new Set<string>();

    for (let i = 0; i < pm.prompts.length; i++) {
      const prRaw = pm.prompts[i];
      const prPath = `${path}.predictMode.prompts[${i}]`;
      if (!prRaw || typeof prRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-predict-prompt",
          "Predict prompt must be an object.",
          "Experiment",
          prPath,
        );
      }
      const pr = prRaw as Record<string, unknown>;
      if (typeof pr.promptId !== "string") {
        throw new ExperimentValidationError(
          "missing-prompt-id",
          "promptId is required.",
          "Experiment",
          `${prPath}.promptId`,
        );
      }
      const promptParsed = parsePredictPromptId(pr.promptId);
      if (!promptParsed.ok) {
        throw new ExperimentValidationError(
          "invalid-predict-prompt-id",
          promptParsed.error,
          "Experiment",
          `${prPath}.promptId`,
        );
      }

      const controlKey = (pr.controlId || pr.actionId) as string | undefined;
      if (!controlKey) {
        throw new ExperimentValidationError(
          "missing-prompt-target",
          "Predict prompt requires controlId or actionId.",
          "Experiment",
          prPath,
        );
      }
      if (promptControlIds.has(controlKey)) {
        throw new ExperimentValidationError(
          "duplicate-prompt-target",
          `Only one predict prompt is allowed per control or action (duplicate "${controlKey}").`,
          "Experiment",
          prPath,
        );
      }
      promptControlIds.add(controlKey);

      // Candidates: EXACTLY THREE CANDIDATES!
      if (!Array.isArray(pr.candidates) || pr.candidates.length !== 3) {
        throw new ExperimentValidationError(
          "predict-candidates-count",
          `Predict prompt "${pr.promptId}" must provide exactly 3 plausible candidates (found ${Array.isArray(pr.candidates) ? pr.candidates.length : 0}).`,
          "Experiment",
          `${prPath}.candidates`,
        );
      }

      const candidateIds = new Set<string>();
      const candidates: PredictCandidate[] = [];

      for (let j = 0; j < pr.candidates.length; j++) {
        const cRaw = pr.candidates[j];
        const cPath = `${prPath}.candidates[${j}]`;
        if (!cRaw || typeof cRaw !== "object") {
          throw new ExperimentValidationError(
            "invalid-candidate",
            "Candidate must be an object.",
            "Experiment",
            cPath,
          );
        }
        const c = cRaw as Record<string, unknown>;
        if (typeof c.id !== "string" || !c.id.trim()) {
          throw new ExperimentValidationError(
            "missing-candidate-id",
            "Candidate id is required.",
            "Experiment",
            `${cPath}.id`,
          );
        }
        if (candidateIds.has(c.id)) {
          throw new ExperimentValidationError(
            "duplicate-candidate-id",
            `Candidate id "${c.id}" is duplicated in prompt.`,
            "Experiment",
            `${cPath}.id`,
          );
        }
        candidateIds.add(c.id);

        if (typeof c.separatingAssumption !== "string" || !c.separatingAssumption.trim()) {
          throw new ExperimentValidationError(
            "missing-separating-assumption",
            `Candidate "${c.id}" in prompt "${pr.promptId}" is missing required separatingAssumption. Every candidate, including the accepted one, requires a separatingAssumption.`,
            "Experiment",
            `${cPath}.separatingAssumption`,
          );
        }

        candidates.push({
          id: c.id,
          label: (c.label as string) || c.id,
          description: (c.description as string) || "",
          separatingAssumption: c.separatingAssumption,
          curve: (c.curve as string) || undefined,
          relation: (c.relation as string) || undefined,
        });
      }

      prompts.push({
        promptId: pr.promptId,
        controlId: (pr.controlId as string) || undefined,
        actionId: (pr.actionId as string) || undefined,
        question: (pr.question as string) || "",
        candidates,
        sketchAxes: pr.sketchAxes as any,
        verbalChoices: Array.isArray(pr.verbalChoices) ? (pr.verbalChoices as string[]) : undefined,
        valueTargets: Array.isArray(pr.valueTargets) ? (pr.valueTargets as number[]) : undefined,
      });
    }

    predictMode = { enabled: true, prompts };
  } else {
    throw new ExperimentValidationError(
      "invalid-predict-mode",
      "predictMode must be { enabled: true, prompts: [...] } or { exempt: true, reason: string }.",
      "Experiment",
      `${path}.predictMode`,
    );
  }

  // Presets
  const presets: PresetEntry[] = [];
  if (Array.isArray(o.presets)) {
    for (let i = 0; i < o.presets.length; i++) {
      const psRaw = o.presets[i];
      const psPath = `${path}.presets[${i}]`;
      if (!psRaw || typeof psRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-preset",
          "Preset must be an object.",
          "Experiment",
          psPath,
        );
      }
      const ps = psRaw as Record<string, unknown>;
      if (typeof ps.presetId !== "string") {
        throw new ExperimentValidationError(
          "missing-preset-id",
          "presetId is required.",
          "Experiment",
          `${psPath}.presetId`,
        );
      }
      const presetParsed = parsePresetId(ps.presetId);
      if (!presetParsed.ok) {
        throw new ExperimentValidationError(
          "invalid-preset-id",
          presetParsed.error,
          "Experiment",
          `${psPath}.presetId`,
        );
      }
      if (ps.scenarioId && ps.scenarioId !== ps.presetId) {
        throw new ExperimentValidationError(
          "preset-scenario-id-mismatch",
          `Preset scenarioId "${ps.scenarioId}" must equal presetId "${ps.presetId}".`,
          "Experiment",
          `${psPath}.scenarioId`,
        );
      }
      presets.push({
        presetId: ps.presetId,
        label: (ps.label as string) || ps.presetId,
        parameterValues: (ps.parameterValues as Record<string, any>) || {},
        scenarioId: (ps.scenarioId as string) || undefined,
      });
    }
  }

  // Acceptance cases: check refusal/non-value coverage if outputs allow non-value
  const acceptanceCases = Array.isArray(o.acceptanceCases) ? (o.acceptanceCases as string[]) : [];
  if (allowsNonValue && acceptanceCases.length === 0) {
    throw new ExperimentValidationError(
      "missing-refusal-acceptance-case",
      "Outputs allow non-numeric or refusal statuses, but acceptanceCases is empty.",
      "Experiment",
      `${path}.acceptanceCases`,
    );
  }

  // Modes
  const modes: ExperimentMode[] = [];
  if (Array.isArray(o.modes)) {
    for (let i = 0; i < o.modes.length; i++) {
      const mRaw = o.modes[i];
      const mPath = `${path}.modes[${i}]`;
      if (!mRaw || typeof mRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-mode",
          "Mode must be an object.",
          "Experiment",
          mPath,
        );
      }
      const m = mRaw as Record<string, unknown>;
      if (typeof m.id !== "string") {
        throw new ExperimentValidationError(
          "missing-mode-id",
          "Mode id is required.",
          "Experiment",
          `${mPath}.id`,
        );
      }
      const modeParsed = parseModeId(m.id);
      if (!modeParsed.ok) {
        throw new ExperimentValidationError(
          "invalid-mode-id",
          modeParsed.error,
          "Experiment",
          `${mPath}.id`,
        );
      }
      if (!HISTORICAL_STATUSES.includes(m.historicalStatus as HistoricalStatus)) {
        throw new ExperimentValidationError(
          "invalid-historical-status",
          `Invalid historicalStatus "${m.historicalStatus}".`,
          "Experiment",
          `${mPath}.historicalStatus`,
        );
      }
      if (m.historicalStatus === "later-development") {
        if (typeof m.lensLabel !== "string" || !m.lensLabel.trim()) {
          throw new ExperimentValidationError(
            "missing-lens-label",
            'Mode with historicalStatus "later-development" requires lensLabel.',
            "Experiment",
            `${mPath}.lensLabel`,
          );
        }
      }
      modes.push(m as any);
    }
  }

  return {
    id: instrumentId,
    title: o.title as string,
    explanatoryQuestion: o.explanatoryQuestion as string,
    sourceRefs: o.sourceRefs as { paper: string; id: string }[],
    argumentIds: o.argumentIds as string[],
    schemaVersion: o.schemaVersion as number,
    parameters,
    outputs,
    assumptions: o.assumptions as string[],
    admittedDomain: o.admittedDomain as string,
    notModeled,
    owner,
    views,
    actions: Array.isArray(o.actions) ? (o.actions as ActionContract[]) : [],
    acceptanceCases,
    defaultScenario: (o.defaultScenario as string) || "default",
    tapeModel: (o.tapeModel as { modelId: string; modelVersion: number }) || {
      modelId: "tape-v1",
      modelVersion: 1,
    },
    teachingTapes: Array.isArray(o.teachingTapes)
      ? (o.teachingTapes as { tapeId: string; title: string }[])
      : [],
    presets,
    probes: Array.isArray(o.probes) ? (o.probes as string[]) : [],
    weavePredicates: Array.isArray(o.weavePredicates) ? (o.weavePredicates as string[]) : [],
    historicalOverlays: Array.isArray(o.historicalOverlays)
      ? (o.historicalOverlays as string[])
      : [],
    realRate,
    embeddable: Boolean(o.embeddable),
    predictMode,
    modes: modes.length > 0 ? modes : undefined,
    provenance: o.provenance,
  };
}

// ============================================================================
// 2. SCENARIO
// ============================================================================

export const SCENARIO_KINDS = [
  "historical-fixture",
  "modern-golden",
  "identity",
  "discrimination",
  "adversarial",
] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export type ToleranceSpec = Readonly<{
  absolute?: number | undefined;
  relative?: number | undefined;
  relativeTo?: number | undefined;
  rationale?: string | undefined;
}>;

export type PrintedPrecision =
  | Readonly<{ significantFigures: number }>
  | Readonly<{ decimals: number }>;

export type ExpectedOutput = Readonly<{
  outputId: string;
  value?: number | string | undefined;
  comparisonKind: "bitwise" | "tolerance" | "rounds-to";
  tolerance?: ToleranceSpec | undefined;
  printedValue?: string | undefined;
  printedPrecision?: PrintedPrecision | undefined;
  roundingConvention?: "half-up" | "half-even" | undefined;
  roundingReason?: string | undefined;
  qualifier?: "about" | "ca." | undefined;
}>;

export type HistoricalFixtureTranscription =
  | Readonly<{ status: "verified"; facsimilePage: number }>
  | Readonly<{ status: "pending"; reason: string }>
  | Readonly<{
      status: "verified-suspected-misprint";
      facsimilePage: number;
      printedReading: string;
      correctedReading: string;
      reasoning: string;
      receiptRef: string;
    }>;

export type IdentityRoute = Readonly<{
  routeId: string;
  owner: string;
  description: string;
}>;

export type DiscriminationHypothesis = Readonly<{
  id: string;
  label: string;
  owner: string;
  modelIdentity: string;
  circumstancesInWhichItWorks: string;
  historicalStatus: string;
}>;

export type DiscriminationObservation = Readonly<{
  observableId: string;
  inputs: Record<string, any>;
  procedure: string;
}>;

export type ScenarioExpected = Readonly<{
  outputs?: readonly ExpectedOutput[] | undefined;
  status?: Readonly<{ outputId: string; status: string; reasonCode: string }> | undefined;
  invariants?: readonly Readonly<{ expression: string; description: string }>[] | undefined;
  outcome?: "indistinguishable" | "discriminates" | undefined;
}>;

export type Scenario = Readonly<{
  id: string;
  kind: ScenarioKind;
  title: string;
  description: string;
  experimentId?: string | undefined;
  provenance?:
    | Readonly<{
        paper: string;
        sectionId: string;
        printedPage: number;
        locator?: string | undefined;
      }>
    | undefined;
  constantSetId: string;
  constantSetMixing?: Readonly<{ declared: true; reason: string }> | undefined;
  inputs: Record<string, Readonly<{ value: number | string; unit: string }>>;
  equations?: readonly string[] | undefined;
  owner: string;
  seedPolicy?: "fixed" | "new-trial-recorded" | undefined;
  seed?: string | undefined;
  streamVersion?: number | undefined;
  allocationId?: string | undefined;
  actions?:
    | readonly Readonly<{
        time?: number | undefined;
        event: string;
        commandClass: string;
        parameters?: Record<string, any> | undefined;
      }>[]
    | undefined;
  expected: ScenarioExpected;
  modelVersion: number;
  schemaVersion: number;
  transcription?: HistoricalFixtureTranscription | undefined;
  editorialInputs?:
    | readonly Readonly<{
        quantityId: string;
        value: number | string;
        unit: string;
        source: string;
        reason: string;
        sensitivity: string;
      }>[]
    | undefined;
  documentedAlternatives?:
    | readonly Readonly<{
        quantityId: string;
        value: number | string;
        printedRepresentation: string;
        reason: string;
      }>[]
    | undefined;
  routes?: readonly [IdentityRoute, IdentityRoute] | undefined;
  hypotheses?: readonly DiscriminationHypothesis[] | undefined;
  observation?: DiscriminationObservation | undefined;
}>;

export function validateScenario(raw: unknown, path = "Scenario"): Scenario {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "Scenario must be an object.",
      "Scenario",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError(
      "missing-id",
      "Scenario id is required.",
      "Scenario",
      `${path}.id`,
    );
  }
  if (!SCENARIO_KINDS.includes(o.kind as ScenarioKind)) {
    throw new ExperimentValidationError(
      "invalid-scenario-kind",
      `Invalid scenario kind "${o.kind}".`,
      "Scenario",
      `${path}.kind`,
    );
  }
  const kind = o.kind as ScenarioKind;

  // Retired spelling check
  if ("constantSet" in o && !("constantSetId" in o)) {
    throw new ExperimentValidationError(
      "retired-constant-set-field",
      'Found retired field "constantSet". Use "constantSetId" instead.',
      "Scenario",
      `${path}.constantSet`,
    );
  }
  if (typeof o.constantSetId !== "string" || !o.constantSetId.trim()) {
    throw new ExperimentValidationError(
      "missing-constant-set-id",
      "constantSetId is required.",
      "Scenario",
      `${path}.constantSetId`,
    );
  }

  // Seed validation
  let seed: string | undefined;
  if ("seed" in o && o.seed !== undefined) {
    if (typeof o.seed === "number") {
      throw new ExperimentValidationError(
        "numeric-seed-rejected",
        `Scenario seed "${o.seed}" was provided as a JSON number. Seeds must be unsigned 64-bit decimal strings.`,
        "Scenario",
        `${path}.seed`,
      );
    }
    seed = validateU64String(o.seed, `${path}.seed`);
  }

  if (o.seedPolicy && !o.allocationId) {
    throw new ExperimentValidationError(
      "stochastic-missing-allocation-id",
      "Stochastic scenario with seedPolicy requires allocationId registered in STREAM_ALLOCATION.md.",
      "Scenario",
      `${path}.allocationId`,
    );
  }

  // Historical fixture checks
  let transcription: HistoricalFixtureTranscription | undefined;
  if (kind === "historical-fixture") {
    if (!o.provenance || typeof o.provenance !== "object") {
      throw new ExperimentValidationError(
        "historical-missing-provenance",
        "historical-fixture requires provenance: { paper, sectionId, printedPage }.",
        "Scenario",
        `${path}.provenance`,
      );
    }
    if (!o.transcription || typeof o.transcription !== "object") {
      throw new ExperimentValidationError(
        "historical-missing-transcription",
        "historical-fixture requires transcription block.",
        "Scenario",
        `${path}.transcription`,
      );
    }
    const tr = o.transcription as Record<string, unknown>;
    if (tr.status === "verified-suspected-misprint") {
      if (!tr.printedReading || !tr.receiptRef) {
        throw new ExperimentValidationError(
          "misprint-missing-evidence",
          "verified-suspected-misprint transcription requires printedReading and receiptRef.",
          "Scenario",
          `${path}.transcription`,
        );
      }
    }
    transcription = tr as any;
  }

  // Editorial inputs & documented alternatives check
  if (Array.isArray(o.editorialInputs)) {
    for (let i = 0; i < o.editorialInputs.length; i++) {
      const ed = o.editorialInputs[i] as Record<string, unknown>;
      const edPath = `${path}.editorialInputs[${i}]`;
      if (!ed.source || !ed.reason) {
        throw new ExperimentValidationError(
          "editorial-input-missing-fields",
          "editorialInputs entry requires source and reason.",
          "Scenario",
          edPath,
        );
      }
    }
  }
  if (Array.isArray(o.documentedAlternatives)) {
    for (let i = 0; i < o.documentedAlternatives.length; i++) {
      const alt = o.documentedAlternatives[i] as Record<string, unknown>;
      const altPath = `${path}.documentedAlternatives[${i}]`;
      if (!alt.printedRepresentation) {
        throw new ExperimentValidationError(
          "documented-alternative-missing-printed-rep",
          "documentedAlternatives entry requires printedRepresentation.",
          "Scenario",
          altPath,
        );
      }
    }
  }

  // Identity checks (must have exactly 2 routes with distinct owners)
  let routes: [IdentityRoute, IdentityRoute] | undefined;
  if (kind === "identity") {
    if (!Array.isArray(o.routes) || o.routes.length !== 2) {
      throw new ExperimentValidationError(
        "identity-routes-count",
        `Identity scenario requires exactly 2 routes (found ${Array.isArray(o.routes) ? o.routes.length : 0}).`,
        "Scenario",
        `${path}.routes`,
      );
    }
    const r0 = o.routes[0] as IdentityRoute;
    const r1 = o.routes[1] as IdentityRoute;
    if (r0.owner === r1.owner) {
      throw new ExperimentValidationError(
        "identity-routes-same-owner",
        `Identity scenario routes must not share the same owner (both are "${r0.owner}").`,
        "Scenario",
        `${path}.routes`,
      );
    }
    routes = [r0, r1];
  }

  // Discrimination checks
  let hypotheses: DiscriminationHypothesis[] | undefined;
  let observation: DiscriminationObservation | undefined;
  if (kind === "discrimination") {
    if (!Array.isArray(o.hypotheses) || o.hypotheses.length < 2) {
      throw new ExperimentValidationError(
        "discrimination-missing-hypotheses",
        "Discrimination scenario requires at least two hypotheses.",
        "Scenario",
        `${path}.hypotheses`,
      );
    }
    const ownersSeen = new Map<string, string>();
    for (let i = 0; i < o.hypotheses.length; i++) {
      const hyp = o.hypotheses[i] as DiscriminationHypothesis;
      if (ownersSeen.has(hyp.owner)) {
        throw new ExperimentValidationError(
          "discrimination-hypotheses-same-owner",
          `Discrimination hypotheses "${ownersSeen.get(hyp.owner)}" and "${hyp.id}" share the same owner "${hyp.owner}".`,
          "Scenario",
          `${path}.hypotheses[${i}]`,
        );
      }
      ownersSeen.set(hyp.owner, hyp.id);
    }
    hypotheses = o.hypotheses as DiscriminationHypothesis[];

    if (!o.observation || typeof o.observation !== "object") {
      throw new ExperimentValidationError(
        "discrimination-missing-observation",
        "Discrimination scenario requires observation block.",
        "Scenario",
        `${path}.observation`,
      );
    }
    observation = o.observation as DiscriminationObservation;
  }

  // Expected block validation
  if (!o.expected || typeof o.expected !== "object") {
    throw new ExperimentValidationError(
      "missing-expected",
      "Scenario requires expected block.",
      "Scenario",
      `${path}.expected`,
    );
  }
  const exp = o.expected as Record<string, unknown>;

  if (kind === "discrimination") {
    if (!exp.outcome || (exp.outcome !== "indistinguishable" && exp.outcome !== "discriminates")) {
      throw new ExperimentValidationError(
        "discrimination-missing-outcome",
        'Discrimination scenario expected block requires outcome: "indistinguishable" | "discriminates".',
        "Scenario",
        `${path}.expected.outcome`,
      );
    }
    if (exp.outcome === "indistinguishable" && ("residual" in exp || "difference" in exp)) {
      throw new ExperimentValidationError(
        "discrimination-indistinguishable-stored-residual",
        'Discrimination scenario with outcome "indistinguishable" must not store residual literals; runner computes comparison.',
        "Scenario",
        `${path}.expected`,
      );
    }
  }

  const expectedOutputs: ExpectedOutput[] = [];
  if (Array.isArray(exp.outputs)) {
    for (let i = 0; i < exp.outputs.length; i++) {
      const eoRaw = exp.outputs[i] as Record<string, unknown>;
      const eoPath = `${path}.expected.outputs[${i}]`;
      const comp = eoRaw.comparisonKind as string;

      if (comp === "bitwise") {
        if (eoRaw.tolerance) {
          throw new ExperimentValidationError(
            "bitwise-tolerance-forbidden",
            "Bitwise comparison must not declare a tolerance.",
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
      } else if (comp === "tolerance") {
        const tol = eoRaw.tolerance as Record<string, unknown> | undefined;
        if (
          !tol ||
          (typeof tol.absolute !== "number" && typeof tol.relative !== "number") ||
          !tol.rationale
        ) {
          throw new ExperimentValidationError(
            "tolerance-comparison-missing-spec",
            "Tolerance comparison requires at least one positive absolute/relative tolerance AND a rationale.",
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
      } else if (comp === "rounds-to") {
        if (kind !== "historical-fixture") {
          throw new ExperimentValidationError(
            "rounds-to-non-historical",
            `comparisonKind "rounds-to" is valid only on historical-fixture scenarios (found on ${kind}).`,
            "Scenario",
            `${eoPath}.comparisonKind`,
          );
        }
        if (eoRaw.tolerance) {
          throw new ExperimentValidationError(
            "rounds-to-tolerance-forbidden",
            '"rounds-to" comparison takes no tolerance.',
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
        if (!eoRaw.printedValue || !eoRaw.printedPrecision) {
          throw new ExperimentValidationError(
            "rounds-to-missing-printed-spec",
            '"rounds-to" comparison requires printedValue and printedPrecision.',
            "Scenario",
            eoPath,
          );
        }
        if (eoRaw.roundingConvention === "half-even" && !eoRaw.roundingReason) {
          throw new ExperimentValidationError(
            "half-even-missing-reason",
            'roundingConvention "half-even" requires roundingReason.',
            "Scenario",
            `${eoPath}.roundingReason`,
          );
        }
      } else {
        throw new ExperimentValidationError(
          "invalid-comparison-kind",
          `Invalid comparisonKind "${comp}".`,
          "Scenario",
          `${eoPath}.comparisonKind`,
        );
      }
      expectedOutputs.push(eoRaw as any);
    }
  }

  return {
    id: o.id as string,
    kind,
    title: (o.title as string) || (o.id as string),
    description: (o.description as string) || "",
    experimentId: (o.experimentId as string) || undefined,
    provenance: o.provenance as any,
    constantSetId: o.constantSetId as string,
    constantSetMixing: o.constantSetMixing as any,
    inputs: (o.inputs as any) || {},
    equations: Array.isArray(o.equations) ? (o.equations as string[]) : undefined,
    owner: (o.owner as string) || "",
    seedPolicy: o.seedPolicy as any,
    seed,
    streamVersion: typeof o.streamVersion === "number" ? o.streamVersion : undefined,
    allocationId: (o.allocationId as string) || undefined,
    actions: Array.isArray(o.actions) ? (o.actions as any[]) : undefined,
    expected: {
      outputs: expectedOutputs.length > 0 ? expectedOutputs : undefined,
      status: exp.status as any,
      invariants: Array.isArray(exp.invariants) ? (exp.invariants as any[]) : undefined,
      outcome: exp.outcome as any,
    },
    modelVersion: typeof o.modelVersion === "number" ? o.modelVersion : 1,
    schemaVersion: typeof o.schemaVersion === "number" ? o.schemaVersion : 1,
    transcription,
    editorialInputs: Array.isArray(o.editorialInputs) ? (o.editorialInputs as any[]) : undefined,
    documentedAlternatives: Array.isArray(o.documentedAlternatives)
      ? (o.documentedAlternatives as any[])
      : undefined,
    routes,
    hypotheses,
    observation,
  };
}

// ============================================================================
// 3. HISTORICAL DATASET
// ============================================================================

export type DataCell =
  | Readonly<{ kind: "number"; value: number; originalToken?: string | undefined }>
  | Readonly<{ kind: "missing"; reason: string }>
  | Readonly<{
      kind: "bound";
      direction: "upper" | "lower";
      value: number;
      originalToken?: string | undefined;
    }>;

export const COLUMN_ROLES = ["observed", "controlled", "derived", "reported-fit"] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export type DatasetColumn = Readonly<{
  name: string;
  quantityId: string;
  unit: string;
  role: ColumnRole;
  fitDescription?: string | undefined;
}>;

export type DatasetPublicationLocator =
  | Readonly<{ kind: "table"; number: number | string }>
  | Readonly<{ kind: "figure"; number: number | string }>
  | Readonly<{ kind: "unnumbered-table"; page: number; caption?: string | undefined }>
  | Readonly<{ kind: "text"; page: number; sentence: number | string }>;

export type DatasetPublication = Readonly<{
  id: string;
  citation: Citation | string;
  locator: DatasetPublicationLocator;
  publicationDate: PaperDate;
}>;

export type DatasetSeries = Readonly<{
  id: string;
  publicationId: string;
  observationDate?: PaperDate | undefined;
  description: string;
}>;

export type DatasetRow = Readonly<{
  seriesId?: string | undefined;
  cells: readonly DataCell[];
}>;

export const DATASET_RESULT_RELATIONS = [
  "tested-a-prediction",
  "measured-a-quantity-the-result-uses",
  "reinterpreted",
  "narrowed-the-domain",
  "disputed",
] as const;
export type DatasetResultRelation = (typeof DATASET_RESULT_RELATIONS)[number];

export type DatasetAddressesResult = Readonly<{
  resultId: string;
  relation: DatasetResultRelation;
  statement: string;
  openQuestion?: string | undefined;
}>;

export type HistoricalDataset = Readonly<{
  id: string;
  title: string;
  evidenceStatus: "historical-measurement" | "modern-observation";
  publications: readonly DatasetPublication[];
  primaryPublicationId: string;
  series?: readonly DatasetSeries[] | undefined;
  digitizer: Readonly<{
    name: string;
    method: string;
    date: string | PaperDate;
    sourcePageImage: string;
    digitizationRevision: number;
  }>;
  columns: readonly DatasetColumn[];
  rows: readonly DatasetRow[];
  uncertainty: Readonly<{
    type: string;
    value?: number | undefined;
    perColumn?: Record<string, number> | undefined;
    perRow?: boolean | undefined;
    description: string;
  }>;
  notes: string;
  rights: SourceAssetRights;
  allowedInferenceModelIds: readonly string[];
  calibrationIds?: readonly string[] | undefined;
  sharedInputIds?: readonly string[] | undefined;
  addressesResults?: readonly DatasetAddressesResult[] | undefined;
}>;

export function validateDataCell(raw: unknown, path = "cell"): DataCell {
  if (typeof raw === "number") {
    throw new ExperimentValidationError(
      "bare-number-cell-rejected",
      `Bare numbers in cells[] are rejected. Use typed DataCell union: { kind: "number", value, originalToken? }, { kind: "missing", reason }, or { kind: "bound", direction, value }.`,
      "HistoricalDataset",
      path,
    );
  }
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-data-cell",
      "DataCell must be an object.",
      "HistoricalDataset",
      path,
    );
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind as string;

  if (kind === "number") {
    if (typeof o.value !== "number" || isNaN(o.value)) {
      throw new ExperimentValidationError(
        "missing-cell-number-value",
        'DataCell of kind "number" requires numeric value.',
        "HistoricalDataset",
        `${path}.value`,
      );
    }
    return {
      kind: "number",
      value: o.value,
      originalToken: (o.originalToken as string) || undefined,
    };
  } else if (kind === "missing") {
    if (typeof o.reason !== "string" || !o.reason.trim()) {
      throw new ExperimentValidationError(
        "missing-cell-reason",
        'DataCell of kind "missing" requires a reason in words.',
        "HistoricalDataset",
        `${path}.reason`,
      );
    }
    return { kind: "missing", reason: o.reason };
  } else if (kind === "bound") {
    if (o.direction !== "upper" && o.direction !== "lower") {
      throw new ExperimentValidationError(
        "invalid-bound-direction",
        'DataCell of kind "bound" requires direction: "upper" | "lower".',
        "HistoricalDataset",
        `${path}.direction`,
      );
    }
    if (typeof o.value !== "number" || isNaN(o.value)) {
      throw new ExperimentValidationError(
        "missing-bound-value",
        'DataCell of kind "bound" requires numeric value.',
        "HistoricalDataset",
        `${path}.value`,
      );
    }
    return {
      kind: "bound",
      direction: o.direction,
      value: o.value,
      originalToken: (o.originalToken as string) || undefined,
    };
  } else {
    throw new ExperimentValidationError(
      "invalid-cell-kind",
      `Unknown cell kind "${kind}".`,
      "HistoricalDataset",
      `${path}.kind`,
    );
  }
}

export function validateHistoricalDataset(
  raw: unknown,
  path = "HistoricalDataset",
): HistoricalDataset {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "HistoricalDataset must be an object.",
      "HistoricalDataset",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError(
      "missing-id",
      "HistoricalDataset id is required.",
      "HistoricalDataset",
      `${path}.id`,
    );
  }
  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new ExperimentValidationError(
      "missing-title",
      "HistoricalDataset title is required.",
      "HistoricalDataset",
      `${path}.title`,
    );
  }
  if (o.evidenceStatus !== "historical-measurement" && o.evidenceStatus !== "modern-observation") {
    throw new ExperimentValidationError(
      "invalid-evidence-status",
      `Invalid evidenceStatus "${o.evidenceStatus}".`,
      "HistoricalDataset",
      `${path}.evidenceStatus`,
    );
  }

  // Publications
  if (!Array.isArray(o.publications) || o.publications.length === 0) {
    throw new ExperimentValidationError(
      "missing-publications",
      "HistoricalDataset publications must be a non-empty array.",
      "HistoricalDataset",
      `${path}.publications`,
    );
  }
  const pubIds = new Set<string>();
  const publications: DatasetPublication[] = [];

  for (let i = 0; i < o.publications.length; i++) {
    const pRaw = o.publications[i] as Record<string, unknown>;
    const pPath = `${path}.publications[${i}]`;
    if (!pRaw || typeof pRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-publication",
        "Publication must be an object.",
        "HistoricalDataset",
        pPath,
      );
    }
    if (typeof pRaw.id !== "string" || !pRaw.id.trim()) {
      throw new ExperimentValidationError(
        "missing-publication-id",
        "Publication id is required.",
        "HistoricalDataset",
        `${pPath}.id`,
      );
    }
    pubIds.add(pRaw.id);

    if (!pRaw.locator || typeof pRaw.locator !== "object") {
      throw new ExperimentValidationError(
        "missing-publication-locator",
        "Publication requires locator ({kind, number/page}).",
        "HistoricalDataset",
        `${pPath}.locator`,
      );
    }
    const loc = pRaw.locator as Record<string, unknown>;
    if (loc.kind === "table" || loc.kind === "figure") {
      if (loc.number === undefined || loc.number === null || loc.number === "") {
        throw new ExperimentValidationError(
          "missing-table-figure-number",
          `Publication locator of kind "${loc.kind}" requires a table/figure number.`,
          "HistoricalDataset",
          `${pPath}.locator.number`,
        );
      }
    } else if (loc.kind === "unnumbered-table") {
      if (typeof loc.page !== "number") {
        throw new ExperimentValidationError(
          "missing-unnumbered-table-page",
          "unnumbered-table locator requires page number.",
          "HistoricalDataset",
          `${pPath}.locator.page`,
        );
      }
    } else if (loc.kind === "text") {
      if (typeof loc.page !== "number" || loc.sentence === undefined) {
        throw new ExperimentValidationError(
          "missing-text-locator-fields",
          "text locator requires page and sentence.",
          "HistoricalDataset",
          `${pPath}.locator`,
        );
      }
    } else {
      throw new ExperimentValidationError(
        "invalid-locator-kind",
        `Invalid locator kind "${loc.kind}".`,
        "HistoricalDataset",
        `${pPath}.locator.kind`,
      );
    }

    const pubDate = validatePaperDate(
      pRaw.publicationDate,
      pRaw.id as string,
      `${pPath}.publicationDate`,
    );

    publications.push({
      id: pRaw.id,
      citation: pRaw.citation as any,
      locator: loc as any,
      publicationDate: pubDate,
    });
  }

  if (typeof o.primaryPublicationId !== "string" || !pubIds.has(o.primaryPublicationId)) {
    throw new ExperimentValidationError(
      "invalid-primary-publication-id",
      `primaryPublicationId "${o.primaryPublicationId}" must resolve to one of publications[].id.`,
      "HistoricalDataset",
      `${path}.primaryPublicationId`,
    );
  }

  // Series
  const seriesList: DatasetSeries[] = [];
  const seriesIds = new Set<string>();
  if (Array.isArray(o.series)) {
    for (let i = 0; i < o.series.length; i++) {
      const sRaw = o.series[i] as Record<string, unknown>;
      const sPath = `${path}.series[${i}]`;
      if (!sRaw || typeof sRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-series",
          "Series must be an object.",
          "HistoricalDataset",
          sPath,
        );
      }
      if (typeof sRaw.id !== "string" || !sRaw.id.trim()) {
        throw new ExperimentValidationError(
          "missing-series-id",
          "Series id is required.",
          "HistoricalDataset",
          `${sPath}.id`,
        );
      }
      seriesIds.add(sRaw.id);
      if (typeof sRaw.publicationId !== "string" || !pubIds.has(sRaw.publicationId)) {
        throw new ExperimentValidationError(
          "series-unknown-publication-id",
          `Series "${sRaw.id}" references unknown publicationId "${sRaw.publicationId}".`,
          "HistoricalDataset",
          `${sPath}.publicationId`,
        );
      }
      seriesList.push({
        id: sRaw.id,
        publicationId: sRaw.publicationId,
        observationDate: sRaw.observationDate
          ? validatePaperDate(sRaw.observationDate, sRaw.id as string, `${sPath}.observationDate`)
          : undefined,
        description: (sRaw.description as string) || "",
      });
    }
  }

  // Digitizer
  if (!o.digitizer || typeof o.digitizer !== "object") {
    throw new ExperimentValidationError(
      "missing-digitizer",
      "digitizer block is required.",
      "HistoricalDataset",
      `${path}.digitizer`,
    );
  }
  const dig = o.digitizer as Record<string, unknown>;
  if (
    typeof dig.digitizationRevision !== "number" ||
    dig.digitizationRevision <= 0 ||
    !Number.isInteger(dig.digitizationRevision)
  ) {
    throw new ExperimentValidationError(
      "invalid-digitization-revision",
      "digitizationRevision must be a positive integer.",
      "HistoricalDataset",
      `${path}.digitizer.digitizationRevision`,
    );
  }

  // Columns
  if (!Array.isArray(o.columns) || o.columns.length === 0) {
    throw new ExperimentValidationError(
      "missing-columns",
      "columns must be a non-empty array.",
      "HistoricalDataset",
      `${path}.columns`,
    );
  }
  const columns: DatasetColumn[] = [];

  for (let i = 0; i < o.columns.length; i++) {
    const colRaw = o.columns[i] as Record<string, unknown>;
    const colPath = `${path}.columns[${i}]`;
    if (!colRaw || typeof colRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-column",
        "Column must be an object.",
        "HistoricalDataset",
        colPath,
      );
    }
    if ("derived" in colRaw && typeof colRaw.derived === "boolean") {
      throw new ExperimentValidationError(
        "retired-derived-boolean-flag",
        'Found retired boolean "derived" flag on column. Use role: "observed" | "controlled" | "derived" | "reported-fit".',
        "HistoricalDataset",
        colPath,
      );
    }
    if (!COLUMN_ROLES.includes(colRaw.role as ColumnRole)) {
      throw new ExperimentValidationError(
        "invalid-column-role",
        `Invalid column role "${colRaw.role}". Must be one of: observed, controlled, derived, reported-fit.`,
        "HistoricalDataset",
        `${colPath}.role`,
      );
    }
    if (colRaw.role === "reported-fit") {
      if (typeof colRaw.fitDescription !== "string" || !colRaw.fitDescription.trim()) {
        throw new ExperimentValidationError(
          "missing-fit-description",
          'Column with role "reported-fit" requires fitDescription naming what was fitted and by whom.',
          "HistoricalDataset",
          `${colPath}.fitDescription`,
        );
      }
    }
    columns.push({
      name: (colRaw.name as string) || `col-${i}`,
      quantityId: (colRaw.quantityId as string) || "",
      unit: (colRaw.unit as string) || "",
      role: colRaw.role as ColumnRole,
      fitDescription: (colRaw.fitDescription as string) || undefined,
    });
  }

  // Rows & Cells check
  const rows: DatasetRow[] = [];
  if (Array.isArray(o.rows)) {
    for (let r = 0; r < o.rows.length; r++) {
      const rRaw = o.rows[r] as Record<string, unknown>;
      const rPath = `${path}.rows[${r}]`;
      if (!rRaw || !Array.isArray(rRaw.cells)) {
        throw new ExperimentValidationError(
          "invalid-row",
          "Row must be an object with cells array.",
          "HistoricalDataset",
          rPath,
        );
      }
      if (rRaw.cells.length !== columns.length) {
        throw new ExperimentValidationError(
          "cell-count-mismatch",
          `Row ${r} has ${rRaw.cells.length} cells, but dataset declares ${columns.length} columns.`,
          "HistoricalDataset",
          rPath,
        );
      }
      const cells = rRaw.cells.map((c, cIdx) => validateDataCell(c, `${rPath}.cells[${cIdx}]`));
      rows.push({
        seriesId: (rRaw.seriesId as string) || undefined,
        cells,
      });
    }
  }

  // allowedInferenceModelIds is REQUIRED and may be empty
  if (!Array.isArray(o.allowedInferenceModelIds)) {
    throw new ExperimentValidationError(
      "missing-allowed-inference-models",
      "allowedInferenceModelIds is required (may be empty []). An absent list is rejected to prevent unvetted inferences.",
      "HistoricalDataset",
      `${path}.allowedInferenceModelIds`,
    );
  }

  // addressesResults check
  const addressesResults: DatasetAddressesResult[] = [];
  if (Array.isArray(o.addressesResults)) {
    for (let i = 0; i < o.addressesResults.length; i++) {
      const arRaw = o.addressesResults[i] as Record<string, unknown>;
      const arPath = `${path}.addressesResults[${i}]`;
      if (!DATASET_RESULT_RELATIONS.includes(arRaw.relation as DatasetResultRelation)) {
        throw new ExperimentValidationError(
          "invalid-result-relation",
          `Invalid addressesResults relation "${arRaw.relation}". Vocabulary is strictly: tested-a-prediction, measured-a-quantity-the-result-uses, reinterpreted, narrowed-the-domain, disputed ("confirmed" and "proved" are forbidden).`,
          "HistoricalDataset",
          `${arPath}.relation`,
        );
      }
      if (typeof arRaw.statement !== "string" || !arRaw.statement.trim()) {
        throw new ExperimentValidationError(
          "missing-result-statement",
          "addressesResults entry requires statement sentence.",
          "HistoricalDataset",
          `${arPath}.statement`,
        );
      }
      addressesResults.push({
        resultId: arRaw.resultId as string,
        relation: arRaw.relation as DatasetResultRelation,
        statement: arRaw.statement as string,
        openQuestion: (arRaw.openQuestion as string) || undefined,
      });
    }
  }

  return {
    id: o.id as string,
    title: o.title as string,
    evidenceStatus: o.evidenceStatus as any,
    publications,
    primaryPublicationId: o.primaryPublicationId as string,
    series: seriesList.length > 0 ? seriesList : undefined,
    digitizer: {
      name: dig.name as string,
      method: dig.method as string,
      date: dig.date as any,
      sourcePageImage: dig.sourcePageImage as string,
      digitizationRevision: dig.digitizationRevision as number,
    },
    columns,
    rows,
    uncertainty: (o.uncertainty as any) || { type: "none", description: "None reported" },
    notes: (o.notes as string) || "",
    rights: o.rights as SourceAssetRights,
    allowedInferenceModelIds: o.allowedInferenceModelIds as string[],
    calibrationIds: Array.isArray(o.calibrationIds) ? (o.calibrationIds as string[]) : undefined,
    sharedInputIds: Array.isArray(o.sharedInputIds) ? (o.sharedInputIds as string[]) : undefined,
    addressesResults: addressesResults.length > 0 ? addressesResults : undefined,
  };
}

// ============================================================================
// 4. TOUR
// ============================================================================

export const TOUR_BUDGETS = ["fifteen-minutes", "one-evening", "full-course"] as const;
export type TourBudget = (typeof TOUR_BUDGETS)[number];

export type TourStepPreset = Readonly<{
  instrumentId: string;
  tapeId?: string | undefined;
  presetId?: string | undefined;
  promptId?: string | undefined;
}>;

export type TourStep = Readonly<{
  anchorId: string;
  detail: 0 | 1 | 2;
  instrumentPreset?: TourStepPreset | undefined;
  tourPrediction?: string | undefined;
  estimatedMinutes: number;
  purpose: string;
}>;

export type Tour = Readonly<{
  id: string;
  title: string;
  budget: TourBudget;
  papers: readonly string[];
  completionStatement: string;
  steps: readonly TourStep[];
  requiresEquations: boolean;
  syllabus?:
    | readonly Readonly<{
        session: number;
        title: string;
        prerequisites?: readonly string[] | undefined;
        steps: readonly string[];
      }>[]
    | undefined;
}>;

export function validateTour(raw: unknown, path = "Tour"): Tour {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError("invalid-record", "Tour must be an object.", "Tour", path);
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError("missing-id", "Tour id is required.", "Tour", `${path}.id`);
  }
  if (!TOUR_BUDGETS.includes(o.budget as TourBudget)) {
    throw new ExperimentValidationError(
      "invalid-tour-budget",
      `Invalid tour budget "${o.budget}".`,
      "Tour",
      `${path}.budget`,
    );
  }
  const budget = o.budget as TourBudget;

  const requiresEquations = Boolean(o.requiresEquations);
  if (budget === "fifteen-minutes" && requiresEquations) {
    throw new ExperimentValidationError(
      "fifteen-minutes-requires-equations-forbidden",
      'A "fifteen-minutes" tour must have requiresEquations: false.',
      "Tour",
      `${path}.requiresEquations`,
    );
  }

  if (typeof o.completionStatement !== "string" || !o.completionStatement.trim()) {
    throw new ExperimentValidationError(
      "missing-completion-statement",
      "completionStatement is required.",
      "Tour",
      `${path}.completionStatement`,
    );
  }

  if (!Array.isArray(o.steps) || o.steps.length === 0) {
    throw new ExperimentValidationError(
      "missing-tour-steps",
      "steps must be a non-empty array.",
      "Tour",
      `${path}.steps`,
    );
  }

  const steps: TourStep[] = [];
  for (let i = 0; i < o.steps.length; i++) {
    const sRaw = o.steps[i] as Record<string, unknown>;
    const sPath = `${path}.steps[${i}]`;
    if (!sRaw || typeof sRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-tour-step",
        "Tour step must be an object.",
        "Tour",
        sPath,
      );
    }
    if (typeof sRaw.anchorId !== "string" || !sRaw.anchorId.trim()) {
      throw new ExperimentValidationError(
        "missing-step-anchor-id",
        "Tour step requires anchorId.",
        "Tour",
        `${sPath}.anchorId`,
      );
    }

    let instPreset: TourStepPreset | undefined;
    if (sRaw.instrumentPreset && typeof sRaw.instrumentPreset === "object") {
      const ip = sRaw.instrumentPreset as Record<string, unknown>;
      if (ip.tapeId && ip.presetId) {
        throw new ExperimentValidationError(
          "tape-and-preset-both-present",
          "Tour step instrumentPreset cannot declare both tapeId and presetId.",
          "Tour",
          `${sPath}.instrumentPreset`,
        );
      }
      if (ip.presetId && typeof ip.presetId === "string") {
        const psParsed = parsePresetId(ip.presetId);
        if (!psParsed.ok) {
          throw new ExperimentValidationError(
            "invalid-preset-id",
            psParsed.error,
            "Tour",
            `${sPath}.instrumentPreset.presetId`,
          );
        }
      }
      if (ip.promptId && typeof ip.promptId === "string") {
        const prParsed = parsePredictPromptId(ip.promptId);
        if (!prParsed.ok) {
          throw new ExperimentValidationError(
            "invalid-prompt-id",
            prParsed.error,
            "Tour",
            `${sPath}.instrumentPreset.promptId`,
          );
        }
      }
      instPreset = {
        instrumentId: ip.instrumentId as string,
        tapeId: (ip.tapeId as string) || undefined,
        presetId: (ip.presetId as string) || undefined,
        promptId: (ip.promptId as string) || undefined,
      };
    }

    if (instPreset?.promptId && sRaw.tourPrediction) {
      throw new ExperimentValidationError(
        "prompt-id-and-tour-prediction-collision",
        "Tour step cannot declare both promptId and tourPrediction. Use registered promptId or custom tourPrediction, not both.",
        "Tour",
        sPath,
      );
    }

    steps.push({
      anchorId: sRaw.anchorId as string,
      detail: (sRaw.detail as 0 | 1 | 2) || 0,
      instrumentPreset: instPreset,
      tourPrediction: (sRaw.tourPrediction as string) || undefined,
      estimatedMinutes: typeof sRaw.estimatedMinutes === "number" ? sRaw.estimatedMinutes : 1,
      purpose: (sRaw.purpose as string) || "",
    });
  }

  return {
    id: o.id as string,
    title: (o.title as string) || (o.id as string),
    budget,
    papers: Array.isArray(o.papers) ? (o.papers as string[]) : [],
    completionStatement: o.completionStatement as string,
    steps,
    requiresEquations,
    syllabus: Array.isArray(o.syllabus) ? (o.syllabus as any[]) : undefined,
  };
}

// ============================================================================
// 5. CONSTANT SETS
// ============================================================================

export const CONSTANT_ENTRY_KINDS = [
  "exact-defined",
  "measured",
  "printed-historical",
  "declared-scenario",
] as const;
export type ConstantEntryKind = (typeof CONSTANT_ENTRY_KINDS)[number];

export const PRINTED_STATUSES = ["printed", "editorial-input", "printed-corrected"] as const;
export type PrintedStatus = (typeof PRINTED_STATUSES)[number];

export type ConstantSetEntry = Readonly<{
  quantityId: string;
  value: number;
  exactDecimal: string;
  kind: ConstantEntryKind;
  printedStatus?: PrintedStatus | undefined;
  printedReading?: string | undefined;
  reason?: string | undefined;
  sensitivity?: string | undefined;
  correctedValue?: number | undefined;
  correctionReason?: string | undefined;
  receiptRef?: string | undefined;
  era: string;
  provenance: string;
  precision: string;
  uncertainty?: number | string | undefined;
  dependsOn?: readonly string[] | undefined;
  transcriptionStatus: "transcribed-and-checked" | "pending-transcription";
  checkedBy?: string | undefined;
  checkedAt?: string | undefined;
}>;

export type ConstantSet = Readonly<{
  id: string;
  era: string;
  provenance: string;
  precisionNote: string;
  gasConstantProvenance: "defined" | "measured-without-counting-molecules" | "not-applicable";
  entries: readonly ConstantSetEntry[];
}>;

export function validateConstantSet(raw: unknown, path = "ConstantSet"): ConstantSet {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "ConstantSet must be an object.",
      "ConstantSet",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError(
      "missing-id",
      "ConstantSet id is required.",
      "ConstantSet",
      `${path}.id`,
    );
  }

  // Reject retired ids
  if (o.id === "einstein-1905-brownian") {
    throw new ExperimentValidationError(
      "retired-constant-set-id",
      'Found retired constant set id "einstein-1905-brownian". Use "einstein-1905-brownian-printed".',
      "ConstantSet",
      `${path}.id`,
    );
  }

  if (
    !["defined", "measured-without-counting-molecules", "not-applicable"].includes(
      o.gasConstantProvenance as string,
    )
  ) {
    throw new ExperimentValidationError(
      "invalid-gas-constant-provenance",
      `Invalid gasConstantProvenance "${o.gasConstantProvenance}".`,
      "ConstantSet",
      `${path}.gasConstantProvenance`,
    );
  }

  if (!Array.isArray(o.entries) || o.entries.length === 0) {
    throw new ExperimentValidationError(
      "missing-entries",
      "entries must be a non-empty array.",
      "ConstantSet",
      `${path}.entries`,
    );
  }

  const entries: ConstantSetEntry[] = [];
  const isPrintedSet = (o.id as string).endsWith("-printed");

  for (let i = 0; i < o.entries.length; i++) {
    const eRaw = o.entries[i] as Record<string, unknown>;
    const ePath = `${path}.entries[${i}]`;
    if (!eRaw || typeof eRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-entry",
        "Constant entry must be an object.",
        "ConstantSet",
        ePath,
      );
    }
    if (!CONSTANT_ENTRY_KINDS.includes(eRaw.kind as ConstantEntryKind)) {
      throw new ExperimentValidationError(
        "invalid-entry-kind",
        `Invalid entry kind "${eRaw.kind}".`,
        "ConstantSet",
        `${ePath}.kind`,
      );
    }
    const kind = eRaw.kind as ConstantEntryKind;

    if (kind === "exact-defined" && eRaw.uncertainty !== undefined) {
      throw new ExperimentValidationError(
        "exact-defined-has-uncertainty",
        'Entry of kind "exact-defined" must not carry uncertainty.',
        "ConstantSet",
        `${ePath}.uncertainty`,
      );
    }
    if (kind === "measured" && eRaw.uncertainty === undefined) {
      throw new ExperimentValidationError(
        "measured-missing-uncertainty",
        'Entry of kind "measured" requires uncertainty.',
        "ConstantSet",
        `${ePath}.uncertainty`,
      );
    }

    if (isPrintedSet || kind === "printed-historical") {
      if (!PRINTED_STATUSES.includes(eRaw.printedStatus as PrintedStatus)) {
        throw new ExperimentValidationError(
          "missing-printed-status",
          'Entry in printed-historical constant set requires printedStatus: "printed" | "editorial-input" | "printed-corrected".',
          "ConstantSet",
          `${ePath}.printedStatus`,
        );
      }
      const pStatus = eRaw.printedStatus as PrintedStatus;
      if (pStatus === "printed" && !eRaw.printedReading) {
        throw new ExperimentValidationError(
          "printed-missing-reading",
          'printedStatus "printed" requires printedReading.',
          "ConstantSet",
          `${ePath}.printedReading`,
        );
      }
      if (pStatus === "editorial-input") {
        if (!eRaw.reason || !eRaw.sensitivity) {
          throw new ExperimentValidationError(
            "editorial-input-missing-reason-sensitivity",
            'printedStatus "editorial-input" requires reason and sensitivity.',
            "ConstantSet",
            ePath,
          );
        }
      }
      if (pStatus === "printed-corrected") {
        if (!eRaw.receiptRef || !eRaw.printedReading || eRaw.correctedValue === undefined) {
          throw new ExperimentValidationError(
            "printed-corrected-missing-receipt-ref",
            'printedStatus "printed-corrected" requires receiptRef, printedReading, and correctedValue.',
            "ConstantSet",
            ePath,
          );
        }
      }
    }

    if (eRaw.transcriptionStatus === "transcribed-and-checked") {
      if (!eRaw.checkedBy || !eRaw.checkedAt) {
        throw new ExperimentValidationError(
          "checked-missing-checked-by-at",
          'transcriptionStatus "transcribed-and-checked" requires checkedBy and checkedAt.',
          "ConstantSet",
          ePath,
        );
      }
    }

    entries.push({
      quantityId: eRaw.quantityId as string,
      value: eRaw.value as number,
      exactDecimal: (eRaw.exactDecimal as string) || String(eRaw.value),
      kind,
      printedStatus: eRaw.printedStatus as any,
      printedReading: (eRaw.printedReading as string) || undefined,
      reason: (eRaw.reason as string) || undefined,
      sensitivity: (eRaw.sensitivity as string) || undefined,
      correctedValue: typeof eRaw.correctedValue === "number" ? eRaw.correctedValue : undefined,
      correctionReason: (eRaw.correctionReason as string) || undefined,
      receiptRef: (eRaw.receiptRef as string) || undefined,
      era: (eRaw.era as string) || "",
      provenance: (eRaw.provenance as string) || "",
      precision: (eRaw.precision as string) || "",
      uncertainty: eRaw.uncertainty as any,
      dependsOn: Array.isArray(eRaw.dependsOn) ? (eRaw.dependsOn as string[]) : undefined,
      transcriptionStatus: (eRaw.transcriptionStatus as any) || "transcribed-and-checked",
      checkedBy: (eRaw.checkedBy as string) || undefined,
      checkedAt: (eRaw.checkedAt as string) || undefined,
    });
  }

  return {
    id: o.id as string,
    era: (o.era as string) || "",
    provenance: (o.provenance as string) || "",
    precisionNote: (o.precisionNote as string) || "",
    gasConstantProvenance: o.gasConstantProvenance as any,
    entries,
  };
}
